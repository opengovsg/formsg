import { RequestHandler } from 'express'
import { StatusCodes } from 'http-status-codes'

import { createLoggerWithLabel } from '../../../config/logger'
import { SALT_ROUNDS } from '../../../shared/util/verification'
import { PublicTransaction } from '../../../types'
import { generateOtpWithHash } from '../../utils/otp'

import { VerificationFactory } from './verification.factory'
import { Transaction } from './verification.types'
import { mapRouteError } from './verification.util'

const logger = createLoggerWithLabel(module)

/**
 * When a form is loaded publicly, a transaction is created, and populated with the field ids of fields that are verifiable.
 * If no fields are verifiable, then it did not create a transaction and returns an empty object.
 * @param req
 * @param res
 * @returns 201 - transaction is created
 * @returns 200 - transaction was not created as no fields were verifiable for the form
 */
export const handleCreateTransaction: RequestHandler<
  never,
  Transaction | { message: string },
  { formId: string }
> = async (req, res) => {
  const { formId } = req.body
  const logMeta = {
    action: 'handleCreateTransaction',
    formId,
  }
  return VerificationFactory.createTransaction(formId)
    .map((transaction) => {
      return transaction
        ? res.status(StatusCodes.CREATED).json({
            expireAt: transaction.expireAt,
            transactionId: transaction._id,
          })
        : res.status(StatusCodes.OK).json({})
    })
    .mapErr((error) => {
      logger.error({
        message: 'Error creating transaction',
        meta: logMeta,
        error,
      })
      const { errorMessage, statusCode } = mapRouteError(error)
      return res.status(statusCode).json({ message: errorMessage })
    })
}

/**
 * Returns a transaction's id and expiry time if it exists
 * @param req
 * @param res
 */
export const handleGetTransactionMetadata: RequestHandler<
  {
    transactionId: string
  },
  PublicTransaction | { message: string }
> = async (req, res) => {
  const { transactionId } = req.params
  const logMeta = {
    action: 'handleGetTransactionMetadata',
    transactionId,
  }
  return VerificationFactory.getTransactionMetadata(transactionId)
    .map((publicTransaction) =>
      res.status(StatusCodes.OK).json(publicTransaction),
    )
    .mapErr((error) => {
      logger.error({
        message: 'Error retrieving transaction metadata',
        meta: logMeta,
        error,
      })
      const { errorMessage, statusCode } = mapRouteError(error)
      return res.status(statusCode).json({ message: errorMessage })
    })
}

/**
 *  When user changes the input value in the verifiable field,
 *  we reset the field in the transaction, removing the previously saved signature.
 * @param req
 * @param res
 */
export const handleResetField: RequestHandler<
  { transactionId: string },
  { message: string },
  { fieldId: string }
> = async (req, res) => {
  const { transactionId } = req.params
  const { fieldId } = req.body
  const logMeta = {
    action: 'handleResetField',
    transactionId,
    fieldId,
  }
  return VerificationFactory.resetFieldForTransaction(transactionId, fieldId)
    .map(() => res.sendStatus(StatusCodes.OK))
    .mapErr((error) => {
      logger.error({
        message: 'Error resetting field in transaction',
        meta: logMeta,
        error,
      })
      const { errorMessage, statusCode } = mapRouteError(error)
      return res.status(statusCode).json({ message: errorMessage })
    })
}

/**
 * When user requests to verify a field, an otp is generated.
 * The current answer is signed, and the signature is also saved in the transaction, with the field id as the key.
 * @param req
 * @param res
 */
export const handleGetOtp: RequestHandler<
  { transactionId: string },
  { message: string },
  { answer: string; fieldId: string }
> = async (req, res) => {
  const { transactionId } = req.params
  const { answer, fieldId } = req.body
  const logMeta = {
    action: 'handleGetOtp',
    transactionId,
    fieldId,
  }
  return generateOtpWithHash(logMeta, SALT_ROUNDS)
    .andThen(({ otp, hashedOtp }) =>
      VerificationFactory.sendNewOtp({
        fieldId,
        hashedOtp,
        otp,
        recipient: answer,
        transactionId,
      }),
    )
    .map(() => res.sendStatus(StatusCodes.CREATED))
    .mapErr((error) => {
      logger.error({
        message: 'Error creating new OTP',
        meta: logMeta,
        error,
      })
    })
}

/**
 * When user submits their otp for the field, the otp is validated.
 * If it is correct, we return the signature that was saved.
 * This signature will be appended to the response when the form is submitted.
 * @param req
 * @param res
 */
export const handleVerifyOtp: RequestHandler<
  { transactionId: string },
  string | { message: string },
  { otp: string; fieldId: string }
> = async (req, res) => {
  const { transactionId } = req.params
  const { fieldId, otp } = req.body
  const logMeta = {
    action: 'handleVerifyOtp',
    transactionId,
    fieldId,
  }
  return VerificationFactory.verifyOtp(transactionId, fieldId, otp)
    .map((signedData) => res.status(StatusCodes.OK).json(signedData))
    .mapErr((error) => {
      logger.error({
        message: 'Error verifying OTP',
        meta: logMeta,
        error,
      })
      const { statusCode, errorMessage } = mapRouteError(error)
      return res.status(statusCode).json({ message: errorMessage })
    })
}
