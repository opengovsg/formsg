import { Request, RequestHandler } from 'express'
import { ok, okAsync, ResultAsync } from 'neverthrow'

import { AuthType, FieldResponse, IPopulatedEmailForm } from '../../../../types'
import { createLoggerWithLabel } from '../../../config/logger'
import { CaptchaFactory } from '../../../services/captcha/captcha.factory'
import MailService from '../../../services/mail/mail.service'
import { createReqMeta, getRequestIp } from '../../../utils/request'
import * as FormService from '../../form/form.service'
import {
  MYINFO_COOKIE_NAME,
  MYINFO_COOKIE_OPTIONS,
} from '../../myinfo/myinfo.constants'
import { MyInfoFactory } from '../../myinfo/myinfo.factory'
import * as MyInfoUtil from '../../myinfo/myinfo.util'
import { SpcpFactory } from '../../spcp/spcp.factory'
import {
  createCorppassParsedResponses,
  createSingpassParsedResponses,
} from '../../spcp/spcp.util'
import * as EmailSubmissionMiddleware from '../email-submission/email-submission.middleware'
import * as SubmissionService from '../submission.service'

import * as EmailSubmissionService from './email-submission.service'
import { IPopulatedEmailFormWithResponsesAndHash } from './email-submission.types'
import {
  mapAttachmentsFromResponses,
  mapRouteError,
  SubmissionEmailObj,
} from './email-submission.util'

const logger = createLoggerWithLabel(module)

const submitEmailModeForm: RequestHandler<
  { formId: string },
  { message: string; submissionId?: string; spcpSubmissionFailure?: true },
  { responses: FieldResponse[] },
  { captchaResponse?: unknown }
> = async (req, res) => {
  const { formId } = req.params
  const attachments = mapAttachmentsFromResponses(req.body.responses)
  let spcpSubmissionFailure: undefined | true

  const logMeta = {
    action: 'handleEmailSubmission',
    ...createReqMeta(req as Request),
    formId,
  }

  return (
    // Retrieve form
    FormService.retrieveFullFormById(formId)
      .mapErr((error) => {
        logger.error({
          message: 'Error while retrieving form from database',
          meta: logMeta,
          error,
        })
        return error
      })
      .andThen((form) =>
        EmailSubmissionService.checkFormIsEmailMode(form).mapErr((error) => {
          logger.warn({
            message: 'Attempt to submit non-email-mode form',
            meta: logMeta,
            error,
          })
          return error
        }),
      )
      .andThen((form) =>
        // Check that form is public
        // If it is, pass through and return the original form
        FormService.isFormPublic(form)
          .map(() => form)
          .mapErr((error) => {
            logger.warn({
              message: 'Attempt to submit non-public form',
              meta: logMeta,
              error,
            })
            return error
          }),
      )
      .andThen((form) => {
        // Check the captcha
        if (form.hasCaptcha) {
          return CaptchaFactory.verifyCaptchaResponse(
            req.query.captchaResponse,
            getRequestIp(req as Request),
          )
            .map(() => form)
            .mapErr((error) => {
              logger.error({
                message: 'Error while verifying captcha',
                meta: logMeta,
                error,
              })
              return error
            })
        }
        return okAsync(form) as ResultAsync<IPopulatedEmailForm, never>
      })
      .andThen((form) =>
        // Check that the form has not reached submission limits
        FormService.checkFormSubmissionLimitAndDeactivateForm(form)
          .map(() => form)
          .mapErr((error) => {
            logger.warn({
              message:
                'Attempt to submit form which has just reached submission limits',
              meta: logMeta,
              error,
            })
            return error
          }),
      )
      .andThen((form) =>
        // Validate responses
        EmailSubmissionService.validateAttachments(req.body.responses)
          .andThen(() =>
            SubmissionService.getProcessedResponses(form, req.body.responses),
          )
          .map((parsedResponses) => ({ parsedResponses, form }))
          .mapErr((error) => {
            logger.error({
              message: 'Error processing responses',
              meta: logMeta,
              error,
            })
            return error
          }),
      )
      .andThen(({ parsedResponses, form }) => {
        const { authType } = form
        switch (authType) {
          case AuthType.CP:
            return SpcpFactory.extractJwt(req.cookies, authType)
              .asyncAndThen((jwt) => SpcpFactory.extractCorppassJwtPayload(jwt))
              .map<IPopulatedEmailFormWithResponsesAndHash>((jwt) => ({
                form,
                parsedResponses: [
                  ...parsedResponses,
                  ...createCorppassParsedResponses(jwt.userName, jwt.userInfo),
                ],
              }))
              .mapErr((error) => {
                spcpSubmissionFailure = true
                logger.error({
                  message: 'Failed to verify Corppass JWT with auth client',
                  meta: logMeta,
                  error,
                })
                return error
              })
          case AuthType.SP:
            return SpcpFactory.extractJwt(req.cookies, authType)
              .asyncAndThen((jwt) => SpcpFactory.extractSingpassJwtPayload(jwt))
              .map<IPopulatedEmailFormWithResponsesAndHash>((jwt) => ({
                form,
                parsedResponses: [
                  ...parsedResponses,
                  ...createSingpassParsedResponses(jwt.userName),
                ],
              }))
              .mapErr((error) => {
                spcpSubmissionFailure = true
                logger.error({
                  message: 'Failed to verify Singpass JWT with auth client',
                  meta: logMeta,
                  error,
                })
                return error
              })
          case AuthType.MyInfo:
            return MyInfoUtil.extractMyInfoCookie(req.cookies)
              .andThen(MyInfoUtil.extractAccessTokenFromCookie)
              .andThen((accessToken) =>
                MyInfoFactory.extractUinFin(accessToken),
              )
              .asyncAndThen((uinFin) =>
                MyInfoFactory.fetchMyInfoHashes(uinFin, formId)
                  .andThen((hashes) =>
                    MyInfoFactory.checkMyInfoHashes(parsedResponses, hashes),
                  )
                  .map<IPopulatedEmailFormWithResponsesAndHash>(
                    (hashedFields) => ({
                      form,
                      hashedFields,
                      parsedResponses: [
                        ...parsedResponses,
                        ...createSingpassParsedResponses(uinFin),
                      ],
                    }),
                  ),
              )
              .mapErr((error) => {
                spcpSubmissionFailure = true
                logger.error({
                  message: 'Error verifying MyInfo hashes',
                  meta: logMeta,
                  error,
                })
                return error
              })
          default:
            return ok<IPopulatedEmailFormWithResponsesAndHash, never>({
              form,
              parsedResponses,
            })
        }
      })
      .andThen(({ form, parsedResponses, hashedFields }) => {
        // Create data for response email as well as email confirmation
        const emailData = new SubmissionEmailObj(
          parsedResponses,
          hashedFields,
          form.authType,
        )

        // Save submission to database
        return EmailSubmissionService.hashSubmission(
          emailData.formData,
          attachments,
        )
          .andThen((submissionHash) =>
            EmailSubmissionService.saveSubmissionMetadata(form, submissionHash),
          )
          .map((submission) => ({
            form,
            parsedResponses,
            submission,
            emailData,
          }))
          .mapErr((error) => {
            logger.error({
              message: 'Error while saving metadata to database',
              meta: logMeta,
              error,
            })
            return error
          })
      })
      .andThen(({ form, parsedResponses, submission, emailData }) => {
        const logMetaWithSubmission = {
          ...logMeta,
          submissionId: submission._id,
        }

        logger.info({
          message: 'Sending admin mail',
          meta: logMetaWithSubmission,
        })

        // Send response to admin
        // NOTE: This should short circuit in the event of an error.
        // This is why sendSubmissionToAdmin is separated from sendEmailConfirmations in 2 blocks
        return MailService.sendSubmissionToAdmin({
          replyToEmails: EmailSubmissionService.extractEmailAnswers(
            parsedResponses,
          ),
          form,
          submission,
          attachments,
          dataCollationData: emailData.dataCollationData,
          formData: emailData.formData,
        })
          .map(() => ({
            form,
            parsedResponses,
            submission,
            emailData,
            logMetaWithSubmission,
          }))
          .mapErr((error) => {
            logger.error({
              message: 'Error sending submission to admin',
              meta: logMetaWithSubmission,
              error,
            })
            return error
          })
      })
      .map(
        ({
          form,
          parsedResponses,
          submission,
          emailData,
          logMetaWithSubmission,
        }) => {
          // Send email confirmations
          void SubmissionService.sendEmailConfirmations({
            form,
            parsedResponses,
            submission,
            attachments,
            autoReplyData: emailData.autoReplyData,
          }).mapErr((error) => {
            // NOTE: MyInfo access token is not cleared here.
            // This is because if the reason for failure is not on the users' end,
            // they should not be randomly signed out.
            logger.error({
              message: 'Error while sending email confirmations',
              meta: logMetaWithSubmission,
              error,
            })
          })
          // MyInfo access token is single-use, so clear it
          return res
            .clearCookie(MYINFO_COOKIE_NAME, MYINFO_COOKIE_OPTIONS)
            .json({
              // Return the reply early to the submitter
              message: 'Form submission successful.',
              submissionId: submission.id,
            })
        },
      )
      .mapErr((error) => {
        const { errorMessage, statusCode } = mapRouteError(error)
        return res
          .status(statusCode)
          .json({ message: errorMessage, spcpSubmissionFailure })
      })
  )
}

export const handleEmailSubmission = [
  EmailSubmissionMiddleware.receiveEmailSubmission,
  EmailSubmissionMiddleware.validateResponseParams,
  submitEmailModeForm,
] as RequestHandler[]
