import JoiDate from '@joi/date'
import { celebrate, Joi as BaseJoi, Segments } from 'celebrate'
import { StatusCodes } from 'http-status-codes'
import JSONStream from 'JSONStream'
import { ResultAsync } from 'neverthrow'

import {
  MAX_UPLOAD_FILE_SIZE,
  VALID_UPLOAD_FILE_TYPES,
} from '../../../../shared/constants'
import {
  AuthType,
  BasicField,
  Colors,
  FieldResponse,
  FormFieldWithId,
  FormLogoState,
  FormSettings,
  IForm,
  IFormDocument,
  IPopulatedForm,
  LogicConditionState,
  LogicDto,
  LogicIfValue,
  LogicType,
  PublicFormDto,
  ResponseMode,
} from '../../../../types'
import {
  AdminDashboardFormMetaDto,
  CreateFormBodyDto,
  DuplicateFormBodyDto,
  EncryptSubmissionDto,
  EndPageUpdateDto,
  ErrorDto,
  FieldCreateDto,
  FieldUpdateDto,
  FormDto,
  FormFieldDto,
  FormUpdateParams,
  PermissionsUpdateDto,
  PreviewFormViewDto,
  PrivateFormErrorDto,
  SettingsUpdateDto,
  StartPageUpdateDto,
} from '../../../../types/api'
import { DeserializeTransform } from '../../../../types/utils'
import { createLoggerWithLabel } from '../../../config/logger'
import MailService from '../../../services/mail/mail.service'
import { createReqMeta } from '../../../utils/request'
import * as AuthService from '../../auth/auth.service'
import {
  DatabaseConflictError,
  DatabaseError,
  DatabasePayloadSizeError,
  DatabaseValidationError,
} from '../../core/core.errors'
import { ControllerHandler } from '../../core/core.types'
import * as FeedbackService from '../../feedback/feedback.service'
import * as EmailSubmissionMiddleware from '../../submission/email-submission/email-submission.middleware'
import * as EmailSubmissionService from '../../submission/email-submission/email-submission.service'
import {
  mapAttachmentsFromResponses,
  mapRouteError as mapEmailSubmissionError,
  SubmissionEmailObj,
} from '../../submission/email-submission/email-submission.util'
import ParsedResponsesObject from '../../submission/email-submission/ParsedResponsesObject.class'
import * as EncryptSubmissionMiddleware from '../../submission/encrypt-submission/encrypt-submission.middleware'
import * as EncryptSubmissionService from '../../submission/encrypt-submission/encrypt-submission.service'
import { mapRouteError as mapEncryptSubmissionError } from '../../submission/encrypt-submission/encrypt-submission.utils'
import IncomingEncryptSubmission from '../../submission/encrypt-submission/IncomingEncryptSubmission.class'
import * as SubmissionService from '../../submission/submission.service'
import {
  extractEmailConfirmationData,
  extractEmailConfirmationDataFromIncomingSubmission,
} from '../../submission/submission.utils'
import * as UserService from '../../user/user.service'
import { PrivateFormError } from '../form.errors'
import * as FormService from '../form.service'

import {
  PREVIEW_CORPPASS_UID,
  PREVIEW_CORPPASS_UINFIN,
  PREVIEW_SINGPASS_UINFIN,
} from './admin-form.constants'
import { EditFieldError } from './admin-form.errors'
import * as AdminFormService from './admin-form.service'
import { PermissionLevel } from './admin-form.types'
import { mapRouteError } from './admin-form.utils'

// NOTE: Refer to this for documentation: https://github.com/sideway/joi-date/blob/master/API.md
const Joi = BaseJoi.extend(JoiDate) as typeof BaseJoi

const logger = createLoggerWithLabel(module)

// Validators
const createFormValidator = celebrate({
  [Segments.BODY]: {
    form: BaseJoi.object<Omit<IForm, 'admin'>>()
      .keys({
        // Require valid responsesMode field.
        responseMode: Joi.string()
          .valid(...Object.values(ResponseMode))
          .required(),
        // Require title field.
        title: Joi.string().min(4).max(200).required(),
        // Require emails string (for backwards compatibility) or string
        // array if form to be created in Email mode.
        emails: Joi.when('responseMode', {
          is: ResponseMode.Email,
          then: Joi.alternatives()
            .try(Joi.array().items(Joi.string()).min(1), Joi.string())
            .required(),
          // TODO (#2264): disallow the 'emails' key when responseMode is not Email
          // Allow old clients to send this key but optionally and without restrictions
          // on array length or type
          otherwise: Joi.alternatives().try(
            Joi.array(),
            Joi.string().allow(''),
          ),
        }),
        // Require publicKey field if form to be created in Storage mode.
        publicKey: Joi.string()
          .allow('')
          .when('responseMode', {
            is: ResponseMode.Encrypt,
            then: Joi.string().required().disallow(''),
          }),
      })
      .required()
      // Allow other form schema keys to be passed for form creation.
      .unknown(true),
  },
})

const duplicateFormValidator = celebrate({
  [Segments.BODY]: BaseJoi.object<DuplicateFormBodyDto>({
    // Require valid responsesMode field.
    responseMode: Joi.string()
      .valid(...Object.values(ResponseMode))
      .required(),
    // Require title field.
    title: Joi.string().min(4).max(200).required(),
    // Require emails string (for backwards compatibility) or string array
    // if form to be duplicated in Email mode.
    emails: Joi.when('responseMode', {
      is: ResponseMode.Email,
      then: Joi.alternatives()
        .try(Joi.array().items(Joi.string()).min(1), Joi.string())
        .required(),
      // TODO (#2264): disallow the 'emails' key when responseMode is not Email
      // Allow old clients to send this key but optionally and without restrictions
      // on array length or type
      otherwise: Joi.alternatives().try(Joi.array(), Joi.string().allow('')),
    }),
    // Require publicKey field if form to be duplicated in Storage mode.
    publicKey: Joi.string()
      .allow('')
      .when('responseMode', {
        is: ResponseMode.Encrypt,
        then: Joi.string().required().disallow(''),
      }),
  }),
})

const transferFormOwnershipValidator = celebrate({
  [Segments.BODY]: {
    email: Joi.string()
      .required()
      .email({
        minDomainSegments: 2, // Number of segments required for the domain
        tlds: { allow: true }, // TLD (top level domain) validation
        multiple: false, // Disallow multiple emails
      })
      .message('Please enter a valid email'),
  },
})

const fileUploadValidator = celebrate({
  [Segments.BODY]: {
    fileId: Joi.string().required(),
    fileMd5Hash: Joi.string().base64().required(),
    fileType: Joi.string()
      .valid(...VALID_UPLOAD_FILE_TYPES)
      .required(),
  },
})

/**
 * Handler for GET /adminform endpoint.
 * @security session
 *
 * @returns 200 with list of forms user can access when list is retrieved successfully
 * @returns 422 when user of given id cannnot be found in the database
 * @returns 500 when database errors occur
 */
export const handleListDashboardForms: ControllerHandler<
  unknown,
  AdminDashboardFormMetaDto[] | ErrorDto
> = async (req, res) => {
  const authedUserId = (req.session as Express.AuthedSession).user._id

  return AdminFormService.getDashboardForms(authedUserId)
    .map((dashboardView) => res.json(dashboardView))
    .mapErr((error) => {
      logger.error({
        message: 'Error listing dashboard forms',
        meta: {
          action: 'handleListDashboardForms',
          userId: authedUserId,
        },
        error,
      })
      const { errorMessage, statusCode } = mapRouteError(error)
      return res.status(statusCode).json({ message: errorMessage })
    })
}

/**
 * Handler for GET /:formId/adminform.
 * @security session
 *
 * @returns 200 with retrieved form with formId if user has read permissions
 * @returns 403 when user does not have permissions to access form
 * @returns 404 when form cannot be found
 * @returns 410 when form is archived
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const handleGetAdminForm: ControllerHandler<{ formId: string }> = (
  req,
  res,
) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  return (
    // Step 1: Retrieve currently logged in user.
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Check whether user has read permissions to form
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Read,
        }),
      )
      .map((form) => res.status(StatusCodes.OK).json({ form }))
      .mapErr((error) => {
        logger.error({
          message: 'Error retrieving single form',
          meta: {
            action: 'handleGetSingleForm',
            ...createReqMeta(req),
          },
          error,
        })

        const { statusCode, errorMessage } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Handler for GET /api/v3/admin/forms/:formId/collaborators
 * @security session
 *
 * @returns 200 with collaborators
 * @returns 403 when current user does not have read permissions for the form
 * @returns 404 when form cannot be found
 * @returns 410 when retrieving collaborators for an archived form
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const handleGetFormCollaborators: ControllerHandler<
  { formId: string },
  PermissionsUpdateDto | ErrorDto
> = (req, res) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  return (
    // Step 1: Retrieve currently logged in user.
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Check whether user has read permissions to form
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Read,
        }),
      )
      .map(({ permissionList }) =>
        res.status(StatusCodes.OK).send(permissionList),
      )
      .mapErr((error) => {
        logger.error({
          message: 'Error retrieving form collaborators',
          meta: {
            action: 'handleGetFormCollaborators',
            ...createReqMeta(req),
          },
          error,
        })

        const { statusCode, errorMessage } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Handler for GET /:formId/adminform/preview.
 * @security session
 *
 * @returns 200 with form with private details scrubbed for previewing if user has read permissions
 * @returns 403 when user does not have permissions to access form
 * @returns 404 when form cannot be found
 * @returns 410 when form is archived
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const handlePreviewAdminForm: ControllerHandler<{ formId: string }> = (
  req,
  res,
) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id
  return (
    // Step 1: Retrieve currently logged in user.
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Check whether user has read permissions to form
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Read,
        }),
      )
      // Step 3: Remove private details from form for previewing.
      .map((populatedForm) => populatedForm.getPublicView())
      .map((scrubbedForm) =>
        res.status(StatusCodes.OK).json({ form: scrubbedForm }),
      )
      .mapErr((error) => {
        logger.error({
          message: 'Error previewing admin form',
          meta: {
            action: 'handlePreviewAdminForm',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Handler for POST /:formId([a-fA-F0-9]{24})/adminform/images.
 * @security session
 *
 * @returns 200 with presigned POST URL object
 * @returns 400 when error occurs whilst creating presigned POST URL object
 * @returns 403 when user does not have write permissions for form
 * @returns 404 when form cannot be found
 * @returns 410 when form is archived
 * @returns 422 when user in session cannot be retrieved from the database
 */
export const createPresignedPostUrlForImages: ControllerHandler<
  { formId: string },
  unknown,
  {
    fileId: string
    fileMd5Hash: string
    fileType: string
  }
> = async (req, res) => {
  const { formId } = req.params
  const { fileId, fileMd5Hash, fileType } = req.body
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  return (
    // Step 1: Retrieve currently logged in user.
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Check whether user has write permissions to form
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Write,
        }),
      )
      // Step 3: Has write permissions, generate presigned POST URL.
      .andThen(() =>
        AdminFormService.createPresignedPostUrlForImages({
          fileId,
          fileMd5Hash,
          fileType,
        }),
      )
      .map((presignedPostUrl) => res.json(presignedPostUrl))
      .mapErr((error) => {
        logger.error({
          message: 'Presigning post data encountered an error',
          meta: {
            action: 'createPresignedPostUrlForImages',
            ...createReqMeta(req),
          },
          error,
        })

        const { statusCode, errorMessage } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

export const handleCreatePresignedPostUrlForImages = [
  fileUploadValidator,
  createPresignedPostUrlForImages,
] as ControllerHandler[]

/**
 * Handler for POST /:formId([a-fA-F0-9]{24})/adminform/logos.
 * @security session
 *
 * @returns 200 with presigned POST URL object
 * @returns 400 when error occurs whilst creating presigned POST URL object
 * @returns 403 when user does not have write permissions for form
 * @returns 404 when form cannot be found
 * @returns 410 when form is archived
 * @returns 422 when user in session cannot be retrieved from the database
 */
export const createPresignedPostUrlForLogos: ControllerHandler<
  { formId: string },
  unknown,
  {
    fileId: string
    fileMd5Hash: string
    fileType: string
  }
> = async (req, res) => {
  const { formId } = req.params
  const { fileId, fileMd5Hash, fileType } = req.body
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  return (
    // Step 1: Retrieve currently logged in user.
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Check whether user has write permissions to form
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Write,
        }),
      )
      // Step 3: Has write permissions, generate presigned POST URL.
      .andThen(() =>
        AdminFormService.createPresignedPostUrlForLogos({
          fileId,
          fileMd5Hash,
          fileType,
        }),
      )
      .map((presignedPostUrl) => res.json(presignedPostUrl))
      .mapErr((error) => {
        logger.error({
          message: 'Presigning post data encountered an error',
          meta: {
            action: 'createPresignedPostUrlForLogos',
            ...createReqMeta(req),
          },
          error,
        })

        const { statusCode, errorMessage } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

export const handleCreatePresignedPostUrlForLogos = [
  fileUploadValidator,
  createPresignedPostUrlForLogos,
] as ControllerHandler[]

// Validates that the ending date >= starting date
const validateDateRange = celebrate({
  [Segments.QUERY]: Joi.object()
    .keys({
      startDate: Joi.date().format('YYYY-MM-DD').raw(),
      endDate: Joi.date().format('YYYY-MM-DD').min(Joi.ref('startDate')).raw(),
    })
    .and('startDate', 'endDate'),
})

/**
 * NOTE: This is exported solely for testing
 * @security session
 *
 * @returns 200 with submission counts of given form
 * @returns 400 when query.startDate or query.endDate is malformed
 * @returns 403 when user does not have permissions to access form
 * @returns 404 when form cannot be found
 * @returns 410 when form is archived
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const countFormSubmissions: ControllerHandler<
  { formId: string },
  ErrorDto | number,
  unknown,
  { startDate?: string; endDate?: string }
> = async (req, res) => {
  const { formId } = req.params
  const { startDate, endDate } = req.query
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  const logMeta = {
    action: 'handleCountFormSubmissions',
    ...createReqMeta(req),
    userId: sessionUserId,
    formId,
  }

  // Step 1: Retrieve currently logged in user.
  const formResult = await UserService.getPopulatedUserById(
    sessionUserId,
  ).andThen((user) =>
    // Step 2: Check whether user has read permissions to form
    AuthService.getFormAfterPermissionChecks({
      user,
      formId,
      level: PermissionLevel.Read,
    }),
  )

  if (formResult.isErr()) {
    logger.warn({
      message: 'Error occurred when checking user permissions for form',
      meta: logMeta,
      error: formResult.error,
    })
    const { errorMessage, statusCode } = mapRouteError(formResult.error)
    return res.status(statusCode).json({ message: errorMessage })
  }

  // Step 3: Has permissions, continue to retrieve submission counts.
  return SubmissionService.getFormSubmissionsCount(formId, {
    startDate,
    endDate,
  })
    .map((count) => res.json(count))
    .mapErr((error) => {
      logger.error({
        message: 'Error retrieving form submission count',
        meta: {
          action: 'handleCountFormSubmissions',
          ...createReqMeta(req),
          userId: sessionUserId,
          formId,
        },
        error,
      })
      const { errorMessage, statusCode } = mapRouteError(error)
      return res.status(statusCode).json({ message: errorMessage })
    })
}

// Handler for GET /admin/forms/:formId/submissions/count
export const handleCountFormSubmissions = [
  validateDateRange,
  countFormSubmissions,
] as ControllerHandler[]

/**
 * Handler for GET /{formId}/adminform/feedback/count.
 * @security session
 *
 * @returns 200 with feedback counts of given form
 * @returns 403 when user does not have permissions to access form
 * @returns 404 when form cannot be found
 * @returns 410 when form is archived
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const handleCountFormFeedback: ControllerHandler<{
  formId: string
}> = async (req, res) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  return (
    // Step 1: Retrieve currently logged in user.
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Check whether user has read permissions to form
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Read,
        }),
      )
      // Step 3: Retrieve form feedback counts.
      .andThen(() => FeedbackService.getFormFeedbackCount(formId))
      .map((feedbackCount) => res.json(feedbackCount))
      // Some error occurred earlier in the chain.
      .mapErr((error) => {
        logger.error({
          message: 'Error retrieving form feedback count',
          meta: {
            action: 'handleCountFormFeedback',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Handler for GET /{formId}/adminform/feedback/download.
 * @security session
 *
 * @returns 200 with feedback stream
 * @returns 403 when user does not have permissions to access form
 * @returns 404 when form cannot be found
 * @returns 410 when form is archived
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database or stream error occurs
 */
export const handleStreamFormFeedback: ControllerHandler<{
  formId: string
}> = async (req, res) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  // Step 1: Retrieve currently logged in user.
  const hasReadPermissionResult = await UserService.getPopulatedUserById(
    sessionUserId,
  ).andThen((user) =>
    // Step 2: Check whether user has read permissions to form
    AuthService.getFormAfterPermissionChecks({
      user,
      formId,
      level: PermissionLevel.Read,
    }),
  )

  const logMeta = {
    action: 'handleStreamFormFeedback',
    ...createReqMeta(req),
    userId: sessionUserId,
    formId,
  }

  if (hasReadPermissionResult.isErr()) {
    logger.error({
      message: 'Error occurred whilst verifying user permissions',
      meta: logMeta,
      error: hasReadPermissionResult.error,
    })
    const { errorMessage, statusCode } = mapRouteError(
      hasReadPermissionResult.error,
    )
    return res.status(statusCode).json({ message: errorMessage })
  }

  // No errors, start stream.
  const cursor = FeedbackService.getFormFeedbackStream(formId)

  cursor
    .on('error', (error) => {
      logger.error({
        message: 'Error streaming feedback from MongoDB',
        meta: logMeta,
        error,
      })
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Error retrieving from database.',
      })
    })
    .pipe(JSONStream.stringify())
    .on('error', (error) => {
      logger.error({
        message: 'Error converting feedback to JSON',
        meta: logMeta,
        error,
      })
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Error converting feedback to JSON',
      })
    })
    .pipe(res.type('json'))
    .on('error', (error) => {
      logger.error({
        message: 'Error writing feedback to HTTP stream',
        meta: logMeta,
        error,
      })
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Error writing feedback to HTTP stream',
      })
    })
    .on('close', () => {
      logger.info({
        message: 'Stream feedback closed',
        meta: logMeta,
      })

      return res.end()
    })
}

/**
 * Handler for GET /{formId}/adminform/feedback.
 * @security session
 *
 * @returns 200 with feedback response
 * @returns 403 when user does not have permissions to access form
 * @returns 404 when form cannot be found
 * @returns 410 when form is archived
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const handleGetFormFeedback: ControllerHandler<{
  formId: string
}> = (req, res) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  return UserService.getPopulatedUserById(sessionUserId)
    .andThen((user) =>
      AuthService.getFormAfterPermissionChecks({
        user,
        formId,
        level: PermissionLevel.Read,
      }),
    )
    .andThen(() => FeedbackService.getFormFeedbacks(formId))
    .map((fbResponse) => res.json(fbResponse))
    .mapErr((error) => {
      logger.error({
        message: 'Error retrieving form feedbacks',
        meta: {
          action: 'handleGetFormFeedback',
          ...createReqMeta(req),
          userId: sessionUserId,
          formId,
        },
        error,
      })
      const { errorMessage, statusCode } = mapRouteError(error)
      return res.status(statusCode).json({ message: errorMessage })
    })
}

/**
 * Handler for DELETE /{formId}/adminform.
 * @security session
 *
 * @returns 200 with success message when successfully archived
 * @returns 403 when user does not have permissions to archive form
 * @returns 404 when form cannot be found
 * @returns 410 when form is already archived
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const handleArchiveForm: ControllerHandler<{ formId: string }> = async (
  req,
  res,
) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  return (
    // Step 1: Retrieve currently logged in user.
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Check whether user has delete permissions for form.
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Delete,
        }),
      )
      // Step 3: Currently logged in user has permissions to archive form.
      .andThen((formToArchive) => AdminFormService.archiveForm(formToArchive))
      .map(() => res.json({ message: 'Form has been archived' }))
      .mapErr((error) => {
        logger.warn({
          message: 'Error occurred when archiving form',
          meta: {
            action: 'handleArchiveForm',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Handler for POST /:formId/adminform
 * Duplicates the form corresponding to the formId. The currently logged in user
 * must have read permissions to the form being copied.
 * @note Even if current user is not admin of the form, the current user will be the admin of the new form
 * @security session
 *
 * @returns 200 with the duplicate form dashboard view
 * @returns 403 when user does not have permissions to access form
 * @returns 404 when form cannot be found
 * @returns 410 when form is archived
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const duplicateAdminForm: ControllerHandler<
  { formId: string },
  unknown,
  DuplicateFormBodyDto
> = (req, res) => {
  const { formId } = req.params
  const userId = (req.session as Express.AuthedSession).user._id
  const overrideParams = req.body

  return (
    // Step 1: Retrieve currently logged in user.
    UserService.getPopulatedUserById(userId)
      .andThen((user) =>
        // Step 2: Check if current user has permissions to read form.
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Read,
        })
          .andThen((originalForm) =>
            // Step 3: Duplicate form.
            AdminFormService.duplicateForm(
              originalForm,
              userId,
              overrideParams,
            ),
          )
          // Step 4: Retrieve dashboard view of duplicated form.
          .map((duplicatedForm) => duplicatedForm.getDashboardView(user)),
      )
      // Success; return duplicated form's dashboard view.
      .map((dupedDashView) => res.json(dupedDashView))
      // Error; some error occurred in the chain.
      .mapErr((error) => {
        logger.error({
          message: 'Error duplicating form',
          meta: {
            action: 'duplicateAdminForm',
            ...createReqMeta(req),
            userId,
            formId,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

export const handleDuplicateAdminForm = [
  duplicateFormValidator,
  duplicateAdminForm,
] as ControllerHandler[]

/**
 * Handler for GET /:formId/adminform/template
 * @security session
 *
 * @returns 200 with target form's public view
 * @returns 403 when the target form is private
 * @returns 404 when form cannot be found
 * @returns 410 when form is archived
 * @returns 500 when database error occurs
 */
export const handleGetTemplateForm: ControllerHandler<
  { formId: string },
  PreviewFormViewDto | ErrorDto | PrivateFormErrorDto
> = (req, res) => {
  const { formId } = req.params
  const userId = (req.session as Express.AuthedSession).user._id

  return (
    // Step 1: Retrieve form only if form is currently public.
    AuthService.getFormIfPublic(formId)
      // Step 2: Remove private form details before being returned.
      .map((populatedForm) => populatedForm.getPublicView())
      .map((scrubbedForm) =>
        res
          .status(StatusCodes.OK)
          .json({ form: scrubbedForm as PublicFormDto }),
      )
      .mapErr((error) => {
        logger.error({
          message: 'Error retrieving form template',
          meta: {
            action: 'handleGetTemplateForm',
            ...createReqMeta(req),
            userId,
            formId,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)

        // Specialized error response for PrivateFormError.
        if (error instanceof PrivateFormError) {
          return res.status(statusCode).json({
            message: error.message,
            // Flag to prevent default 404 subtext ("please check link") from
            // showing.
            isPageFound: true,
            formTitle: error.formTitle,
          })
        }
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Handler for POST /:formId/adminform/copy
 * Duplicates the form corresponding to the formId. The form must be public to
 * be copied.
 * @note The current user will be the admin of the new duplicated form
 * @security session
 *
 * @returns 200 with the duplicate form dashboard view
 * @returns 403 when form is private
 * @returns 404 when form cannot be found
 * @returns 410 when form is archived
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const handleCopyTemplateForm: ControllerHandler<
  { formId: string },
  AdminDashboardFormMetaDto | ErrorDto,
  DuplicateFormBodyDto
> = (req, res) => {
  const { formId } = req.params
  const userId = (req.session as Express.AuthedSession).user._id
  const overrideParams = req.body

  return (
    // Step 1: Retrieve currently logged in user.
    UserService.getPopulatedUserById(userId)
      .andThen((user) =>
        // Step 2: Check if form is currently public.
        AuthService.getFormIfPublic(formId).andThen((originalForm) =>
          // Step 3: Duplicate form.
          AdminFormService.duplicateForm(originalForm, userId, overrideParams)
            // Step 4: Retrieve dashboard view of duplicated form.
            .map((duplicatedForm) => duplicatedForm.getDashboardView(user)),
        ),
      )
      // Success; return duplicated form's dashboard view.
      .map((dupedDashView) => res.json(dupedDashView))
      // Error; some error occurred in the chain.
      .mapErr((error) => {
        logger.error({
          message: 'Error copying template form',
          meta: {
            action: 'handleCopyTemplateForm',
            ...createReqMeta(req),
            userId: userId,
            formId,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)

        // Specialized error response for PrivateFormError.
        if (error instanceof PrivateFormError) {
          return res.status(statusCode).json({
            message: 'Form must be public to be copied',
          })
        }
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Handler for POST /{formId}/adminform/transfer-owner.
 * @security session
 *
 * @returns 200 with updated form with transferred owners
 * @returns 400 when new owner is not in the database yet
 * @returns 400 when new owner is already current owner
 * @returns 403 when user is not the current owner of the form
 * @returns 404 when form cannot be found
 * @returns 410 when form is archived
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const transferFormOwnership: ControllerHandler<
  { formId: string },
  unknown,
  { email: string }
> = (req, res) => {
  const { formId } = req.params
  const { email: newOwnerEmail } = req.body
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  return (
    // Step 1: Retrieve currently logged in user.
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Retrieve form with delete permission check.
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Delete,
        }),
      )
      // Step 3: User has permissions, transfer form ownership.
      .andThen((retrievedForm) =>
        AdminFormService.transferFormOwnership(retrievedForm, newOwnerEmail),
      )
      // Success, return updated form.
      .map((updatedPopulatedForm) => res.json({ form: updatedPopulatedForm }))
      // Some error occurred earlier in the chain.
      .mapErr((error) => {
        logger.error({
          message: 'Error occurred whilst transferring form ownership',
          meta: {
            action: 'transferFormOwnership',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
            newOwnerEmail,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

export const handleTransferFormOwnership = [
  transferFormOwnershipValidator,
  transferFormOwnership,
] as ControllerHandler[]

/**
 * Handler for POST /adminform.
 * @security session
 *
 * @returns 200 with newly created form
 * @returns 409 when a database conflict error occurs
 * @returns 413 when payload for created form exceeds size limit
 * @returns 422 when user of given id cannnot be found in the database, or when form parameters are invalid
 * @returns 500 when database error occurs
 */
export const createForm: ControllerHandler<
  unknown,
  DeserializeTransform<FormDto> | ErrorDto,
  { form: CreateFormBodyDto }
> = async (req, res) => {
  const { form: formParams } = req.body
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  return (
    // Step 1: Retrieve currently logged in user.
    UserService.findUserById(sessionUserId)
      // Step 2: Create form with given params and set admin to logged in user.
      .andThen((user) =>
        AdminFormService.createForm({ ...formParams, admin: user._id }),
      )
      .map((createdForm) => {
        return res
          .status(StatusCodes.OK)
          .json(createdForm as DeserializeTransform<FormDto>)
      })
      .mapErr((error) => {
        logger.error({
          message: 'Error occurred when creating form',
          meta: {
            action: 'createForm',
            ...createReqMeta(req),
            userId: sessionUserId,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

export const handleCreateForm = [
  createFormValidator,
  createForm,
] as ControllerHandler[]

/**
 * Handler for PUT /:formId/adminform.
 * @security session
 *
 * @returns 200 with updated form
 * @returns 400 when form field has invalid updates to be performed
 * @returns 403 when current user does not have permissions to update form
 * @returns 404 when form to update cannot be found
 * @returns 409 when saving updated form incurs a conflict in the database
 * @returns 410 when form to update is archived
 * @returns 413 when updated form is too large to be saved in the database
 * @returns 422 when an invalid update is attempted on the form
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const handleUpdateForm: ControllerHandler<
  { formId: string },
  unknown,
  { form: FormUpdateParams }
> = (req, res) => {
  const { formId } = req.params
  const { form: formUpdateParams } = req.body
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  // Step 1: Retrieve currently logged in user.
  return UserService.getPopulatedUserById(sessionUserId)
    .andThen((user) =>
      // Step 2: Retrieve form with write permission check.
      AuthService.getFormAfterPermissionChecks({
        user,
        formId,
        level: PermissionLevel.Write,
      }),
    )
    .andThen((retrievedForm) => {
      // Step 3: Update form or form fields depending on form update parameters
      // passed in.
      const { editFormField } = formUpdateParams

      // Use different service function depending on type of form update.
      const updateFormResult: ResultAsync<
        IPopulatedForm,
        | EditFieldError
        | DatabaseError
        | DatabaseValidationError
        | DatabaseConflictError
        | DatabasePayloadSizeError
      > = editFormField
        ? AdminFormService.editFormFields(retrievedForm, editFormField)
        : AdminFormService.updateForm(retrievedForm, formUpdateParams)

      return updateFormResult
    })
    .map((updatedForm) => res.status(StatusCodes.OK).json(updatedForm))
    .mapErr((error) => {
      logger.error({
        message: 'Error occurred when updating form',
        meta: {
          action: 'handleUpdateForm',
          ...createReqMeta(req),
          userId: sessionUserId,
          formId,
          formUpdateParams,
        },
        error,
      })
      const { errorMessage, statusCode } = mapRouteError(error)
      return res.status(statusCode).json({ message: errorMessage })
    })
}

/**
 * Handler for POST /:formId/fields/:fieldId/duplicate
 * @security session
 *
 * @returns 200 with duplicated field
 * @returns 400 when form field has invalid updates to be performed
 * @returns 403 when current user does not have permissions to update form
 * @returns 404 when form or field to duplicate cannot be found
 * @returns 409 when saving updated form incurs a conflict in the database
 * @returns 410 when form to update is archived
 * @returns 413 when updated form is too large to be saved in the database
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const handleDuplicateFormField: ControllerHandler<
  { formId: string; fieldId: string },
  FormFieldDto | ErrorDto
> = (req, res) => {
  const { formId, fieldId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  // Step 1: Retrieve currently logged in user.
  return UserService.getPopulatedUserById(sessionUserId)
    .andThen((user) =>
      // Step 2: Retrieve form with write permission check.
      AuthService.getFormAfterPermissionChecks({
        user,
        formId,
        level: PermissionLevel.Write,
      }),
    )
    .andThen((form) => AdminFormService.duplicateFormField(form, fieldId))
    .map((duplicatedField) =>
      res.status(StatusCodes.OK).json(duplicatedField as FormFieldDto),
    )
    .mapErr((error) => {
      logger.error({
        message: 'Error occurred when duplicating field',
        meta: {
          action: 'handleDuplicateFormField',
          ...createReqMeta(req),
          userId: sessionUserId,
          formId,
          fieldId,
        },
        error,
      })
      const { errorMessage, statusCode } = mapRouteError(error)
      return res.status(statusCode).json({ message: errorMessage })
    })
}

/**
 * Handler for PATCH /forms/:formId/settings.
 * @security session
 *
 * @returns 200 with updated form settings
 * @returns 400 when body is malformed; can happen when email parameter is passed for encrypt-mode forms
 * @returns 403 when current user does not have permissions to update form settings
 * @returns 404 when form to update settings for cannot be found
 * @returns 409 when saving form settings incurs a conflict in the database
 * @returns 410 when updating settings for archived form
 * @returns 413 when updating settings causes form to be too large to be saved in the database
 * @returns 422 when an invalid settings update is attempted on the form
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const handleUpdateSettings: ControllerHandler<
  { formId: string },
  FormSettings | ErrorDto,
  SettingsUpdateDto
> = (req, res) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id
  const settingsToPatch = req.body

  // Step 1: Retrieve currently logged in user.
  return UserService.getPopulatedUserById(sessionUserId)
    .andThen((user) =>
      // Step 2: Retrieve form with write permission check.
      AuthService.getFormAfterPermissionChecks({
        user,
        formId,
        level: PermissionLevel.Write,
      }),
    )
    .andThen((retrievedForm) =>
      AdminFormService.updateFormSettings(retrievedForm, settingsToPatch),
    )
    .map((updatedSettings) => res.status(StatusCodes.OK).json(updatedSettings))
    .mapErr((error) => {
      logger.error({
        message: 'Error occurred when updating form settings',
        meta: {
          action: 'handleUpdateSettings',
          ...createReqMeta(req),
          userId: sessionUserId,
          formId,
          settingsKeysToUpdate: Object.keys(settingsToPatch),
        },
        error,
      })
      const { errorMessage, statusCode } = mapRouteError(error)
      return res.status(statusCode).json({ message: errorMessage })
    })
}

/**
 * NOTE: Exported for testing.
 * Private handler for PUT /forms/:formId/fields/:fieldId
 * @precondition Must be preceded by request validation
 */
export const _handleUpdateFormField: ControllerHandler<
  {
    formId: string
    fieldId: string
  },
  FormFieldDto | ErrorDto,
  FieldUpdateDto
> = (req, res) => {
  const { formId, fieldId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  // Step 1: Retrieve currently logged in user.
  return (
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Retrieve form with write permission check.
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Write,
        }),
      )
      // Step 3: User has permissions, update form field of retrieved form.
      .andThen((form) =>
        AdminFormService.updateFormField(form, fieldId, req.body),
      )
      .map((updatedFormField) =>
        res.status(StatusCodes.OK).json(updatedFormField as FormFieldDto),
      )
      .mapErr((error) => {
        logger.error({
          message: 'Error occurred when updating form field',
          meta: {
            action: 'handleUpdateFormField',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
            fieldId,
            updateFieldBody: req.body,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Handler for GET /form/:formId/settings.
 * @security session
 *
 * @returns 200 with latest form settings on successful update
 * @returns 401 when current user is not logged in
 * @returns 403 when current user does not have permissions to obtain form settings
 * @returns 404 when form to retrieve settings for cannot be found
 * @returns 409 when saving form settings incurs a conflict in the database
 * @returns 500 when database error occurs
 */
export const handleGetSettings: ControllerHandler<
  { formId: string },
  FormSettings | ErrorDto
> = (req, res) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  return UserService.getPopulatedUserById(sessionUserId)
    .andThen((user) =>
      // Retrieve form for settings as well as for permissions checking
      FormService.retrieveFullFormById(formId).map((form) => ({
        form,
        user,
      })),
    )
    .andThen(AuthService.checkFormForPermissions(PermissionLevel.Read))
    .map((form) => res.status(StatusCodes.OK).json(form.getSettings()))
    .mapErr((error) => {
      logger.error({
        message: 'Error occurred when retrieving form settings',
        meta: {
          action: 'handleGetSettings',
          ...createReqMeta(req),
          userId: sessionUserId,
          formId,
        },
        error,
      })
      const { errorMessage, statusCode } = mapRouteError(error)
      return res.status(statusCode).json({ message: errorMessage })
    })
}

/**
 * Handler for POST /v2/submissions/encrypt/preview/:formId.
 * @security session
 *
 * @returns 200 with a mock submission ID
 * @returns 400 when body is malformed; e.g. invalid plaintext responses or encoding for encrypted content
 * @returns 403 when current user does not have read permissions to given form
 * @returns 404 when given form ID does not exist
 * @returns 410 when given form has been deleted
 * @returns 422 when user ID in session is not found in database
 * @returns 500 when database error occurs
 */
export const submitEncryptPreview: ControllerHandler<
  { formId: string },
  { message: string; submissionId: string } | ErrorDto,
  EncryptSubmissionDto
> = async (req, res) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id
  // No need to process attachments as we don't do anything with them
  const { encryptedContent, responses, version } = req.body
  const logMeta = {
    action: 'submitEncryptPreview',
    formId,
  }

  // eslint-disable-next-line typesafe/no-await-without-trycatch
  return UserService.getPopulatedUserById(sessionUserId)
    .andThen((user) =>
      // Step 2: Retrieve form with write permission check.
      AuthService.getFormAfterPermissionChecks({
        user,
        formId,
        level: PermissionLevel.Read,
      }),
    )
    .andThen((form) =>
      EncryptSubmissionService.checkFormIsEncryptMode(form).mapErr((error) => {
        logger.error({
          message: 'Error while retrieving form for preview submission',
          meta: logMeta,
          error,
        })
        return error
      }),
    )
    .andThen((form) =>
      IncomingEncryptSubmission.init(form, responses, encryptedContent)
        .map((incomingSubmission) => ({ incomingSubmission, form }))
        .mapErr((error) => {
          logger.error({
            message: 'Error while processing incoming preview submission.',
            meta: logMeta,
            error,
          })
          return error
        }),
    )
    .map(({ incomingSubmission, form }) => {
      const submission =
        EncryptSubmissionService.createEncryptSubmissionWithoutSave({
          form,
          encryptedContent: incomingSubmission.encryptedContent,
          // Don't bother encrypting and signing mock variables for previews
          verifiedContent: '',
          version,
        })

      void SubmissionService.sendEmailConfirmations({
        form,
        submission,
        recipientData:
          extractEmailConfirmationDataFromIncomingSubmission(
            incomingSubmission,
          ),
      })

      // Return the reply early to the submitter
      return res.json({
        message: 'Form submission successful.',
        submissionId: submission._id,
      })
    })
    .mapErr((error) => {
      const { errorMessage, statusCode } = mapEncryptSubmissionError(error)
      return res.status(statusCode).json({ message: errorMessage })
    })
}

export const handleEncryptPreviewSubmission = [
  EncryptSubmissionMiddleware.validateEncryptSubmissionParams,
  submitEncryptPreview,
] as ControllerHandler[]

/**
 * Handler for POST /v2/submissions/email/preview/:formId.
 * @security session
 *
 * @returns 200 with a mock submission ID
 * @returns 400 when body is malformed; e.g. invalid responses, or when admin email fails to be sent
 * @returns 403 when current user does not have read permissions to given form
 * @returns 404 when given form ID does not exist
 * @returns 410 when given form has been deleted
 * @returns 422 when user ID in session is not found in database
 * @returns 500 when database error occurs
 */
export const submitEmailPreview: ControllerHandler<
  { formId: string },
  { message: string; submissionId?: string },
  { responses: FieldResponse[] },
  { captchaResponse?: unknown }
> = async (req, res) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id
  // No need to process attachments as we don't do anything with them
  const { responses } = req.body
  const logMeta = {
    action: 'submitEmailPreview',
    formId,
    ...createReqMeta(req),
  }

  const formResult = await UserService.getPopulatedUserById(sessionUserId)
    .andThen((user) =>
      AuthService.getFormAfterPermissionChecks({
        user,
        formId,
        level: PermissionLevel.Read,
      }),
    )
    .andThen(EmailSubmissionService.checkFormIsEmailMode)
  if (formResult.isErr()) {
    logger.error({
      message: 'Error while retrieving form for preview submission',
      meta: logMeta,
      error: formResult.error,
    })
    const { errorMessage, statusCode } = mapEmailSubmissionError(
      formResult.error,
    )
    return res.status(statusCode).json({ message: errorMessage })
  }
  const form = formResult.value

  const parsedResponsesResult =
    await EmailSubmissionService.validateAttachments(responses).andThen(() =>
      ParsedResponsesObject.parseResponses(form, responses),
    )
  if (parsedResponsesResult.isErr()) {
    logger.error({
      message: 'Error while parsing responses for preview submission',
      meta: logMeta,
      error: parsedResponsesResult.error,
    })
    const { errorMessage, statusCode } = mapEmailSubmissionError(
      parsedResponsesResult.error,
    )
    return res.status(statusCode).json({ message: errorMessage })
  }
  const parsedResponses = parsedResponsesResult.value
  const attachments = mapAttachmentsFromResponses(req.body.responses)

  // Handle SingPass, CorpPass and MyInfo authentication and validation
  const { authType } = form
  if (authType === AuthType.SP || authType === AuthType.MyInfo) {
    parsedResponses.addNdiResponses({
      authType,
      uinFin: PREVIEW_SINGPASS_UINFIN,
    })
  } else if (authType === AuthType.CP) {
    parsedResponses.addNdiResponses({
      authType,
      uinFin: PREVIEW_CORPPASS_UINFIN,
      userInfo: PREVIEW_CORPPASS_UID,
    })
  }

  const emailData = new SubmissionEmailObj(
    parsedResponses.getAllResponses(),
    // All MyInfo fields are verified in preview
    new Set(AdminFormService.extractMyInfoFieldIds(form.form_fields)),
    form.authType,
  )
  const submission = EmailSubmissionService.createEmailSubmissionWithoutSave(
    form,
    // Don't need to care about response hash or salt
    '',
    '',
  )

  const sendAdminEmailResult = await MailService.sendSubmissionToAdmin({
    replyToEmails: EmailSubmissionService.extractEmailAnswers(
      parsedResponses.getAllResponses(),
    ),
    form,
    submission,
    attachments,
    dataCollationData: emailData.dataCollationData,
    formData: emailData.formData,
  })
  if (sendAdminEmailResult.isErr()) {
    logger.error({
      message: 'Error sending submission to admin',
      meta: logMeta,
      error: sendAdminEmailResult.error,
    })
    const { statusCode, errorMessage } = mapEmailSubmissionError(
      sendAdminEmailResult.error,
    )
    return res.status(statusCode).json({
      message: errorMessage,
    })
  }

  // Don't await on email confirmations, so submission is successful even if
  // this fails
  void SubmissionService.sendEmailConfirmations({
    form,
    submission,
    attachments,
    responsesData: emailData.autoReplyData,
    recipientData: extractEmailConfirmationData(
      parsedResponses.getAllResponses(),
      form.form_fields,
    ),
  }).mapErr((error) => {
    logger.error({
      message: 'Error while sending email confirmations',
      meta: logMeta,
      error,
    })
  })

  return res.json({
    message: 'Form submission successful.',
    submissionId: submission.id,
  })
}

export const handleEmailPreviewSubmission = [
  EmailSubmissionMiddleware.receiveEmailSubmission,
  EmailSubmissionMiddleware.validateResponseParams,
  submitEmailPreview,
] as ControllerHandler[]

/**
 * Handler for PUT /forms/:formId/fields/:fieldId
 * @security session
 *
 * @returns 200 with updated form field
 * @returns 403 when current user does not have permissions to update form field
 * @returns 404 when form cannot be found
 * @returns 404 when form field cannot be found
 * @returns 410 when updating form field of an archived form
 * @returns 413 when updating form field causes form to be too large to be saved in the database
 * @returns 422 when an invalid form field update is attempted on the form
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const handleUpdateFormField = [
  celebrate(
    {
      [Segments.BODY]: Joi.object({
        // Ensures given field is same as accessed field.
        _id: Joi.string().valid(Joi.ref('$params.fieldId')).required(),
        fieldType: Joi.string()
          .valid(...Object.values(BasicField))
          .required(),
        description: Joi.string().allow('').required(),
        required: Joi.boolean().required(),
        title: Joi.string().required(),
        disabled: Joi.boolean().required(),
        // Allow other field related key-values to be provided and let the model
        // layer handle the validation.
      }).unknown(true),
    },
    undefined,
    // Required so req.body can be validated against values in req.params.
    // See https://github.com/arb/celebrate#celebrateschema-joioptions-opts.
    { reqContext: true },
  ),
  _handleUpdateFormField,
]

/**
 * NOTE: Exported for testing.
 * Private handler for POST /forms/:formId/fields
 * @precondition Must be preceded by request validation
 * @security session
 *
 * @returns 200 with created form field
 * @returns 403 when current user does not have permissions to create a form field
 * @returns 404 when form cannot be found
 * @returns 410 when creating form field for an archived form
 * @returns 413 when creating form field causes form to be too large to be saved in the database
 * @returns 422 when an invalid form field creation is attempted on the form
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const _handleCreateFormField: ControllerHandler<
  { formId: string },
  FormFieldWithId | ErrorDto,
  FieldCreateDto
> = (req, res) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  // Step 1: Retrieve currently logged in user.
  return (
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Retrieve form with write permission check.
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Write,
        }),
      )
      // Step 3: User has permissions, proceed to create form field with provided body.
      .andThen((form) => AdminFormService.createFormField(form, req.body))
      .map((createdFormField) =>
        res.status(StatusCodes.OK).json(createdFormField as FormFieldWithId),
      )
      .mapErr((error) => {
        logger.error({
          message: 'Error occurred when creating form field',
          meta: {
            action: '_handleCreateFormField',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
            createFieldBody: req.body,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * NOTE: Exported for testing.
 * Private handler for POST /forms/:formId/logic
 * @precondition Must be preceded by request validation
 * @security session
 *
 * @returns 200 with created logic object when successfully created
 * @returns 403 when user does not have permissions to create logic
 * @returns 404 when form cannot be found
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const _handleCreateLogic: ControllerHandler<
  { formId: string },
  LogicDto | ErrorDto,
  LogicDto
> = (req, res) => {
  const { formId } = req.params
  const createLogicBody = req.body
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  // Step 1: Retrieve currently logged in user.
  return (
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Retrieve form with write permission check.
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Write,
        }),
      )
      // Step 3: Create form logic
      .andThen((retrievedForm) =>
        AdminFormService.createFormLogic(retrievedForm, createLogicBody),
      )
      .map((createdLogic) =>
        res.status(StatusCodes.OK).json(createdLogic as LogicDto),
      )
      .mapErr((error) => {
        logger.error({
          message: 'Error occurred when creating form logic',
          meta: {
            action: 'handleCreateLogic',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
            createLogicBody,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Shape of request body used for joi validation for create and update logic
 */
const joiLogicBody = {
  logicType: Joi.string()
    .valid(...Object.values(LogicType))
    .required(),
  conditions: Joi.array()
    .items(
      Joi.object({
        field: Joi.string().required(),
        state: Joi.string()
          .valid(...Object.values(LogicConditionState))
          .required(),
        value: Joi.alternatives()
          .try(
            Joi.number(),
            Joi.string(),
            Joi.array().items(Joi.string()),
            Joi.array().items(Joi.number()),
          )
          .required(),
        ifValueType: Joi.string()
          .valid(...Object.values(LogicIfValue))
          .required(),
      }).unknown(true),
    )
    .required(),
  show: Joi.alternatives().conditional('logicType', {
    is: LogicType.ShowFields,
    then: Joi.array().items(Joi.string()).required(),
  }),
  preventSubmitMessage: Joi.alternatives().conditional('logicType', {
    is: LogicType.PreventSubmit,
    then: Joi.string().required(),
  }),
}

/**
 * Handler for POST /forms/:formId/logic
 */
export const handleCreateLogic = [
  celebrate({
    [Segments.BODY]: joiLogicBody,
  }),
  _handleCreateLogic,
] as ControllerHandler[]

/**
 * Handler for DELETE /forms/:formId/logic/:logicId
 * @security session
 *
 * @returns 200 with success message when successfully deleted
 * @returns 403 when user does not have permissions to delete logic
 * @returns 404 when form cannot be found
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const handleDeleteLogic: ControllerHandler<{
  formId: string
  logicId: string
}> = (req, res) => {
  const { formId, logicId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  // Step 1: Retrieve currently logged in user.
  return (
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Retrieve form with write permission check.
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Write,
        }),
      )

      // Step 3: Delete form logic
      .andThen((retrievedForm) =>
        AdminFormService.deleteFormLogic(retrievedForm, logicId),
      )
      .map(() => res.sendStatus(StatusCodes.OK))
      .mapErr((error) => {
        logger.error({
          message: 'Error occurred when deleting form logic',
          meta: {
            action: 'handleDeleteLogic',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
            logicId,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Handler for POST /forms/:formId/fields
 */
export const handleCreateFormField = [
  celebrate({
    [Segments.BODY]: Joi.object({
      // Ensures id is not provided.
      _id: Joi.any().forbidden(),
      globalId: Joi.any().forbidden(),
      fieldType: Joi.string()
        .valid(...Object.values(BasicField))
        .required(),
      title: Joi.string().required(),
      description: Joi.string().allow(''),
      required: Joi.boolean(),
      disabled: Joi.boolean(),
      // Allow other field related key-values to be provided and let the model
      // layer handle the validation.
    }).unknown(true),
  }),
  _handleCreateFormField,
]

/**
 * NOTE: Exported for testing.
 * Private handler for POST /forms/:formId/fields/:fieldId/reorder
 * @precondition Must be preceded by request validation
 * @security session
 *
 * @returns 200 with new ordering of form fields
 * @returns 403 when current user does not have permissions to create a form field
 * @returns 404 when form cannot be found
 * @returns 404 when given fieldId cannot be found in form
 * @returns 410 when reordering form fields for an archived form
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const _handleReorderFormField: ControllerHandler<
  { formId: string; fieldId: string },
  FormFieldDto[] | ErrorDto,
  unknown,
  { to: number }
> = (req, res) => {
  const { formId, fieldId } = req.params
  const { to } = req.query
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  // Step 1: Retrieve currently logged in user.
  return (
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Retrieve form with write permission check.
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Write,
        }),
      )
      // Step 3: User has permissions, proceed to reorder field
      .andThen((form) => AdminFormService.reorderFormField(form, fieldId, to))
      .map((reorderedFormFields) =>
        res.status(StatusCodes.OK).json(reorderedFormFields as FormFieldDto[]),
      )
      .mapErr((error) => {
        logger.error({
          message: 'Error occurred when reordering form field',
          meta: {
            action: '_handleReorderFormField',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
            fieldId,
            reqQuery: req.query,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Handler for POST /forms/:formId/fields/:fieldId/reorder
 */
export const handleReorderFormField = [
  celebrate({
    [Segments.QUERY]: {
      to: Joi.number().min(0).required(),
    },
  }),
  _handleReorderFormField,
] as ControllerHandler[]

/**
 * NOTE: Exported for testing.
 * Private handler for PUT /forms/:formId/logic/:logicId
 * @precondition Must be preceded by request validation
 * @security session
 *
 * @returns 200 with updated logic object when successfully updated
 * @returns 403 when user does not have permissions to update logic
 * @returns 404 when form cannot be found
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const _handleUpdateLogic: ControllerHandler<
  { formId: string; logicId: string },
  LogicDto | ErrorDto,
  LogicDto
> = (req, res) => {
  const { formId, logicId } = req.params
  const updatedLogic = { ...req.body }
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  // Step 1: Retrieve currently logged in user.
  return (
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Retrieve form with write permission check.
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Write,
        }),
      )
      // Step 3: Update form logic
      .andThen((retrievedForm) =>
        AdminFormService.updateFormLogic(retrievedForm, logicId, updatedLogic),
      )
      .map((updatedLogic) =>
        res.status(StatusCodes.OK).json(updatedLogic as LogicDto),
      )
      .mapErr((error) => {
        logger.error({
          message: 'Error occurred when updating form logic',
          meta: {
            action: 'handleUpdateLogic',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
            logicId,
            updatedLogic,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Handler for PUT /forms/:formId/logic/:logicId
 */
export const handleUpdateLogic = [
  celebrate(
    {
      [Segments.BODY]: Joi.object({
        // Ensures given logic is same as accessed logic
        _id: Joi.string().valid(Joi.ref('$params.logicId')).required(),
        ...joiLogicBody,
      }),
    },
    undefined,
    // Required so req.body can be validated against values in req.params.
    // See https://github.com/arb/celebrate#celebrateschema-joioptions-opts.
    { reqContext: true },
  ),
  _handleUpdateLogic,
] as ControllerHandler[]

/**
 * Handler for DELETE /forms/:formId/fields/:fieldId
 * @security session
 *
 * @returns 204 when deletion is successful
 * @returns 403 when current user does not have permissions to delete form field
 * @returns 404 when form cannot be found
 * @returns 404 when form field to delete cannot be found
 * @returns 410 when deleting form field of an archived form
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs during deletion
 */
export const handleDeleteFormField: ControllerHandler<
  { formId: string; fieldId: string },
  ErrorDto | void
> = (req, res) => {
  const { formId, fieldId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  return (
    // Step 1: Retrieve currently logged in user.
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Retrieve form with write permission check.
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Write,
        }),
      )
      // Step 3: Delete form field.
      .andThen((form) => AdminFormService.deleteFormField(form, fieldId))
      .map(() => res.sendStatus(StatusCodes.NO_CONTENT))
      .mapErr((error) => {
        logger.error({
          message: 'Error occurred when deleting form field',
          meta: {
            action: 'handleDeleteFormField',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
            fieldId,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * NOTE: Exported for testing.
 * Private handler for PUT /forms/:formId/end-page
 * @precondition Must be preceded by request validation
 * @security session
 *
 * @returns 200 with updated end page
 * @returns 403 when current user does not have permissions to update the end page
 * @returns 404 when form cannot be found
 * @returns 410 when updating the end page for an archived form
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const _handleUpdateEndPage: ControllerHandler<
  { formId: string },
  IFormDocument['endPage'] | ErrorDto,
  EndPageUpdateDto
> = (req, res) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  // Step 1: Retrieve currently logged in user.
  return (
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Retrieve form with write permission check.
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Write,
        }),
      )
      // Step 3: User has permissions, proceed to allow updating of end page
      .andThen(() => AdminFormService.updateEndPage(formId, req.body))
      .map((updatedEndPage) => res.status(StatusCodes.OK).json(updatedEndPage))
      .mapErr((error) => {
        logger.error({
          message: 'Error occurred when updating end page',
          meta: {
            action: '_handleUpdateEndPage',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
            body: req.body,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Handler for PUT /forms/:formId/end-page
 */
export const handleUpdateEndPage = [
  celebrate({
    [Segments.BODY]: Joi.object({
      title: Joi.string(),
      paragraph: Joi.string().allow(''),
      buttonLink: Joi.string().uri().allow(''),
      buttonText: Joi.string().allow(''),
      // TODO(#1895): Remove when deprecated `buttons` key is removed from all forms in the database
    }).unknown(true),
  }),
  _handleUpdateEndPage,
] as ControllerHandler[]

/**
 * Handler for GET /admin/forms/:formId/fields/:fieldId
 * @security session
 *
 * @returns 200 with form field when retrieval is successful
 * @returns 403 when current user does not have permissions to retrieve form field
 * @returns 404 when form cannot be found
 * @returns 404 when form field cannot be found
 * @returns 410 when retrieving form field of an archived form
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const handleGetFormField: ControllerHandler<
  {
    formId: string
    fieldId: string
  },
  ErrorDto | FormFieldDto
> = (req, res) => {
  const { formId, fieldId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  return (
    // Step 1: Retrieve currently logged in user.
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Retrieve form with read permission check.
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Read,
        }),
      )
      .andThen((form) => AdminFormService.getFormField(form, fieldId))
      .map((formField) =>
        res.status(StatusCodes.OK).json(formField as FormFieldDto),
      )
      .mapErr((error) => {
        logger.error({
          message: 'Error occurred when retrieving form field',
          meta: {
            action: 'handleGetFormField',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
            fieldId,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * NOTE: Exported for testing.
 * Private handler for PUT /api/v3/admin/forms/:formId/collaborators
 * @precondition Must be preceded by request validation
 * @security session
 *
 * @returns 200 with updated collaborators and permissions
 * @returns 403 when current user does not havße permissions to update the collaborators
 * @returns 404 when form cannot be found
 * @returns 410 when updating collaborators for an archived form
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const _handleUpdateCollaborators: ControllerHandler<
  { formId: string },
  PermissionsUpdateDto | ErrorDto,
  PermissionsUpdateDto
> = (req, res) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id
  // Step 1: Get the form after permission checks
  return (
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Retrieve form with write permission check.
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Write,
        }),
      )
      // Step 2: Update the form collaborators
      .andThen((form) =>
        AdminFormService.updateFormCollaborators(form, req.body),
      )
      .map((updatedCollaborators) =>
        res.status(StatusCodes.OK).json(updatedCollaborators),
      )
      .mapErr((error) => {
        logger.error({
          message: 'Error occurred when updating collaborators',
          meta: {
            action: '_handleUpdateCollaborators',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
            formCollaborators: req.body,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Handler for PUT /api/v3/admin/forms/:formId/collaborators
 */
export const handleUpdateCollaborators = [
  celebrate({
    [Segments.BODY]: Joi.array().items(
      Joi.object({
        email: Joi.string()
          .required()
          .email()
          .message('Please enter a valid email'),
        write: Joi.bool().optional(),
        _id: Joi.string().optional(),
      }),
    ),
  }),
  _handleUpdateCollaborators,
] as ControllerHandler[]

/**
 * Handler for DELETE /api/v3/admin/forms/:formId/collaborators/self
 * @precondition Must be preceded by request validation
 * @security session
 *
 * @returns 200 with updated collaborators and permissions
 * @returns 403 when current user does not have permissions to remove themselves from the collaborators list
 * @returns 404 when form cannot be found
 * @returns 410 when updating collaborators for an archived form
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const handleRemoveSelfFromCollaborators: ControllerHandler<
  { formId: string },
  PermissionsUpdateDto | ErrorDto
> = (req, res) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id
  let currentUserEmail = ''
  // Step 1: Get the form after permission checks
  return (
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) => {
        // Step 2: Retrieve form with read permission check, since we are only removing the user themselves
        currentUserEmail = user.email
        return AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Read,
        })
      })
      // Step 3: Update the form collaborators
      .andThen((form) => {
        const updatedPermissionList = form.permissionList.filter(
          (user) => user.email.toLowerCase() !== currentUserEmail.toLowerCase(),
        )
        return AdminFormService.updateFormCollaborators(
          form,
          updatedPermissionList,
        )
      })
      .map((updatedCollaborators) =>
        res.status(StatusCodes.OK).json(updatedCollaborators),
      )
      .mapErr((error) => {
        logger.error({
          message: 'Error occurred when updating collaborators',
          meta: {
            action: 'handleRemoveSelfFromCollaborators',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
            formCollaborators: req.body,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * NOTE: Exported for testing.
 * Private handler for PUT /forms/:formId/start-page
 * @precondition Must be preceded by request validation
 * @security session
 *
 * @returns 200 with updated start page
 * @returns 403 when current user does not have permissions to update the start page
 * @returns 404 when form cannot be found
 * @returns 410 when updating the start page for an archived form
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
export const _handleUpdateStartPage: ControllerHandler<
  { formId: string },
  IFormDocument['startPage'] | ErrorDto,
  StartPageUpdateDto
> = (req, res) => {
  const { formId } = req.params
  const sessionUserId = (req.session as Express.AuthedSession).user._id

  // Step 1: Retrieve currently logged in user.
  return (
    UserService.getPopulatedUserById(sessionUserId)
      .andThen((user) =>
        // Step 2: Retrieve form with write permission check.
        AuthService.getFormAfterPermissionChecks({
          user,
          formId,
          level: PermissionLevel.Write,
        }),
      )
      // Step 3: User has permissions, proceed to allow updating of start page
      .andThen(() => AdminFormService.updateStartPage(formId, req.body))
      .map((updatedStartPage) =>
        res.status(StatusCodes.OK).json(updatedStartPage),
      )
      .mapErr((error) => {
        logger.error({
          message: 'Error occurred when updating start page',
          meta: {
            action: '_handleUpdateStartPage',
            ...createReqMeta(req),
            userId: sessionUserId,
            formId,
            body: req.body,
          },
          error,
        })
        const { errorMessage, statusCode } = mapRouteError(error)
        return res.status(statusCode).json({ message: errorMessage })
      })
  )
}

/**
 * Handler for PUT /forms/:formId/start-page
 */
export const handleUpdateStartPage = [
  celebrate({
    [Segments.BODY]: {
      paragraph: Joi.string().allow('').optional(),
      estTimeTaken: Joi.number().min(1).max(1000).required(),
      colorTheme: Joi.string()
        .valid(...Object.values(Colors))
        .required(),
      logo: Joi.object({
        state: Joi.string().valid(...Object.values(FormLogoState)),
        fileId: Joi.when('state', {
          is: FormLogoState.Custom,
          then: Joi.string().required(),
          otherwise: Joi.any().forbidden(),
        }),
        fileName: Joi.when('state', {
          is: FormLogoState.Custom,
          then: Joi.string()
            // Captures only the extensions below regardless of their case
            // Refer to https://regex101.com/ with the below regex for a full explanation
            .pattern(/\.(gif|png|jpeg|jpg)$/im)
            .required(),
          otherwise: Joi.any().forbidden(),
        }),
        fileSizeInBytes: Joi.when('state', {
          is: FormLogoState.Custom,
          then: Joi.number().max(MAX_UPLOAD_FILE_SIZE).required(),
          otherwise: Joi.any().forbidden(),
        }),
      }).required(),
    },
  }),
  _handleUpdateStartPage,
] as ControllerHandler[]
