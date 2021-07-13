import { PresignedPost } from 'aws-sdk/clients/s3'
import { assignIn, last, omit } from 'lodash'
import mongoose from 'mongoose'
import { err, errAsync, ok, okAsync, Result, ResultAsync } from 'neverthrow'
import { Except, Merge } from 'type-fest'

import {
  EditFieldActions,
  MAX_UPLOAD_FILE_SIZE,
  VALID_UPLOAD_FILE_TYPES,
} from '../../../../shared/constants'
import {
  FormLogicSchema,
  FormLogoState,
  FormMetaView,
  FormSettings,
  IFieldSchema,
  IForm,
  IFormDocument,
  IFormSchema,
  IPopulatedForm,
  IUserSchema,
  LogicDto,
  Permission,
} from '../../../../types'
import {
  DuplicateFormBody,
  EditFormFieldParams,
  EndPageUpdateDto,
  FieldCreateDto,
  FieldUpdateDto,
  FormUpdateParams,
  SettingsUpdateDto,
  StartPageUpdateDto,
} from '../../../../types/api'
import { aws as AwsConfig } from '../../../config/config'
import { createLoggerWithLabel } from '../../../config/logger'
import getFormModel from '../../../models/form.server.model'
import { dotifyObject } from '../../../utils/dotify-object'
import {
  getMongoErrorMessage,
  transformMongoError,
} from '../../../utils/handle-mongo-error'
import {
  DatabaseConflictError,
  DatabaseError,
  DatabasePayloadSizeError,
  DatabaseValidationError,
  PossibleDatabaseError,
} from '../../core/core.errors'
import { MissingUserError } from '../../user/user.errors'
import * as UserService from '../../user/user.service'
import {
  FormNotFoundError,
  LogicNotFoundError,
  TransferOwnershipError,
} from '../form.errors'
import { getFormModelByResponseMode } from '../form.service'
import { getFormFieldById, getLogicById } from '../form.utils'

import { PRESIGNED_POST_EXPIRY_SECS } from './admin-form.constants'
import {
  CreatePresignedUrlError,
  EditFieldError,
  FieldNotFoundError,
  InvalidFileTypeError,
} from './admin-form.errors'
import {
  getUpdatedFormFields,
  processDuplicateOverrideProps,
} from './admin-form.utils'

const logger = createLoggerWithLabel(module)
const FormModel = getFormModel(mongoose)

type PresignedPostUrlParams = {
  fileId: string
  fileMd5Hash: string
  fileType: string
}

/**
 * Retrieves a list of forms that the user of the given userId can access in
 * their dashboard.
 * @param userId the id of the user to retrieve accessible forms for.
 * @returns ok(DashboardFormViewList)
 * @returns err(MissingUserError) if user with userId does not exist in the database
 * @returns err(DatabaseError) if error occurs whilst querying the database
 */
export const getDashboardForms = (
  userId: string,
): ResultAsync<FormMetaView[], MissingUserError | DatabaseError> => {
  // Step 1: Verify user exists.
  return (
    UserService.findUserById(userId)
      // Step 2: Retrieve lists users are authorized to see.
      .andThen((admin) => {
        return ResultAsync.fromPromise(
          FormModel.getMetaByUserIdOrEmail(userId, admin.email),
          (error) => {
            logger.error({
              message: 'Database error when retrieving admin dashboard forms',
              meta: {
                action: 'getDashboardForms',
                userId,
              },
              error,
            })

            return new DatabaseError()
          },
        )
      })
  )
}

/**
 * Private function to generate a presigned POST URL to upload into the given
 * bucket.
 *
 * @param bucketName the name of the bucket to upload into
 * @param param.fileId key of the file
 * @param param.fileMd5Hash the MD5 hash of the file
 * @param param.fileType the file type of the file
 */
const createPresignedPostUrl = (
  bucketName: string,
  { fileId, fileMd5Hash, fileType }: PresignedPostUrlParams,
): ResultAsync<
  PresignedPost,
  InvalidFileTypeError | CreatePresignedUrlError
> => {
  if (!VALID_UPLOAD_FILE_TYPES.includes(fileType)) {
    return errAsync(
      new InvalidFileTypeError(`"${fileType}" is not a supported file type`),
    )
  }

  const presignedPostUrlPromise = new Promise<PresignedPost>(
    (resolve, reject) => {
      AwsConfig.s3.createPresignedPost(
        {
          Bucket: bucketName,
          Expires: PRESIGNED_POST_EXPIRY_SECS,
          Conditions: [
            // Content length restrictions: 0 to MAX_UPLOAD_FILE_SIZE.
            ['content-length-range', 0, MAX_UPLOAD_FILE_SIZE],
          ],
          Fields: {
            acl: 'public-read',
            key: fileId,
            'Content-MD5': fileMd5Hash,
            'Content-Type': fileType,
          },
        },
        (err, data) => {
          if (err) {
            return reject(err)
          }
          return resolve(data)
        },
      )
    },
  )

  return ResultAsync.fromPromise(presignedPostUrlPromise, (error) => {
    logger.error({
      message: 'Error encountered when creating presigned POST URL',
      meta: {
        action: 'createPresignedPostUrl',
        fileId,
        fileMd5Hash,
        fileType,
      },
      error,
    })

    return new CreatePresignedUrlError('Error occurred whilst uploading file')
  })
}

/**
 * Creates a S3 presigned POST URL for the client to upload images directly to.
 *
 * @param param.fileId key of the file
 * @param param.fileMd5Hash the MD5 hash of the file
 * @param param.fileType the file type of the file
 *
 * @returns ok(presigned post url) when creation is successful
 * @returns err(InvalidFileTypeError) when given file type is not supported
 * @returns err(CreatePresignedUrlError) when errors occurs on S3 side whilst creating presigned post url.
 */
export const createPresignedPostUrlForImages = (
  uploadParams: PresignedPostUrlParams,
): ResultAsync<
  PresignedPost,
  InvalidFileTypeError | CreatePresignedUrlError
> => {
  return createPresignedPostUrl(AwsConfig.imageS3Bucket, uploadParams)
}

/**
 * Creates a S3 presigned POST URL for the client to upload logos directly to.
 *
 * @param param.fileId key of the file
 * @param param.fileMd5Hash the MD5 hash of the file
 * @param param.fileType the file type of the file
 *
 * @returns ok(presigned post url) when creation is successful
 * @returns err(InvalidFileTypeError) when given file type is not supported
 * @returns err(CreatePresignedUrlError) when errors occurs on S3 side whilst creating presigned post url.
 */
export const createPresignedPostUrlForLogos = (
  uploadParams: PresignedPostUrlParams,
): ResultAsync<
  PresignedPost,
  InvalidFileTypeError | CreatePresignedUrlError
> => {
  return createPresignedPostUrl(AwsConfig.logoS3Bucket, uploadParams)
}

/**
 * Extracts IDs of MyInfo fields
 * @param formFields
 * @returns List of IDs of MyInfo fields
 */
export const extractMyInfoFieldIds = (
  formFields: IFieldSchema[] | undefined,
): string[] => {
  return formFields
    ? formFields
        .filter((field) => field.myInfo?.attr)
        .map((field) => field._id.toString())
    : []
}

/**
 * Archives given form.
 * @param form the form to archive
 * @returns ok(true) if successful
 * @returns err(DatabaseError) if any database errors occur
 */
export const archiveForm = (
  form: IPopulatedForm,
): ResultAsync<true, DatabaseError> => {
  return ResultAsync.fromPromise(form.archive(), (error) => {
    logger.error({
      message: 'Database error encountered when archiving form',
      meta: {
        action: 'archiveForm',
        form,
      },
      error,
    })

    return new DatabaseError(getMongoErrorMessage(error))
    // On success, return true
  }).map(() => true)
}

/**
 * Transfer form ownership from current owner to the new email.
 * @param currentForm the form to transfer ownership for
 * @param newOwnerEmail the email of the new owner to transfer to
 *
 * @return ok(updated form) if transfer is successful
 * @return err(MissingUserError) if the current form admin cannot be found
 * @return err(TransferOwnershipError) if new owner cannot be found in the database or new owner email is same as current owner
 * @return err(DatabaseError) if any database errors like missing admin of current owner occurs
 */
export const transferFormOwnership = (
  currentForm: IPopulatedForm,
  newOwnerEmail: string,
): ResultAsync<IPopulatedForm, TransferOwnershipError | DatabaseError> => {
  const logMeta = {
    action: 'transferFormOwnership',
    newOwnerEmail,
  }

  return (
    // Step 1: Retrieve current owner of form to transfer.
    UserService.findUserById(String(currentForm.admin._id))
      .andThen<IUserSchema, TransferOwnershipError>((currentOwner) => {
        // No need to transfer form ownership if new and current owners are
        // the same.
        if (newOwnerEmail === currentOwner.email) {
          return errAsync(
            new TransferOwnershipError(
              'You are already the owner of this form',
            ),
          )
        }
        return okAsync(currentOwner)
      })
      .andThen((currentOwner) =>
        // Step 2: Retrieve user document for new owner.
        UserService.findUserByEmail(newOwnerEmail)
          .mapErr((error) => {
            logger.error({
              message:
                'Error occurred whilst finding new owner email to transfer ownership to',
              meta: logMeta,
              error,
            })

            // Override MissingUserError with more specific message if new owner
            // cannot be found.
            if (error instanceof MissingUserError) {
              return new TransferOwnershipError(
                `${newOwnerEmail} must have logged in once before being added as Owner`,
              )
            }
            return error
          })
          // Step 3: Perform form ownership transfer.
          .andThen((newOwner) =>
            ResultAsync.fromPromise(
              currentForm.transferOwner<IPopulatedForm>(currentOwner, newOwner),
              (error) => {
                logger.error({
                  message: 'Error occurred whilst transferring form ownership',
                  meta: logMeta,
                  error,
                })

                return new DatabaseError(getMongoErrorMessage(error))
              },
            ),
          ),
      )
      // Step 4: Populate updated form.
      .andThen((updatedForm) =>
        ResultAsync.fromPromise(
          updatedForm
            .populate({ path: 'admin', populate: { path: 'agency' } })
            .execPopulate(),
          (error) => {
            logger.error({
              message: 'Error occurred whilst populating form with admin',
              meta: logMeta,
              error,
            })

            return new DatabaseError(getMongoErrorMessage(error))
          },
        ),
      )
  )
}

/**
 * Creates a form with the given form params
 * @param formParams parameters for the form to be created.
 *
 * @returns ok(created form) on success
 * @returns err(Database*Error) on database errors
 */
export const createForm = (
  formParams: Merge<IForm, { admin: string }>,
): ResultAsync<
  IFormSchema,
  | DatabaseError
  | DatabaseValidationError
  | DatabaseConflictError
  | DatabasePayloadSizeError
> => {
  return ResultAsync.fromPromise(FormModel.create(formParams), (error) => {
    logger.error({
      message: 'Database error encountered when creating form',
      meta: {
        action: 'createForm',
        formParams,
      },
      error,
    })

    return transformMongoError(error)
  })
}

/**
 * Duplicates given formId and replace owner with newAdminId.
 * @param originalForm the form to be duplicated
 * @param newAdminId the id of the admin of the duplicated form
 * @param overrideParams params to override in the duplicated form; e.g. the new emails or public key of the form.
 * @returns the newly created duplicated form
 */
export const duplicateForm = (
  originalForm: IFormDocument,
  newAdminId: string,
  overrideParams: DuplicateFormBody,
): ResultAsync<IFormDocument, FormNotFoundError | DatabaseError> => {
  const overrideProps = processDuplicateOverrideProps(
    overrideParams,
    newAdminId,
  )

  // Set startPage.logo to default irregardless.
  overrideProps.startPage = {
    ...originalForm.startPage,
    logo: { state: FormLogoState.Default },
  }
  // Prevent buttonLink from being copied over if buttonLink is the default
  // form hash.
  if (originalForm.endPage?.buttonLink === `#!/${originalForm._id}`) {
    overrideProps.endPage = omit(originalForm.endPage, 'buttonLink')
  }

  const duplicateParams = originalForm.getDuplicateParams(overrideProps)

  return ResultAsync.fromPromise(
    FormModel.create(duplicateParams) as Promise<IFormDocument>,
    (error) => {
      logger.error({
        message: 'Error encountered while duplicating form',
        meta: {
          action: 'duplicateForm',
          duplicateParams,
          newAdminId,
        },
        error,
      })

      return new DatabaseError(getMongoErrorMessage(error))
    },
  )
}

/**
 * Updates the targeted form field with the new field provided
 * @param form the form the field to update belongs to
 * @param fieldId the id of the field to update
 * @param newField the new field to replace with
 * @returns ok(updatedField)
 * @returns err(FieldNotFoundError) if fieldId does not correspond to any field in the form
 * @returns err(PossibleDatabaseError) when database errors arise
 */
export const updateFormField = (
  form: IPopulatedForm,
  fieldId: string,
  newField: FieldUpdateDto,
): ResultAsync<IFieldSchema, PossibleDatabaseError | FieldNotFoundError> => {
  return ResultAsync.fromPromise(
    form.updateFormFieldById(fieldId, newField),
    (error) => {
      logger.error({
        message: 'Error encountered while updating form field',
        meta: {
          action: 'updateFormField',
          formId: form._id,
          fieldId,
          newField,
        },
        error,
      })

      return transformMongoError(error)
    },
  ).andThen<IFieldSchema, FieldNotFoundError>((updatedForm) => {
    if (!updatedForm) {
      return errAsync(new FieldNotFoundError())
    }
    const updatedFormField = getFormFieldById(updatedForm.form_fields, fieldId)
    return updatedFormField
      ? okAsync(updatedFormField)
      : errAsync(new FieldNotFoundError())
  })
}

/**
 * Duplicates the form field of the corresponding fieldId
 * @param form the original form to duplicate form field for
 * @param fieldId fieldId of the the form field to duplicate
 *
 * @returns ok(duplicated field)
 * @returns err(PossibleDatabaseError) when database errors arise
 */
export const duplicateFormField = (
  form: IPopulatedForm,
  fieldId: string,
): ResultAsync<
  IFieldSchema,
  PossibleDatabaseError | FormNotFoundError | FieldNotFoundError
> => {
  return ResultAsync.fromPromise(
    form.duplicateFormFieldById(fieldId),
    (error) => {
      logger.error({
        message: 'Error encountered while duplicating form field',
        meta: {
          action: 'duplicateFormField',
          formId: form._id,
          fieldId,
        },
        error,
      })

      return transformMongoError(error)
    },
  ).andThen((updatedForm) => {
    if (!updatedForm) {
      // Success means field is in initial form object but query still returned null.
      // Return best guess error that form is now not found in the DB.
      // Otherwise, err(FieldNotFoundError) will be returned by the function.
      return getFormField(form, fieldId).asyncAndThen(() =>
        errAsync(new FormNotFoundError()),
      )
    }
    const updatedField = last(updatedForm.form_fields)
    return updatedField
      ? okAsync(updatedField)
      : errAsync(new FieldNotFoundError())
  })
}

/**
 * Inserts a new form field into given form's fields with the field provided
 * @param form the form to insert the new field into
 * @param newField the new field to insert
 * @returns ok(created form field)
 * @returns err(PossibleDatabaseError) when database errors arise
 */
export const createFormField = (
  form: IPopulatedForm,
  newField: FieldCreateDto,
): ResultAsync<
  IFieldSchema,
  PossibleDatabaseError | FormNotFoundError | FieldNotFoundError
> => {
  return ResultAsync.fromPromise(form.insertFormField(newField), (error) => {
    logger.error({
      message: 'Error encountered while inserting new form field',
      meta: {
        action: 'createFormField',
        formId: form._id,
        newField,
      },
      error,
    })

    return transformMongoError(error)
  }).andThen((updatedForm) => {
    if (!updatedForm) {
      return errAsync(new FormNotFoundError())
    }
    const updatedField = last(updatedForm.form_fields)
    return updatedField
      ? okAsync(updatedField)
      : errAsync(new FieldNotFoundError())
  })
}

/**
 * Reorders field with given fieldId to the given newPosition
 * @param form the form to reorder the field from
 * @param fieldId the id of the field to reorder
 * @param newPosition the new position of the field
 * @returns ok(reordered field)
 * @returns err(FieldNotFoundError) if field id is invalid
 * @returns err(PossibleDatabaseError) if any database errors occur
 */
export const reorderFormField = (
  form: IPopulatedForm,
  fieldId: string,
  newPosition: number,
): ResultAsync<IFieldSchema[], PossibleDatabaseError | FieldNotFoundError> => {
  return ResultAsync.fromPromise(
    form.reorderFormFieldById(fieldId, newPosition),
    (error) => {
      logger.error({
        message: 'Error encountered while reordering form field',
        meta: {
          action: 'reorderFormField',
          formId: form._id,
          fieldId,
          newPosition,
        },
        error,
      })

      return transformMongoError(error)
    },
  ).andThen((updatedForm) => {
    if (!updatedForm) {
      return errAsync(new FieldNotFoundError())
    }

    return okAsync(updatedForm.form_fields)
  })
}

/**
 * Updates form fields of given form depending on the given editFormFieldParams
 * @param originalForm the original form to update form fields for
 * @param editFormFieldParams the parameters stating the type of updates and the position metadata if update type is edit
 *
 * @returns ok(updated form) if form fields update successfully
 * @returns err(EditFieldError) if invalid updates are being performed to form fields
 * @returns err(set of DatabaseError) if any database errors occurs
 */
export const editFormFields = (
  originalForm: IPopulatedForm,
  editFormFieldParams: EditFormFieldParams,
): ResultAsync<
  IPopulatedForm,
  EditFieldError | ReturnType<typeof transformMongoError>
> => {
  // TODO(#1210): Remove this function when no longer being called.
  if (
    [EditFieldActions.Create, EditFieldActions.Update].includes(
      editFormFieldParams.action.name,
    )
  ) {
    logger.info({
      message: 'deprecated editFormFields functions are still being used',
      meta: {
        action: 'editFormFields',
        fieldAction: editFormFieldParams.action.name,
        field: editFormFieldParams.field,
      },
    })
  }

  // TODO(#815): Split out this function into their own separate service functions depending on the update type.
  return getUpdatedFormFields(
    originalForm.form_fields,
    editFormFieldParams,
  ).asyncAndThen((newFormFields) => {
    // Update form fields of original form.
    originalForm.form_fields = newFormFields
    return ResultAsync.fromPromise(originalForm.save(), (error) => {
      logger.error({
        message: 'Error encountered while editing form fields',
        meta: {
          action: 'editFormFields',
          originalForm,
          editFormFieldParams,
        },
        error,
      })

      return transformMongoError(error)
    })
  })
}

/**
 * Updates form schema of given form depending on the given formUpdateParams
 * @param originalForm the original form to update form fields for
 * @param formUpdateParams the parameters to update the original form with
 *
 * @returns ok(updated form) if form fields update successfully
 * @returns err(set of DatabaseError) if any database errors occurs
 */
export const updateForm = (
  originalForm: IPopulatedForm,
  formUpdateParams: Except<FormUpdateParams, 'editFormField'>,
): ResultAsync<IPopulatedForm, ReturnType<typeof transformMongoError>> => {
  // TODO(#815): Split out this function into their own separate service functions depending on the form parameter to update.
  // Scrub formUpdateParams to remove private details, if any.
  const scrubbedFormParams = omit(formUpdateParams, [
    'admin',
    '__v',
    '_id',
    'id',
    'created',
    'lastModified',
  ])

  // Updating some part of form, override original form with new updated form.
  assignIn(originalForm, scrubbedFormParams)

  return ResultAsync.fromPromise(originalForm.save(), (error) => {
    logger.error({
      message: 'Error encountered while updating form',
      meta: {
        action: 'updateForm',
        originalForm,
        formUpdateParams,
      },
      error,
    })

    return transformMongoError(error)
  })
}

/**
 * Updates the collaborators of a given form
 * @param form the form to update collaborators fo
 * @param updatedCollaborators the new list of collaborators
 *
 * @returns ok(collaborators) if form updates successfully
 * @returns err(PossibleDatabaseError) if any database errors occurs
 */
export const updateFormCollaborators = (
  form: IPopulatedForm,
  updatedCollaborators: Permission[],
): ResultAsync<Permission[], PossibleDatabaseError> => {
  return ResultAsync.fromPromise(
    form.updateFormCollaborators(updatedCollaborators),
    (error) => {
      logger.error({
        message: 'Error encountered while updating form collaborators',
        meta: {
          action: 'updateFormCollaborators',
          formId: form._id,
        },
        error,
      })

      return transformMongoError(error)
    },
  ).andThen(({ permissionList }) => okAsync(permissionList))
}

/**
 * Updates form settings.
 * @param originalForm The original form to update settings for
 * @param body the subset of form settings to update
 * @returns ok(updated form settings) on success
 * @returns err(MalformedParametersError) if email update is attempted for an encrypt mode form
 * @returns err(database errors) if db error is thrown during form setting update
 */
export const updateFormSettings = (
  originalForm: IPopulatedForm,
  body: SettingsUpdateDto,
): ResultAsync<
  FormSettings,
  | FormNotFoundError
  | DatabaseError
  | DatabaseValidationError
  | DatabaseConflictError
  | DatabasePayloadSizeError
> => {
  const dotifiedSettingsToUpdate = dotifyObject(body)
  const ModelToUse = getFormModelByResponseMode(originalForm.responseMode)

  return ResultAsync.fromPromise(
    ModelToUse.findByIdAndUpdate(originalForm._id, dotifiedSettingsToUpdate, {
      new: true,
      runValidators: true,
    }).exec(),
    (error) => {
      logger.error({
        message: 'Error encountered while updating form',
        meta: {
          action: 'updateFormSettings',
          formId: originalForm._id,
          // Body is not logged in case sensitive data such as emails are stored.
        },
        error,
      })

      return transformMongoError(error)
    },
  ).andThen((updatedForm) => {
    if (!updatedForm) {
      return errAsync(new FormNotFoundError())
    }
    return okAsync(updatedForm.getSettings())
  })
}

/**
 * Creates form logic.
 * @param form The original form to create logic in
 * @param createLogicBody Object containing the created logic
 * @returns ok(created logic dto) on success
 * @returns err(database errors) if db error is thrown during logic update
 */
export const createFormLogic = (
  form: IPopulatedForm,
  createLogicBody: LogicDto,
): ResultAsync<FormLogicSchema, DatabaseError | FormNotFoundError> => {
  // Create new form logic
  return ResultAsync.fromPromise(
    FormModel.createFormLogic(form._id, createLogicBody),
    (error) => {
      logger.error({
        message: 'Error occurred when creating form logic',
        meta: {
          action: 'createFormLogic',
          formId: form._id,
          createLogicBody,
        },
        error,
      })
      return transformMongoError(error)
    },
    // On success, return created form logic
  ).andThen((updatedForm) => {
    if (!updatedForm) {
      return errAsync(new FormNotFoundError())
    }
    const createdLogic = last(updatedForm.form_logics)
    return createdLogic ? okAsync(createdLogic) : errAsync(new DatabaseError())
  })
}

/**
 * Deletes form logic.
 * @param form The original form to delete logic in
 * @param logicId the logicId to delete
 * @returns ok(true) on success
 * @returns err(database errors) if db error is thrown during logic delete
 * @returns err(LogicNotFoundError) if logicId does not exist on form
 */
export const deleteFormLogic = (
  form: IPopulatedForm,
  logicId: string,
): ResultAsync<
  IFormDocument,
  DatabaseError | LogicNotFoundError | FormNotFoundError
> => {
  // First check if specified logic exists
  if (!form.form_logics.some((logic) => logic.id === logicId)) {
    logger.error({
      message: 'Error occurred - logicId to be deleted does not exist',
      meta: {
        action: 'deleteFormLogic',
        formId: form._id,
        logicId,
      },
    })
    return errAsync(new LogicNotFoundError())
  }

  // Remove specified logic and then update form logic
  return ResultAsync.fromPromise(
    FormModel.deleteFormLogic(String(form._id), logicId),
    (error) => {
      logger.error({
        message: 'Error occurred when deleting form logic',
        meta: {
          action: 'deleteFormLogic',
          formId: form._id,
          logicId,
        },
        error,
      })
      return transformMongoError(error)
    },
    // On success, return true
  ).andThen((updatedForm) => {
    if (!updatedForm) {
      return errAsync(new FormNotFoundError())
    }
    return okAsync(updatedForm)
  })
}

/**
 * Updates form logic.
 * @param form The original form to update logic in
 * @param logicId the logicId to update
 * @param updatedLogic Object containing the updated logic
 * @returns ok(updated logic dto) on success
 * @returns err(database errors) if db error is thrown during logic update
 * @returns err(LogicNotFoundError) if logicId does not exist on form
 */
export const updateFormLogic = (
  form: IPopulatedForm,
  logicId: string,
  updatedLogic: LogicDto,
): ResultAsync<
  FormLogicSchema,
  DatabaseError | LogicNotFoundError | FormNotFoundError
> => {
  // First check if specified logic exists
  if (!form.form_logics.some((logic) => logic._id.toHexString() === logicId)) {
    logger.error({
      message: 'Error occurred - logicId to be updated does not exist',
      meta: {
        action: 'updateFormLogic',
        formId: form._id,
        logicId,
      },
    })
    return errAsync(new LogicNotFoundError())
  }

  // Update specified logic
  return ResultAsync.fromPromise(
    FormModel.updateFormLogic(form._id.toHexString(), logicId, updatedLogic),
    (error) => {
      logger.error({
        message: 'Error occurred when updating form logic',
        meta: {
          action: 'updateFormLogic',
          formId: form._id,
          logicId,
          updatedLogic,
        },
        error,
      })
      return transformMongoError(error)
    },
    // On success, return updated form logic
  ).andThen((updatedForm) => {
    if (!updatedForm) {
      return errAsync(new FormNotFoundError())
    }
    const updatedLogic = getLogicById(updatedForm.form_logics, logicId)
    return updatedLogic
      ? okAsync(updatedLogic)
      : errAsync(new LogicNotFoundError()) // Possible race condition if logic gets deleted after the initial logicId check but before the db update
  })
}

/**
 * Deletes a form field from the given form.
 * @param form The form to delete the specified form field for
 * @param fieldId the id of the form field to delete
 * @returns ok(updated form) on success
 * @returns err(PossibleDatabaseError) if db error is thrown during the deletion of form fields
 * @returns err(FieldNotFoundError) if the fieldId does not exist in form's fields
 */
export const deleteFormField = <T extends IFormSchema>(
  form: T,
  fieldId: string,
): ResultAsync<
  IFormSchema,
  PossibleDatabaseError | FormNotFoundError | FieldNotFoundError
> => {
  const logMeta = {
    action: 'deleteFormField',
    formId: form._id,
    fieldId,
  }

  if (!getFormFieldById(form.form_fields, fieldId)) {
    logger.error({
      message: 'Field to be deleted cannot be found',
      meta: logMeta,
    })
    return errAsync(new FieldNotFoundError())
  }

  return ResultAsync.fromPromise(
    FormModel.deleteFormFieldById(String(form._id), fieldId),
    (error) => {
      logger.error({
        message: 'Error occurred when deleting form logic',
        meta: logMeta,
        error,
      })
      return transformMongoError(error)
    },
  ).andThen((updatedForm) => {
    if (!updatedForm) {
      return errAsync(new FormNotFoundError())
    }
    return okAsync(updatedForm)
  })
}

/**
 * Update the end page of the given form
 * @param formId the id of the form to update the end page for
 * @param newEndPage the new end page object to replace the current one
 * @returns ok(updated end page object) when update is successful
 * @returns err(FormNotFoundError) if form cannot be found
 * @returns err(PossibleDatabaseError) if endpage update fails
 */
export const updateEndPage = (
  formId: string,
  newEndPage: EndPageUpdateDto,
): ResultAsync<
  IFormDocument['endPage'],
  PossibleDatabaseError | FormNotFoundError
> => {
  return ResultAsync.fromPromise(
    FormModel.updateEndPageById(formId, newEndPage),
    (error) => {
      logger.error({
        message: 'Error occurred when updating form end page',
        meta: {
          action: 'updateEndPage',
          formId,
          newEndPage,
        },
        error,
      })
      return transformMongoError(error)
    },
  ).andThen((updatedForm) => {
    if (!updatedForm) {
      return errAsync(new FormNotFoundError())
    }
    return okAsync(updatedForm.endPage)
  })
}

/**
 * Retrieves a form field from the given form.
 * @param form The form to retrieve the specified form field for
 * @param fieldId the id of the form field
 * @returns ok(form field) on success
 * @returns err(FieldNotFoundError) if the fieldId does not exist in form's fields
 */
export const getFormField = (
  form: IPopulatedForm,
  fieldId: string,
): Result<IFieldSchema, FieldNotFoundError> => {
  const formField = getFormFieldById(form.form_fields, fieldId)
  if (!formField)
    return err(
      new FieldNotFoundError(
        `Attempted to retrieve field ${fieldId} from ${form._id} but field was not present`,
      ),
    )
  return ok(formField)
}

/**
 * Update the start page of the given form
 * @param formId the id of the form to update the end page for
 * @param newStartPage the new start page object to replace the current one
 * @returns ok(updated start page object) when update is successful
 * @returns err(FormNotFoundError) if form cannot be found
 * @returns err(PossibleDatabaseError) if start page update fails
 */
export const updateStartPage = (
  formId: string,
  newStartPage: StartPageUpdateDto,
): ResultAsync<
  IFormDocument['startPage'],
  PossibleDatabaseError | FormNotFoundError
> => {
  return ResultAsync.fromPromise(
    FormModel.updateStartPageById(formId, newStartPage),
    (error) => {
      logger.error({
        message: 'Error occurred when updating form start page',
        meta: {
          action: 'updateStartPage',
          formId,
          newStartPage,
        },
        error,
      })
      return transformMongoError(error)
    },
  ).andThen((updatedForm) => {
    if (!updatedForm) {
      return errAsync(new FormNotFoundError())
    }
    return okAsync(updatedForm.startPage)
  })
}
