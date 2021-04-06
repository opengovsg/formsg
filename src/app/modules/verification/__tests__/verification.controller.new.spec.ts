import { ObjectId } from 'bson'
import { Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import mongoose from 'mongoose'
import { errAsync, okAsync } from 'neverthrow'
import { mocked } from 'ts-jest/utils'

import { MailSendError } from 'src/app/services/mail/mail.errors'
import {
  InvalidNumberError,
  SmsSendError,
} from 'src/app/services/sms/sms.errors'
import { HashingError } from 'src/app/utils/hash'
import * as OtpUtils from 'src/app/utils/otp'
import { IVerificationSchema } from 'src/types'

import dbHandler from 'tests/unit/backend/helpers/jest-db'

import expressHandler from '../../../../../tests/unit/backend/helpers/jest-express'
import { DatabaseError, MalformedParametersError } from '../../core/core.errors'
import { FormNotFoundError } from '../../form/form.errors'
import * as VerificationController from '../verification.controller'
import {
  FieldNotFoundInTransactionError,
  NonVerifiedFieldTypeError,
  TransactionExpiredError,
  TransactionNotFoundError,
  WaitForOtpError,
} from '../verification.errors'
import { VerificationFactory } from '../verification.factory'
import getVerificationModel from '../verification.model'

import { MOCK_HASHED_OTP } from './verification.test.helpers'

const VerificationModel = getVerificationModel(mongoose)

jest.mock('../verification.factory')
const MockVerificationFactory = mocked(VerificationFactory, true)
jest.mock('src/app/utils/otp')
const MockOtpUtils = mocked(OtpUtils, true)

describe('Verification controller', () => {
  const MOCK_FORM_ID = new ObjectId().toHexString()
  const MOCK_TRANSACTION_ID = new ObjectId().toHexString()
  const MOCK_FIELD_ID = new ObjectId().toHexString()
  const MOCK_ANSWER = 'answer'
  const MOCK_OTP = 'otp'
  let mockTransaction: IVerificationSchema
  let mockRes: Response

  beforeAll(async () => {
    await dbHandler.connect()
    mockTransaction = await VerificationModel.create({
      _id: MOCK_TRANSACTION_ID,
      formId: MOCK_FORM_ID,
      expireAt: new Date(),
      fields: [],
    })
  })

  beforeEach(() => {
    mockRes = expressHandler.mockResponse()
  })

  afterEach(() => jest.resetAllMocks())

  afterAll(async () => {
    // mockTransaction is reused throughout the tests
    await dbHandler.clearDatabase()
    await dbHandler.closeDatabase()
  })

  describe('handleCreateTransaction', () => {
    const MOCK_REQ = expressHandler.mockRequest<
      never,
      { formId: string },
      never
    >({
      body: { formId: MOCK_FORM_ID },
    })

    it('should return transaction when parameters are valid', async () => {
      MockVerificationFactory.createTransaction.mockReturnValueOnce(
        okAsync(mockTransaction),
      )

      await VerificationController.handleCreateTransaction(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(MockVerificationFactory.createTransaction).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.CREATED)
      expect(mockRes.json).toHaveBeenCalledWith({
        transactionId: mockTransaction._id,
        expireAt: mockTransaction.expireAt,
      })
    })

    it('should return 200 with empty object when transaction is not created', async () => {
      MockVerificationFactory.createTransaction.mockReturnValueOnce(
        okAsync(null),
      )
      await VerificationController.handleCreateTransaction(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )
      expect(MockVerificationFactory.createTransaction).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(mockRes.json).toHaveBeenCalledWith({})
    })

    it('should return 404 when form is not found', async () => {
      MockVerificationFactory.createTransaction.mockReturnValueOnce(
        errAsync(new FormNotFoundError()),
      )

      await VerificationController.handleCreateTransaction(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(MockVerificationFactory.createTransaction).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 500 when database error occurs', async () => {
      MockVerificationFactory.createTransaction.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )

      await VerificationController.handleCreateTransaction(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(MockVerificationFactory.createTransaction).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR,
      )
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })
  })

  describe('handleGetTransactionMetadata', () => {
    const MOCK_REQ = expressHandler.mockRequest({
      params: { transactionId: MOCK_TRANSACTION_ID },
    })

    it('should return metadata when parameters are valid', async () => {
      const transactionPublicView = mockTransaction.getPublicView()
      MockVerificationFactory.getTransactionMetadata.mockReturnValueOnce(
        okAsync(transactionPublicView),
      )

      await VerificationController.handleGetTransactionMetadata(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(
        MockVerificationFactory.getTransactionMetadata,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID)
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(mockRes.json).toHaveBeenCalledWith(transactionPublicView)
    })

    it('should return 404 when transaction is not found', async () => {
      MockVerificationFactory.getTransactionMetadata.mockReturnValueOnce(
        errAsync(new TransactionNotFoundError()),
      )

      await VerificationController.handleGetTransactionMetadata(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(
        MockVerificationFactory.getTransactionMetadata,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID)
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 500 when database error occurs', async () => {
      MockVerificationFactory.getTransactionMetadata.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )

      await VerificationController.handleGetTransactionMetadata(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(
        MockVerificationFactory.getTransactionMetadata,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID)
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR,
      )
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })
  })

  describe('handleResetField', () => {
    const MOCK_REQ = expressHandler.mockRequest({
      body: { fieldId: MOCK_FIELD_ID },
      params: { transactionId: MOCK_TRANSACTION_ID },
    })

    it('should correctly call service when params are valid', async () => {
      MockVerificationFactory.resetFieldForTransaction.mockReturnValueOnce(
        okAsync(mockTransaction),
      )

      await VerificationController.handleResetField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(
        MockVerificationFactory.resetFieldForTransaction,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID, MOCK_FIELD_ID)
      expect(mockRes.sendStatus).toHaveBeenCalledWith(StatusCodes.OK)
    })

    it('should return 404 when transaction is not found', async () => {
      MockVerificationFactory.resetFieldForTransaction.mockReturnValueOnce(
        errAsync(new TransactionNotFoundError()),
      )

      await VerificationController.handleResetField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(
        MockVerificationFactory.resetFieldForTransaction,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID, MOCK_FIELD_ID)
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 404 when field is not found', async () => {
      MockVerificationFactory.resetFieldForTransaction.mockReturnValueOnce(
        errAsync(new FieldNotFoundInTransactionError()),
      )

      await VerificationController.handleResetField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(
        MockVerificationFactory.resetFieldForTransaction,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID, MOCK_FIELD_ID)
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 400 when transaction has expired', async () => {
      MockVerificationFactory.resetFieldForTransaction.mockReturnValueOnce(
        errAsync(new TransactionExpiredError()),
      )

      await VerificationController.handleResetField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(
        MockVerificationFactory.resetFieldForTransaction,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID, MOCK_FIELD_ID)
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 500 when database error occurs', async () => {
      MockVerificationFactory.resetFieldForTransaction.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )

      await VerificationController.handleResetField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(
        MockVerificationFactory.resetFieldForTransaction,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID, MOCK_FIELD_ID)
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR,
      )
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })
  })

  describe('handleGetOtp', () => {
    const MOCK_REQ = expressHandler.mockRequest({
      body: { fieldId: MOCK_FIELD_ID, answer: MOCK_ANSWER },
      params: { transactionId: MOCK_TRANSACTION_ID },
    })

    beforeEach(() => {
      MockOtpUtils.generateOtpWithHash.mockReturnValueOnce(
        okAsync({
          otp: MOCK_OTP,
          hashedOtp: MOCK_HASHED_OTP,
        }),
      )
      MockVerificationFactory.sendNewOtp.mockReturnValueOnce(
        okAsync(mockTransaction),
      )
    })

    it('should call service correctly when params are valid', async () => {
      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationFactory.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.sendStatus).toHaveBeenCalledWith(StatusCodes.CREATED)
    })

    it('should return 404 when transaction is not found', async () => {
      MockVerificationFactory.sendNewOtp
        .mockReset()
        .mockReturnValueOnce(errAsync(new TransactionNotFoundError()))

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationFactory.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 400 when transaction has expired', async () => {
      MockVerificationFactory.sendNewOtp
        .mockReset()
        .mockReturnValueOnce(errAsync(new TransactionExpiredError()))

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationFactory.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 404 when field ID is not found', async () => {
      MockVerificationFactory.sendNewOtp
        .mockReset()
        .mockReturnValueOnce(errAsync(new FieldNotFoundInTransactionError()))

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationFactory.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 500 when error occurs while hashing', async () => {
      MockOtpUtils.generateOtpWithHash
        .mockReset()
        .mockReturnValueOnce(errAsync(new HashingError()))

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationFactory.sendNewOtp).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR,
      )
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 422 when OTP waiting time has not elapsed', async () => {
      MockVerificationFactory.sendNewOtp
        .mockReset()
        .mockReturnValueOnce(errAsync(new WaitForOtpError()))

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationFactory.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.UNPROCESSABLE_ENTITY,
      )
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 400 when form SMS parameters are malformed', async () => {
      MockVerificationFactory.sendNewOtp
        .mockReset()
        .mockReturnValueOnce(errAsync(new MalformedParametersError('')))

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationFactory.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 400 when SMS sending errors', async () => {
      MockVerificationFactory.sendNewOtp
        .mockReset()
        .mockReturnValueOnce(errAsync(new SmsSendError()))

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationFactory.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 400 when phone number is invalid', async () => {
      MockVerificationFactory.sendNewOtp
        .mockReset()
        .mockReturnValueOnce(errAsync(new InvalidNumberError()))

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationFactory.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 400 when email sending errors', async () => {
      MockVerificationFactory.sendNewOtp
        .mockReset()
        .mockReturnValueOnce(errAsync(new MailSendError()))

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationFactory.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 400 when field type is not verifiable', async () => {
      MockVerificationFactory.sendNewOtp
        .mockReset()
        .mockReturnValueOnce(errAsync(new NonVerifiedFieldTypeError('')))

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationFactory.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 500 when database error occurs', async () => {
      MockVerificationFactory.sendNewOtp
        .mockReset()
        .mockReturnValueOnce(errAsync(new DatabaseError()))

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationFactory.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR,
      )
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })
  })
})