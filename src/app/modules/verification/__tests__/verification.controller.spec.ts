import { ObjectId } from 'bson'
import { Request, Response } from 'express'
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
import { WAIT_FOR_OTP_SECONDS } from 'src/shared/util/verification'
import { IFormSchema, IPopulatedForm, IVerificationSchema } from 'src/types'

import dbHandler from 'tests/unit/backend/helpers/jest-db'

import expressHandler from '../../../../../tests/unit/backend/helpers/jest-express'
import { DatabaseError, MalformedParametersError } from '../../core/core.errors'
import * as AdminFormService from '../../form/admin-form/admin-form.service'
import { FormNotFoundError } from '../../form/form.errors'
import * as FormService from '../../form/form.service'
import * as VerificationController from '../verification.controller'
import {
  FieldNotFoundInTransactionError,
  MissingHashDataError,
  NonVerifiedFieldTypeError,
  OtpExpiredError,
  OtpRetryExceededError,
  TransactionExpiredError,
  TransactionNotFoundError,
  WaitForOtpError,
  WrongOtpError,
} from '../verification.errors'
import getVerificationModel from '../verification.model'
import * as VerificationService from '../verification.service'

import {
  generateFieldParams,
  MOCK_HASHED_OTP,
  MOCK_SIGNED_DATA,
} from './verification.test.helpers'

const VerificationModel = getVerificationModel(mongoose)

jest.mock('../verification.service')
const MockVerificationService = mocked(VerificationService, true)
jest.mock('src/app/utils/otp')
const MockOtpUtils = mocked(OtpUtils, true)
jest.mock('../../form/form.service')
const MockFormService = mocked(FormService, true)

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
      MockVerificationService.createTransaction.mockReturnValueOnce(
        okAsync(mockTransaction),
      )

      await VerificationController.handleCreateTransaction(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(MockVerificationService.createTransaction).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.CREATED)
      expect(mockRes.json).toHaveBeenCalledWith({
        transactionId: mockTransaction._id,
        expireAt: mockTransaction.expireAt,
      })
    })

    it('should return 200 with empty object when transaction is not created', async () => {
      MockVerificationService.createTransaction.mockReturnValueOnce(
        okAsync(null),
      )
      await VerificationController.handleCreateTransaction(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )
      expect(MockVerificationService.createTransaction).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(mockRes.json).toHaveBeenCalledWith({})
    })

    it('should return 404 when form is not found', async () => {
      MockVerificationService.createTransaction.mockReturnValueOnce(
        errAsync(new FormNotFoundError()),
      )

      await VerificationController.handleCreateTransaction(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(MockVerificationService.createTransaction).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 500 when database error occurs', async () => {
      MockVerificationService.createTransaction.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )

      await VerificationController.handleCreateTransaction(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(MockVerificationService.createTransaction).toHaveBeenCalledWith(
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

  describe('handleCreateVerificationTransaction', () => {
    const MOCK_REQ = expressHandler.mockRequest({
      params: { formId: MOCK_FORM_ID },
    })

    it('should return transaction when parameters are valid', async () => {
      MockVerificationService.createTransaction.mockReturnValueOnce(
        okAsync(mockTransaction),
      )

      await VerificationController.handleCreateVerificationTransaction(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(MockVerificationService.createTransaction).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.CREATED)
      expect(mockRes.json).toHaveBeenCalledWith({
        transactionId: mockTransaction._id,
        expireAt: mockTransaction.expireAt,
      })
    })

    it('should return 200 with empty object when transaction is not created', async () => {
      MockVerificationService.createTransaction.mockReturnValueOnce(
        okAsync(null),
      )
      await VerificationController.handleCreateVerificationTransaction(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )
      expect(MockVerificationService.createTransaction).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(mockRes.json).toHaveBeenCalledWith({})
    })

    it('should return 404 when form is not found', async () => {
      MockVerificationService.createTransaction.mockReturnValueOnce(
        errAsync(new FormNotFoundError()),
      )

      await VerificationController.handleCreateVerificationTransaction(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(MockVerificationService.createTransaction).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 500 when database error occurs', async () => {
      MockVerificationService.createTransaction.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )

      await VerificationController.handleCreateVerificationTransaction(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(MockVerificationService.createTransaction).toHaveBeenCalledWith(
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

  describe('handleResetField', () => {
    const MOCK_REQ = expressHandler.mockRequest({
      body: { fieldId: MOCK_FIELD_ID },
      params: { transactionId: MOCK_TRANSACTION_ID },
    })

    it('should correctly call service when params are valid', async () => {
      MockVerificationService.resetFieldForTransaction.mockReturnValueOnce(
        okAsync(mockTransaction),
      )

      await VerificationController.handleResetField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(
        MockVerificationService.resetFieldForTransaction,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID, MOCK_FIELD_ID)
      expect(mockRes.sendStatus).toHaveBeenCalledWith(StatusCodes.OK)
    })

    it('should return 404 when transaction is not found', async () => {
      MockVerificationService.resetFieldForTransaction.mockReturnValueOnce(
        errAsync(new TransactionNotFoundError()),
      )

      await VerificationController.handleResetField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(
        MockVerificationService.resetFieldForTransaction,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID, MOCK_FIELD_ID)
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 404 when field is not found', async () => {
      MockVerificationService.resetFieldForTransaction.mockReturnValueOnce(
        errAsync(new FieldNotFoundInTransactionError()),
      )

      await VerificationController.handleResetField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(
        MockVerificationService.resetFieldForTransaction,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID, MOCK_FIELD_ID)
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 400 when transaction has expired', async () => {
      MockVerificationService.resetFieldForTransaction.mockReturnValueOnce(
        errAsync(new TransactionExpiredError()),
      )

      await VerificationController.handleResetField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(
        MockVerificationService.resetFieldForTransaction,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID, MOCK_FIELD_ID)
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 500 when database error occurs', async () => {
      MockVerificationService.resetFieldForTransaction.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )

      await VerificationController.handleResetField(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      expect(
        MockVerificationService.resetFieldForTransaction,
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
      MockOtpUtils.generateOtpWithHash.mockReturnValue(
        okAsync({
          otp: MOCK_OTP,
          hashedOtp: MOCK_HASHED_OTP,
        }),
      )
      MockVerificationService.sendNewOtp.mockReturnValue(
        okAsync(mockTransaction),
      )
    })

    it('should call service correctly when params are valid', async () => {
      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.sendStatus).toHaveBeenCalledWith(StatusCodes.CREATED)
    })

    it('should return 404 when transaction is not found', async () => {
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new TransactionNotFoundError()),
      )

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
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
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new TransactionExpiredError()),
      )

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
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
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new FieldNotFoundInTransactionError()),
      )

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
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
      MockOtpUtils.generateOtpWithHash.mockReturnValueOnce(
        errAsync(new HashingError()),
      )

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR,
      )
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 422 when OTP waiting time has not elapsed', async () => {
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new WaitForOtpError()),
      )

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
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
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new MalformedParametersError('')),
      )

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
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
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new SmsSendError()),
      )

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
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
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new InvalidNumberError()),
      )

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
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
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new MailSendError()),
      )

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
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
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new NonVerifiedFieldTypeError('')),
      )

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
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
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )

      await VerificationController.handleGetOtp(MOCK_REQ, mockRes, jest.fn())

      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
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

  describe('_handleGenerateOtp', () => {
    const MOCK_REQ = expressHandler.mockRequest({
      body: { answer: MOCK_ANSWER },
      params: {
        formId: MOCK_FORM_ID,
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
      },
    })

    const MOCK_FORM = {
      admin: {
        _id: new ObjectId(),
      },
      title: 'i am a form',
      _id: new ObjectId(),
      permissionList: [{ email: 'former@forms.sg' }],
    } as IPopulatedForm

    beforeEach(() => {
      MockFormService.retrieveFormById.mockReturnValue(
        okAsync({} as IFormSchema),
      )
      MockFormService.retrieveFullFormById.mockReturnValueOnce(
        okAsync(MOCK_FORM),
      )

      MockOtpUtils.generateOtpWithHash.mockReturnValue(
        okAsync({
          otp: MOCK_OTP,
          hashedOtp: MOCK_HASHED_OTP,
        }),
      )
      MockVerificationService.sendNewOtp.mockReturnValue(
        okAsync(mockTransaction),
      )
    })

    it('should return 201 when params are valid', async () => {
      // Arrange
      const disableSpy = jest.spyOn(
        AdminFormService,
        'checkFreeSmsSentByAdminAndDeactivateVerification',
      )

      // Act
      await VerificationController._handleGenerateOtp(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.sendStatus).toHaveBeenCalledWith(StatusCodes.CREATED)
      expect(disableSpy).toBeCalledWith(MOCK_FORM)
    })

    it('should return 400 when form SMS parameters are malformed', async () => {
      // Arrange
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new MalformedParametersError('')),
      )
      const expectedResponse = {
        message: 'Sorry, something went wrong. Please refresh and try again.',
      }

      // Act
      await VerificationController._handleGenerateOtp(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 400 when transaction has expired', async () => {
      // Arrange
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new TransactionExpiredError("don't eat expired food")),
      )
      const expectedResponse = {
        message: 'Your session has expired, please refresh and try again.',
      }

      // Act
      await VerificationController._handleGenerateOtp(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 400 when SMS sending errors', async () => {
      // Arrange
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new SmsSendError()),
      )
      const expectedResponse = {
        message: 'Sorry, something went wrong. Please refresh and try again.',
      }

      // Act
      await VerificationController._handleGenerateOtp(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 400 when email sending errors', async () => {
      // Arrange
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new MailSendError()),
      )
      const expectedResponse = {
        message:
          'Sorry, we were unable to send the email out at this time. Please ensure that the email entered is correct. If this problem persists, please refresh and try again later.',
      }

      // Act
      await VerificationController._handleGenerateOtp(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 400 when phone number is invalid', async () => {
      // Arrange
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new InvalidNumberError()),
      )
      const expectedResponse = {
        message:
          'This phone number does not seem to be valid. Please try again with a valid phone number.',
      }

      // Act
      await VerificationController._handleGenerateOtp(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 400 when field type is not verifiable', async () => {
      // Arrange
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new NonVerifiedFieldTypeError('')),
      )
      const expectedResponse = {
        message: 'Sorry, something went wrong. Please refresh and try again.',
      }

      // Act
      await VerificationController._handleGenerateOtp(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 404 when form is not found', async () => {
      // Arrange
      MockFormService.retrieveFormById.mockReturnValueOnce(
        errAsync(new FormNotFoundError()),
      )
      const expectedResponse = {
        message: 'Sorry, something went wrong. Please refresh and try again.',
      }

      // Act
      await VerificationController._handleGenerateOtp(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockOtpUtils.generateOtpWithHash).not.toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 404 when transaction is not found', async () => {
      // Arrange
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new TransactionNotFoundError('wad')),
      )
      const expectedResponse = {
        message: 'Sorry, something went wrong. Please refresh and try again.',
      }

      // Act
      await VerificationController._handleGenerateOtp(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 404 when field ID is not found', async () => {
      // Arrange
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new FieldNotFoundInTransactionError()),
      )
      const expectedResponse = {
        message: 'Sorry, something went wrong. Please refresh and try again.',
      }

      // Act
      await VerificationController._handleGenerateOtp(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 422 when OTP waiting time has not elapsed', async () => {
      // Arrange
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new WaitForOtpError()),
      )
      const expectedResponse = {
        message: `You must wait for ${WAIT_FOR_OTP_SECONDS} seconds between each OTP request.`,
      }

      // Act
      await VerificationController._handleGenerateOtp(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.UNPROCESSABLE_ENTITY,
      )
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 500 when error occurs while hashing', async () => {
      // Arrange
      MockOtpUtils.generateOtpWithHash.mockReturnValueOnce(
        errAsync(new HashingError()),
      )

      // Act
      await VerificationController._handleGenerateOtp(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR,
      )
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 500 when database error occurs', async () => {
      // Arrange
      MockVerificationService.sendNewOtp.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )
      const expectedResponse = {
        message: 'Sorry, something went wrong. Please refresh and try again.',
      }

      // Act
      await VerificationController._handleGenerateOtp(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockOtpUtils.generateOtpWithHash).toHaveBeenCalled()
      expect(MockVerificationService.sendNewOtp).toHaveBeenCalledWith({
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        otp: MOCK_OTP,
        hashedOtp: MOCK_HASHED_OTP,
        recipient: MOCK_ANSWER,
      })
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR,
      )
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })
  })

  describe('handleVerifyOtp', () => {
    let mockReq: Request<
      { transactionId: string },
      string | { message: string },
      { otp: string; fieldId: string }
    >
    let verifyOtpTransaction: IVerificationSchema
    let verifyOtpTransactionId: string
    let otpFieldId: string

    beforeEach(async () => {
      MockVerificationService.verifyOtp.mockReturnValue(
        okAsync(MOCK_SIGNED_DATA),
      )
      verifyOtpTransaction = await VerificationModel.create({
        formId: new ObjectId().toHexString(),
        fields: [
          generateFieldParams({
            signedData: MOCK_SIGNED_DATA,
            hashRetries: 0,
            hashedOtp: MOCK_HASHED_OTP,
            hashCreatedAt: new Date(),
          }),
        ],
      })
      verifyOtpTransactionId = verifyOtpTransaction._id
      otpFieldId = verifyOtpTransaction.fields[0]._id!
      mockReq = expressHandler.mockRequest({
        body: { fieldId: otpFieldId, otp: MOCK_OTP },
        params: { transactionId: verifyOtpTransactionId },
      })
    })

    it('should call service correctly when params are valid', async () => {
      await VerificationController.handleVerifyOtp(mockReq, mockRes, jest.fn())

      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        verifyOtpTransactionId,
        otpFieldId,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(mockRes.json).toHaveBeenCalledWith(MOCK_SIGNED_DATA)
    })

    it('should return 404 when transaction is not found', async () => {
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new TransactionNotFoundError()),
      )

      await VerificationController.handleVerifyOtp(mockReq, mockRes, jest.fn())

      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        verifyOtpTransactionId,
        otpFieldId,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 400 when transaction is expired', async () => {
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new TransactionExpiredError()),
      )

      await VerificationController.handleVerifyOtp(mockReq, mockRes, jest.fn())

      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        verifyOtpTransactionId,
        otpFieldId,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 404 when field is not found in transaction', async () => {
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new FieldNotFoundInTransactionError()),
      )

      await VerificationController.handleVerifyOtp(mockReq, mockRes, jest.fn())

      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        verifyOtpTransactionId,
        otpFieldId,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 400 when hash data is not found', async () => {
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new MissingHashDataError()),
      )

      await VerificationController.handleVerifyOtp(mockReq, mockRes, jest.fn())

      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        verifyOtpTransactionId,
        otpFieldId,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 422 when OTP is expired', async () => {
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new OtpExpiredError()),
      )

      await VerificationController.handleVerifyOtp(mockReq, mockRes, jest.fn())

      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        verifyOtpTransactionId,
        otpFieldId,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.UNPROCESSABLE_ENTITY,
      )
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 422 when OTP max retries are exceeded', async () => {
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new OtpRetryExceededError()),
      )

      await VerificationController.handleVerifyOtp(mockReq, mockRes, jest.fn())

      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        verifyOtpTransactionId,
        otpFieldId,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.UNPROCESSABLE_ENTITY,
      )
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 422 when OTP is wrong', async () => {
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new WrongOtpError()),
      )

      await VerificationController.handleVerifyOtp(mockReq, mockRes, jest.fn())

      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        verifyOtpTransactionId,
        otpFieldId,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.UNPROCESSABLE_ENTITY,
      )
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 500 when error occurs while hashing OTP', async () => {
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new HashingError()),
      )

      await VerificationController.handleVerifyOtp(mockReq, mockRes, jest.fn())

      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        verifyOtpTransactionId,
        otpFieldId,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR,
      )
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })

    it('should return 500 when database error occurs', async () => {
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )

      await VerificationController.handleVerifyOtp(mockReq, mockRes, jest.fn())

      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        verifyOtpTransactionId,
        otpFieldId,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR,
      )
      expect(mockRes.json).toHaveBeenCalledWith({ message: expect.any(String) })
    })
  })

  describe('handleResetFieldVerification', () => {
    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        formId: MOCK_FORM_ID,
      },
    })

    beforeEach(() =>
      MockFormService.retrieveFormById.mockReturnValue(
        okAsync({} as IFormSchema),
      ),
    )

    it('should correctly call service when params are valid', async () => {
      // Arrange
      MockVerificationService.resetFieldForTransaction.mockReturnValueOnce(
        okAsync(mockTransaction),
      )

      // Act
      await VerificationController.handleResetFieldVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(
        MockVerificationService.resetFieldForTransaction,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID, MOCK_FIELD_ID)
      expect(mockRes.sendStatus).toHaveBeenCalledWith(StatusCodes.NO_CONTENT)
    })

    it('should return 400 when transaction has expired', async () => {
      // Arrange
      MockVerificationService.resetFieldForTransaction.mockReturnValueOnce(
        errAsync(new TransactionExpiredError()),
      )

      // Act
      await VerificationController.handleResetFieldVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(
        MockVerificationService.resetFieldForTransaction,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID, MOCK_FIELD_ID)
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 404 when form is not found', async () => {
      // Arrange
      MockFormService.retrieveFormById.mockReturnValue(
        errAsync(new FormNotFoundError()),
      )

      // Act
      await VerificationController.handleResetFieldVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(
        MockVerificationService.resetFieldForTransaction,
      ).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 404 when transaction is not found', async () => {
      // Arrange
      MockVerificationService.resetFieldForTransaction.mockReturnValueOnce(
        errAsync(new TransactionNotFoundError()),
      )

      // Act
      await VerificationController.handleResetFieldVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(
        MockVerificationService.resetFieldForTransaction,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID, MOCK_FIELD_ID)
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 404 when field is not found', async () => {
      // Arrange
      MockVerificationService.resetFieldForTransaction.mockReturnValueOnce(
        errAsync(new FieldNotFoundInTransactionError()),
      )

      // Act
      await VerificationController.handleResetFieldVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(
        MockVerificationService.resetFieldForTransaction,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID, MOCK_FIELD_ID)
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })

    it('should return 500 when database error occurs', async () => {
      // Arrange
      MockVerificationService.resetFieldForTransaction.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )

      // Act
      await VerificationController.handleResetFieldVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(
        MockVerificationService.resetFieldForTransaction,
      ).toHaveBeenCalledWith(MOCK_TRANSACTION_ID, MOCK_FIELD_ID)
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR,
      )
      expect(mockRes.json).toHaveBeenCalledWith({
        message: expect.any(String),
      })
    })
  })

  describe('_handleOtpVerification', () => {
    const MOCK_REQ = expressHandler.mockRequest({
      params: {
        transactionId: MOCK_TRANSACTION_ID,
        fieldId: MOCK_FIELD_ID,
        formId: MOCK_FORM_ID,
      },
      body: {
        otp: MOCK_OTP,
      },
    })

    beforeEach(() =>
      MockFormService.retrieveFormById.mockReturnValue(
        okAsync({} as IFormSchema),
      ),
    )

    it('should correctly call service when params are valid', async () => {
      // Arrange
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        okAsync(MOCK_SIGNED_DATA),
      )

      // Act
      await VerificationController._handleOtpVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        MOCK_TRANSACTION_ID,
        MOCK_FIELD_ID,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.OK)
      expect(mockRes.json).toHaveBeenCalledWith(MOCK_SIGNED_DATA)
    })

    it('should return 400 when the transaction is expired', async () => {
      // Arrange
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new TransactionExpiredError()),
      )
      const expectedResponse = {
        message: 'Your session has expired, please refresh and try again.',
      }

      // Act
      await VerificationController._handleOtpVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        MOCK_TRANSACTION_ID,
        MOCK_FIELD_ID,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 400 when the hash data could not be found', async () => {
      // Arrange
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new MissingHashDataError()),
      )
      const expectedResponse = {
        message: 'Sorry, something went wrong. Please refresh and try again.',
      }

      // Act
      await VerificationController._handleOtpVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        MOCK_TRANSACTION_ID,
        MOCK_FIELD_ID,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 404 when the form could not be found', async () => {
      // Arrange
      MockFormService.retrieveFormById.mockReturnValueOnce(
        errAsync(new FormNotFoundError()),
      )
      const expectedResponse = {
        message: 'Sorry, something went wrong. Please refresh and try again.',
      }

      // Act
      await VerificationController._handleOtpVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockVerificationService.verifyOtp).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 404 when the transaction could not be found', async () => {
      // Arrange
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new TransactionNotFoundError()),
      )
      const expectedResponse = {
        message: 'Sorry, something went wrong. Please refresh and try again.',
      }

      // Act
      await VerificationController._handleOtpVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        MOCK_TRANSACTION_ID,
        MOCK_FIELD_ID,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 404 when the field could not be found for the specified transaction', async () => {
      // Arrange
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new FieldNotFoundInTransactionError()),
      )
      const expectedResponse = {
        message: 'Sorry, something went wrong. Please refresh and try again.',
      }

      // Act
      await VerificationController._handleOtpVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        MOCK_TRANSACTION_ID,
        MOCK_FIELD_ID,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 422 when the otp has expired', async () => {
      // Arrange
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new OtpExpiredError()),
      )
      const expectedResponse = {
        message: 'Your OTP has expired, please request for a new one.',
      }

      // Act
      await VerificationController._handleOtpVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        MOCK_TRANSACTION_ID,
        MOCK_FIELD_ID,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.UNPROCESSABLE_ENTITY,
      )
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 422 when the user has exceeded the number of retries for otp', async () => {
      // Arrange
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new OtpRetryExceededError()),
      )
      const expectedResponse = {
        message:
          'You have entered too many invalid OTPs. Please request for a new OTP and try again.',
      }

      // Act
      await VerificationController._handleOtpVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        MOCK_TRANSACTION_ID,
        MOCK_FIELD_ID,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.UNPROCESSABLE_ENTITY,
      )
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 422 when the otp submitted is wrong', async () => {
      // Arrange
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new WrongOtpError()),
      )
      const expectedResponse = {
        message: 'Wrong OTP.',
      }

      // Act
      await VerificationController._handleOtpVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        MOCK_TRANSACTION_ID,
        MOCK_FIELD_ID,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.UNPROCESSABLE_ENTITY,
      )
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 500 when an error occurred while hashing the otp', async () => {
      // Arrange
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new HashingError()),
      )
      const expectedResponse = {
        message: 'Sorry, something went wrong. Please refresh and try again.',
      }

      // Act
      await VerificationController._handleOtpVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        MOCK_TRANSACTION_ID,
        MOCK_FIELD_ID,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR,
      )
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })

    it('should return 500 when a database error occurs', async () => {
      // Arrange
      MockVerificationService.verifyOtp.mockReturnValueOnce(
        errAsync(new DatabaseError()),
      )
      const expectedResponse = {
        message: 'Sorry, something went wrong. Please refresh and try again.',
      }

      // Act
      await VerificationController._handleOtpVerification(
        MOCK_REQ,
        mockRes,
        jest.fn(),
      )

      // Assert
      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        MOCK_FORM_ID,
      )
      expect(MockVerificationService.verifyOtp).toHaveBeenCalledWith(
        MOCK_TRANSACTION_ID,
        MOCK_FIELD_ID,
        MOCK_OTP,
      )
      expect(mockRes.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR,
      )
      expect(mockRes.json).toHaveBeenCalledWith(expectedResponse)
    })
  })
})
