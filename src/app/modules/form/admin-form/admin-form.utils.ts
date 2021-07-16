import { StatusCodes } from 'http-status-codes'
import { err, ok, Result } from 'neverthrow'

import { EditFieldActions } from '../../../../shared/constants'
import { reorder, replaceAt } from '../../../../shared/util/immutable-array-fns'
import {
  FormFieldSchema,
  IPopulatedForm,
  ResponseMode,
  Status,
} from '../../../../types'
import {
  DuplicateFormBodyDto,
  EditFormFieldParams,
} from '../../../../types/api'
import { createLoggerWithLabel } from '../../../config/logger'
import { isPossibleEmailFieldSchema } from '../../../utils/field-validation/field-validation.guards'
import {
  ApplicationError,
  DatabaseConflictError,
  DatabaseError,
  DatabasePayloadSizeError,
  DatabaseValidationError,
  MalformedParametersError,
} from '../../core/core.errors'
import { ErrorResponseData } from '../../core/core.types'
import { MissingUserError } from '../../user/user.errors'
import {
  ForbiddenFormError,
  FormDeletedError,
  FormNotFoundError,
  LogicNotFoundError,
  PrivateFormError,
  TransferOwnershipError,
} from '../form.errors'

import {
  CreatePresignedUrlError,
  EditFieldError,
  FieldNotFoundError,
  InvalidFileTypeError,
} from './admin-form.errors'
import {
  AssertFormFn,
  EditFormFieldResult,
  OverrideProps,
  PermissionLevel,
} from './admin-form.types'

const logger = createLoggerWithLabel(module)

/**
 * Handler to map ApplicationErrors to their correct status code and error
 * messages.
 * @param error The error to retrieve the status codes and error messages
 * @param coreErrorMessage Any error message to return instead of the default core error message, if any
 */
export const mapRouteError = (
  error: ApplicationError,
  coreErrorMessage?: string,
): ErrorResponseData => {
  switch (error.constructor) {
    case InvalidFileTypeError:
    case CreatePresignedUrlError:
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        errorMessage: error.message,
      }
    case FieldNotFoundError:
    case FormNotFoundError:
      return {
        statusCode: StatusCodes.NOT_FOUND,
        errorMessage: error.message,
      }
    case LogicNotFoundError:
      return {
        statusCode: StatusCodes.NOT_FOUND,
        errorMessage: error.message,
      }
    case FormDeletedError:
      return {
        statusCode: StatusCodes.GONE,
        errorMessage: error.message,
      }
    case PrivateFormError:
    case ForbiddenFormError:
      return {
        statusCode: StatusCodes.FORBIDDEN,
        errorMessage: error.message,
      }
    case EditFieldError:
    case DatabaseValidationError:
    case MissingUserError:
      return {
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        errorMessage: error.message,
      }
    case TransferOwnershipError:
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        errorMessage: error.message,
      }
    case MalformedParametersError:
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        errorMessage: error.message,
      }
    case DatabaseConflictError:
      return {
        statusCode: StatusCodes.CONFLICT,
        errorMessage: error.message,
      }
    case DatabasePayloadSizeError:
      return {
        statusCode: StatusCodes.REQUEST_TOO_LONG,
        errorMessage: error.message,
      }
    case DatabaseError:
      return {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        errorMessage: coreErrorMessage ?? error.message,
      }
    default:
      logger.error({
        message: 'Unknown route error observed',
        meta: {
          action: 'mapRouteError',
        },
        error,
      })

      return {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        errorMessage: 'Something went wrong. Please try again.',
      }
  }
}

/**
 * Asserts whether a form is available for retrieval by users.
 * @param form the form to check
 * @returns ok(true) if form status is not archived.
 * @returns err(FormDeletedError) if the form has already been archived
 */
export const assertFormAvailable = (
  form: IPopulatedForm,
): Result<true, FormDeletedError> => {
  return form.status === Status.Archived
    ? err(new FormDeletedError('Form has been archived'))
    : ok(true)
}

/**
 * Asserts that the given user has read access for the form.
 * @returns ok(true) if given user has read permissions
 * @returns err(ForbiddenFormError) if user does not have read permissions
 */
export const assertHasReadPermissions: AssertFormFn = (user, form) => {
  // Is form admin. Automatically has permissions.
  if (String(user._id) === String(form.admin._id)) {
    return ok(true)
  }

  // Check if user email is currently in form's allowed list.
  const hasReadPermissions = !!form.permissionList?.find(
    (allowedUser) => allowedUser.email === user.email,
  )

  return hasReadPermissions
    ? ok(true)
    : err(
        new ForbiddenFormError(
          `User ${user.email} not authorized to perform read operation on Form ${form._id} with title: ${form.title}.`,
        ),
      )
}

/**
 * Asserts that the given user has delete permissions for the form.
 * @returns ok(true) if given user has delete permissions
 * @returns err(ForbiddenFormError) if user does not have delete permissions
 */
export const assertHasDeletePermissions: AssertFormFn = (user, form) => {
  const isFormAdmin = String(user._id) === String(form.admin._id)
  // If form admin
  return isFormAdmin
    ? ok(true)
    : err(
        new ForbiddenFormError(
          `User ${user.email} not authorized to perform delete operation on Form ${form._id} with title: ${form.title}.`,
        ),
      )
}

/**
 * Asserts that the given user has write permissions for the form.
 * @returns ok(true) if given user has write permissions
 * @returns err(ForbiddenFormError) if user does not have write permissions
 */
export const assertHasWritePermissions: AssertFormFn = (user, form) => {
  // Is form admin. Automatically has permissions.
  if (String(user._id) === String(form.admin._id)) {
    return ok(true)
  }

  // Check if user email is currently in form's allowed list, and has write
  // permissions.
  const hasWritePermissions = !!form.permissionList?.find(
    (allowedUser) => allowedUser.email === user.email && allowedUser.write,
  )

  return hasWritePermissions
    ? ok(true)
    : err(
        new ForbiddenFormError(
          `User ${user.email} not authorized to perform write operation on Form ${form._id} with title: ${form.title}.`,
        ),
      )
}

export const getAssertPermissionFn = (level: PermissionLevel): AssertFormFn => {
  switch (level) {
    case PermissionLevel.Read:
      return assertHasReadPermissions
    case PermissionLevel.Write:
      return assertHasWritePermissions
    case PermissionLevel.Delete:
      return assertHasDeletePermissions
  }
}

/**
 * Reshapes given duplicate params into override props.
 * @param params the parameters to reshape
 * @param newAdminId the new admin id to inject
 *
 * @returns override props for use in duplicating a form
 */
export const processDuplicateOverrideProps = (
  params: DuplicateFormBodyDto,
  newAdminId: string,
): OverrideProps => {
  const { responseMode, title } = params

  const overrideProps: OverrideProps = {
    responseMode,
    title,
    admin: newAdminId,
  }

  switch (params.responseMode) {
    case ResponseMode.Encrypt:
      overrideProps.publicKey = params.publicKey
      break
    case ResponseMode.Email:
      overrideProps.emails = params.emails
      break
  }

  return overrideProps
}

/**
 * Private utility to update given field in the existing form fields.
 * @param existingFormFields the existing form fields
 * @param fieldToUpdate the field to replace the current field in existing form fields
 * @returns ok(new array with updated field) if fieldToUpdate can be found in the current fields
 * @returns err(EditFieldError) if field to be updated does not exist
 */
const updateCurrentField = (
  existingFormFields: FormFieldSchema[],
  fieldToUpdate: FormFieldSchema,
): EditFormFieldResult => {
  const existingFieldPosition = existingFormFields.findIndex(
    (f) => f.globalId === fieldToUpdate.globalId,
  )

  return existingFieldPosition === -1
    ? err(new EditFieldError('Field to be updated does not exist'))
    : ok(replaceAt(existingFormFields, existingFieldPosition, fieldToUpdate))
}

/**
 * Private utility to insert given field in the existing form fields.
 * @param existingFormFields the existing form fields
 * @param fieldToInsert the field to insert into the back of current fields
 * @returns ok(new array with field inserted) if fieldToInsert does not already exist
 * @returns err(EditFieldError) if field to be inserted already exists in current fields
 */
const insertField = (
  existingFormFields: FormFieldSchema[],
  fieldToInsert: FormFieldSchema,
): EditFormFieldResult => {
  const doesFieldExist = existingFormFields.some(
    (f) => f.globalId === fieldToInsert.globalId,
  )

  return doesFieldExist
    ? err(
        new EditFieldError(
          `Field ${fieldToInsert.globalId} to be inserted already exists`,
        ),
      )
    : ok([...existingFormFields, fieldToInsert])
}

/**
 * Private utility to delete given field in the existing form fields.
 * @param existingFormFields the existing form fields
 * @param fieldToDelete the field to be deleted that exists in the current field
 * @returns ok(new array with given field deleted) if fieldToDelete can be found in the current fields
 * @returns err(EditFieldError) if field to be deleted does not exist
 */
const deleteField = (
  existingFormFields: FormFieldSchema[],
  fieldToDelete: FormFieldSchema,
): EditFormFieldResult => {
  const updatedFormFields = existingFormFields.filter(
    (f) => f.globalId !== fieldToDelete.globalId,
  )

  return updatedFormFields.length === existingFormFields.length
    ? err(new EditFieldError('Field to be deleted does not exist'))
    : ok(updatedFormFields)
}

/**
 * Private utility to reorder the given field to the given newPosition in the existing form fields.
 *
 * @param existingFormFields the existing form fields
 * @param fieldToReorder the field to reorder in the existing form fields
 * @param newPosition the new index position to move the field to.
 * @returns ok(new array with updated field) if fieldToReorder can be found in the current fields
 * @returns err(EditFieldError) if field to reorder does not exist
 */
const reorderField = (
  existingFormFields: FormFieldSchema[],
  fieldToReorder: FormFieldSchema,
  newPosition: number,
): EditFormFieldResult => {
  const existingFieldPosition = existingFormFields.findIndex(
    (f) => f.globalId === fieldToReorder.globalId,
  )

  return existingFieldPosition === -1
    ? err(new EditFieldError('Field to be reordered does not exist'))
    : ok(reorder(existingFormFields, existingFieldPosition, newPosition))
}

/**
 * Utility factory to run correct update function depending on given action.
 * @param currentFormFields the existing form fields to update
 * @param editFieldParams the parameters with the given update to perform and any metadata required.
 *
 * @returns ok(updated form fields array) if fields update successfully
 * @returns err(EditFieldError) if any errors occur whilst updating fields
 */
export const getUpdatedFormFields = (
  currentFormFields: FormFieldSchema[],
  editFieldParams: EditFormFieldParams,
): EditFormFieldResult => {
  const { field: fieldToUpdate, action } = editFieldParams

  // TODO(#1210): Remove this function when no longer being called.
  // Sync states for backwards compatibility with old clients send inconsistent
  // email fields
  if (isPossibleEmailFieldSchema(fieldToUpdate)) {
    if (fieldToUpdate.hasAllowedEmailDomains === false) {
      fieldToUpdate.allowedEmailDomains = []
    } else {
      fieldToUpdate.hasAllowedEmailDomains = fieldToUpdate.allowedEmailDomains
        ?.length
        ? fieldToUpdate.allowedEmailDomains.length > 0
        : false
    }
  }

  switch (action.name) {
    // Duplicate is just an alias of create for the use case.
    case EditFieldActions.Create:
    case EditFieldActions.Duplicate:
      return insertField(currentFormFields, fieldToUpdate)
    case EditFieldActions.Delete:
      return deleteField(currentFormFields, fieldToUpdate)
    case EditFieldActions.Reorder:
      return reorderField(currentFormFields, fieldToUpdate, action.position)
    case EditFieldActions.Update:
      return updateCurrentField(currentFormFields, fieldToUpdate)
  }
}
