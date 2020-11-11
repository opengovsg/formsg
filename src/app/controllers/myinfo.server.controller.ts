// TODO (#144): move these into their respective controllers when
// those controllers are being refactored.
// A services module should not contain a controller.
import { RequestHandler } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { StatusCodes } from 'http-status-codes'

import { ProcessedFieldResponse } from 'src/app/modules/submission/submission.types'

import { createLoggerWithLabel } from '../../config/logger'
import {
  AuthType,
  IPopulatedForm,
  MyInfoAttribute,
  SpcpSession,
} from '../../types'
import { MyInfoFactory } from '../services/myinfo/myinfo.factory'
import {
  extractRequestedAttributes,
  mapVerifyMyInfoError,
} from '../services/myinfo/myinfo.util'
import { createReqMeta } from '../utils/request'

const logger = createLoggerWithLabel(module)

type MyInfoReq<T> = T & {
  form: IPopulatedForm
}
type ResWithSpcpSession<T> = T & {
  locals: { spcpSession?: SpcpSession }
}
type ResWithUinFin<T> = T & {
  uinFin?: string
}
type ResWithHashedFields<T> = T & {
  locals: { hashedFields?: Set<MyInfoAttribute> }
}

export const addMyInfo: RequestHandler<ParamsDictionary> = async (
  req,
  res,
  next,
) => {
  // TODO (#42): add proper types here when migrating away from middleware pattern
  const form = (req as MyInfoReq<typeof req>).form.toJSON()
  const uinFin = (res as ResWithSpcpSession<typeof res>).locals.spcpSession
    ?.userName
  const { esrvcId, authType, form_fields: formFields, _id: formId } = form

  // Early return if nothing needs to be done.
  const requestedAttributes = extractRequestedAttributes(formFields)
  if (!uinFin || authType !== AuthType.SP || requestedAttributes.length === 0) {
    return next()
  }

  // Step 1: Fetch the data from MyInfo server
  MyInfoFactory.fetchMyInfoPersonData({
    uinFin,
    requestedAttributes,
    singpassEserviceId: esrvcId,
  })
    // Step 2: Prefill the fields
    .andThen((myInfoData) =>
      MyInfoFactory.prefillMyInfoFields(myInfoData, formFields),
    )
    // Step 3: Hash the values and save them
    .andThen((prefilledFields) => {
      form.form_fields = prefilledFields
      ;(req as MyInfoReq<typeof req>).form = form
      return MyInfoFactory.saveMyInfoHashes(uinFin, formId, prefilledFields)
    })
    .map(() => next())
    .mapErr((error) => {
      logger.error({
        message: error.message,
        meta: {
          action: 'addMyInfo',
          ...createReqMeta(req),
          formId,
          esrvcId,
        },
        error,
      })
      res.locals.myInfoError = true
      return next()
    })
}

export const verifyMyInfoVals: RequestHandler<
  ParamsDictionary,
  unknown,
  { parsedResponses: ProcessedFieldResponse[] }
> = async (req, res, next) => {
  // TODO (#42): add proper types here when migrating away from middleware pattern
  const { authType, _id: formId, form_fields: formFields } = (req as MyInfoReq<
    typeof req
  >).form.toJSON()
  const uinFin = (res as ResWithUinFin<typeof res>).locals.uinFin
  const requestedAttributes = extractRequestedAttributes(formFields)
  if (authType !== AuthType.SP || requestedAttributes.length === 0) {
    return next()
  } else if (!uinFin) {
    return res.status(StatusCodes.UNAUTHORIZED).send({
      message: 'Please log in to SingPass and try again.',
      spcpSubmissionFailure: true,
    })
  }
  MyInfoFactory.fetchMyInfoHashes(uinFin, formId)
    .andThen((hashes) =>
      MyInfoFactory.checkMyInfoHashes(req.body.parsedResponses, hashes),
    )
    .map((hashedFields) => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;(res as ResWithHashedFields<
        typeof res
      >).locals.hashedFields = hashedFields
      return next()
    })
    .mapErr((error) => {
      logger.error({
        message: 'Error verifying MyInfo hashes',
        meta: {
          action: 'verifyMyInfoVals',
          ...createReqMeta(req),
          formId,
        },
      })
      const { statusCode, errorMessage } = mapVerifyMyInfoError(error)
      return res.status(statusCode).send({
        message: errorMessage,
        spcpSubmissionFailure: true,
      })
    })
}
