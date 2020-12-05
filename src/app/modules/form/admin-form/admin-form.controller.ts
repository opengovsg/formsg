import { RequestHandler } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { StatusCodes } from 'http-status-codes'
import JSONStream from 'JSONStream'

import { createLoggerWithLabel } from '../../../../config/logger'
import { AuthType, WithForm } from '../../../../types'
import { createReqMeta } from '../../../utils/request'
import * as AuthService from '../../auth/auth.service'
import * as FeedbackService from '../../feedback/feedback.service'
import * as SubmissionService from '../../submission/submission.service'
import * as UserService from '../../user/user.service'

import {
  archiveForm,
  createPresignedPostForImages,
  createPresignedPostForLogos,
  getDashboardForms,
  getMockSpcpLocals,
} from './admin-form.service'
import { PermissionLevel } from './admin-form.types'
import { mapRouteError } from './admin-form.utils'

const logger = createLoggerWithLabel(module)

/**
 * Handler for GET /adminform endpoint.
 * @security session
 *
 * @returns 200 with list of forms user can access when list is retrieved successfully
 * @returns 422 when user of given id cannnot be found in the database
 * @returns 500 when database errors occur
 */
export const handleListDashboardForms: RequestHandler = async (req, res) => {
  const authedUserId = (req.session as Express.AuthedSession).user._id
  const dashboardResult = await getDashboardForms(authedUserId)

  if (dashboardResult.isErr()) {
    const { error } = dashboardResult
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
  }

  // Success.
  return res.json(dashboardResult.value)
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
export const handleGetAdminForm: RequestHandler<{ formId: string }> = (
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
 * Handler for POST /:formId([a-fA-F0-9]{24})/adminform/images.
 * @security session
 *
 * @returns 200 with presigned POST object
 * @returns 400 when error occurs whilst creating presigned POST object
 */
export const handleCreatePresignedPostForImages: RequestHandler<
  ParamsDictionary,
  unknown,
  {
    fileId: string
    fileMd5Hash: string
    fileType: string
  }
> = async (req, res) => {
  const { fileId, fileMd5Hash, fileType } = req.body

  return createPresignedPostForImages({ fileId, fileMd5Hash, fileType })
    .map((presignedPost) => res.json(presignedPost))
    .mapErr((error) => {
      logger.error({
        message: 'Presigning post data encountered an error',
        meta: {
          action: 'handleCreatePresignedPostForImages',
          ...createReqMeta(req),
        },
        error,
      })

      const { statusCode, errorMessage } = mapRouteError(error)
      return res.status(statusCode).json({ message: errorMessage })
    })
}

/**
 * Handler for POST /:formId([a-fA-F0-9]{24})/adminform/logos.
 * @security session
 *
 * @returns 200 with presigned POST object
 * @returns 400 when error occurs whilst creating presigned POST object
 */
export const handleCreatePresignedPostForLogos: RequestHandler<
  ParamsDictionary,
  unknown,
  {
    fileId: string
    fileMd5Hash: string
    fileType: string
  }
> = async (req, res) => {
  const { fileId, fileMd5Hash, fileType } = req.body

  return createPresignedPostForLogos({ fileId, fileMd5Hash, fileType })
    .map((presignedPost) => res.json(presignedPost))
    .mapErr((error) => {
      logger.error({
        message: 'Presigning post data encountered an error',
        meta: {
          action: 'handleCreatePresignedPostForLogos',
          ...createReqMeta(req),
        },
        error,
      })

      const { statusCode, errorMessage } = mapRouteError(error)
      return res.status(statusCode).json({ message: errorMessage })
    })
}

/**
 * Handler for GET /{formId}/adminform/submissions/count.
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
export const handleCountFormSubmissions: RequestHandler<
  { formId: string },
  unknown,
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

/**
 * Allow submission in preview without Spcp authentication by providing default values
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} next - the next expressjs callback
 */
export const passThroughSpcp: RequestHandler = (req, res, next) => {
  const { authType } = (req as WithForm<typeof req>).form
  if (authType === AuthType.SP || authType === AuthType.CP) {
    res.locals = {
      ...res.locals,
      ...getMockSpcpLocals(
        authType,
        (req as WithForm<typeof req>).form.form_fields,
      ),
    }
  }
  return next()
}

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
export const handleCountFormFeedback: RequestHandler<{
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
export const handleStreamFormFeedback: RequestHandler<{
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
export const handleGetFormFeedbacks: RequestHandler<{
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
          action: 'handleGetFormFeedbacks',
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
export const handleArchiveForm: RequestHandler<{ formId: string }> = async (
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
      .andThen((formToArchive) => archiveForm(formToArchive))
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
