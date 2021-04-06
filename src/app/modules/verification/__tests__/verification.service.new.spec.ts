import { ObjectId } from 'bson'
import mongoose from 'mongoose'
import { errAsync, okAsync } from 'neverthrow'
import { mocked } from 'ts-jest/utils'

import * as FormService from 'src/app/modules/form/form.service'
import { MailSendError } from 'src/app/services/mail/mail.errors'
import MailService from 'src/app/services/mail/mail.service'
import { SmsSendError } from 'src/app/services/sms/sms.errors'
import { SmsFactory } from 'src/app/services/sms/sms.factory'
import formsgSdk from 'src/config/formsg-sdk'
import {
  BasicField,
  IFormSchema,
  IVerificationSchema,
  PublicTransaction,
  UpdateFieldData,
} from 'src/types'

import dbHandler from 'tests/unit/backend/helpers/jest-db'

import { DatabaseError } from '../../core/core.errors'
import { FormNotFoundError } from '../../form/form.errors'
import {
  FieldNotFoundInTransactionError,
  TransactionExpiredError,
  TransactionNotFoundError,
  WaitForOtpError,
} from '../verification.errors'
import getVerificationModel from '../verification.model'
import * as VerificationService from '../verification.service'

import {
  generateFieldParams,
  MOCK_HASHED_OTP,
  MOCK_OTP,
  MOCK_RECIPIENT,
  MOCK_SIGNED_DATA,
} from './verification.test.helpers'

const VerificationModel = getVerificationModel(mongoose)

// Set up mocks
jest.mock('src/config/formsg-sdk')
const MockFormsgSdk = mocked(formsgSdk, true)
jest.mock('src/app/services/sms/sms.factory')
const MockSmsFactory = mocked(SmsFactory, true)
jest.mock('src/app/services/mail/mail.service')
const MockMailService = mocked(MailService, true)
jest.mock('src/app/modules/form/form.service')
const MockFormService = mocked(FormService, true)

describe('Verification service', () => {
  const mockFieldId = new ObjectId().toHexString()
  const mockField = { ...generateFieldParams(), _id: mockFieldId }
  const mockTransactionId = new ObjectId().toHexString()
  const mockFormId = new ObjectId().toHexString()
  let mockTransaction: IVerificationSchema

  beforeAll(async () => await dbHandler.connect())

  beforeEach(async () => {
    mockTransaction = await VerificationModel.create({
      _id: mockTransactionId,
      formId: mockFormId,
      fields: [mockField],
      // Expire 1 hour in future
      expireAt: new Date(Date.now() + 60 * 60 * 1000),
    })
  })

  afterEach(async () => {
    await dbHandler.clearDatabase()
    jest.resetAllMocks()
  })

  describe('createTransaction', () => {
    const mockForm = ({
      _id: new ObjectId(),
      title: 'mockForm',
      form_fields: [],
    } as unknown) as IFormSchema
    let createTransactionFromFormSpy: jest.SpyInstance<
      Promise<IVerificationSchema | null>,
      [form: IFormSchema]
    >

    beforeEach(() => {
      MockFormService.retrieveFormById.mockReturnValueOnce(okAsync(mockForm))
      createTransactionFromFormSpy = jest
        .spyOn(VerificationModel, 'createTransactionFromForm')
        .mockResolvedValueOnce(mockTransaction)
    })

    it('should call VerificationModel.createTransactionFromForm when form is retrieved successfully', async () => {
      const result = await VerificationService.createTransaction(mockForm._id)

      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        mockForm._id,
      )
      expect(createTransactionFromFormSpy).toHaveBeenCalledWith(mockForm)
      expect(result._unsafeUnwrap()).toEqual(mockTransaction)
    })

    it('should forward the error returned when form cannot be retrieved', async () => {
      MockFormService.retrieveFormById
        .mockReset()
        .mockReturnValueOnce(errAsync(new FormNotFoundError()))

      const result = await VerificationService.createTransaction(mockForm._id)

      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        mockForm._id,
      )
      expect(createTransactionFromFormSpy).not.toHaveBeenCalled()
      expect(result._unsafeUnwrapErr()).toEqual(new FormNotFoundError())
    })

    it('should return DatabaseError when error occurs while creating transaction', async () => {
      createTransactionFromFormSpy.mockReset().mockRejectedValueOnce('rejected')

      const result = await VerificationService.createTransaction(mockForm._id)

      expect(MockFormService.retrieveFormById).toHaveBeenCalledWith(
        mockForm._id,
      )
      expect(createTransactionFromFormSpy).toHaveBeenCalledWith(mockForm)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(DatabaseError)
    })
  })

  describe('getTransactionMetadata', () => {
    let getPublicViewByIdSpy: jest.SpyInstance<
      Promise<PublicTransaction | null>,
      [id: string]
    >
    let mockPublicView: PublicTransaction

    beforeEach(() => {
      mockPublicView = {
        expireAt: mockTransaction.expireAt,
        formId: mockTransaction.formId,
        _id: new ObjectId(),
      }
      getPublicViewByIdSpy = jest
        .spyOn(VerificationModel, 'getPublicViewById')
        .mockResolvedValueOnce(mockPublicView)
    })

    it('should call VerificationModel.getPublicViewById and return the result', async () => {
      const result = await VerificationService.getTransactionMetadata(
        mockTransactionId,
      )

      expect(getPublicViewByIdSpy).toHaveBeenCalledWith(mockTransactionId)
      expect(result._unsafeUnwrap()).toEqual(mockPublicView)
    })

    it('should call VerificationModel.getPublicViewById and return TransactionNotFoundError when result is null', async () => {
      getPublicViewByIdSpy.mockReset().mockResolvedValueOnce(null)

      const result = await VerificationService.getTransactionMetadata(
        mockTransactionId,
      )

      expect(getPublicViewByIdSpy).toHaveBeenCalledWith(mockTransactionId)
      expect(result._unsafeUnwrapErr()).toEqual(new TransactionNotFoundError())
    })
  })

  describe('resetFieldForTransaction', () => {
    let resetFieldSpy: jest.SpyInstance<
      Promise<IVerificationSchema | null>,
      [transactionId: string, fieldId: string]
    >

    beforeEach(() => {
      resetFieldSpy = jest
        .spyOn(VerificationModel, 'resetField')
        .mockResolvedValueOnce(mockTransaction)
    })

    it('should call VerificationModel.resetField when transaction and field IDs are valid', async () => {
      const result = await VerificationService.resetFieldForTransaction(
        mockTransactionId,
        mockFieldId,
      )

      expect(resetFieldSpy).toHaveBeenCalledWith(mockTransactionId, mockFieldId)
      expect(result._unsafeUnwrap()).toEqual(mockTransaction)
    })

    it('should return TransactionNotFoundError when transaction ID does not exist', async () => {
      const result = await VerificationService.resetFieldForTransaction(
        // non-existent transaction ID
        new ObjectId().toHexString(),
        mockFieldId,
      )

      expect(resetFieldSpy).not.toHaveBeenCalled()
      expect(result._unsafeUnwrapErr()).toEqual(new TransactionNotFoundError())
    })

    it('should return TransactionExpiredError when transaction has expired', async () => {
      const expiredTransaction = await VerificationModel.create({
        formId: mockFormId,
        // Expire 25 hours ago
        expireAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      })

      const result = await VerificationService.resetFieldForTransaction(
        expiredTransaction._id,
        mockFieldId,
      )

      expect(resetFieldSpy).not.toHaveBeenCalled()
      expect(result._unsafeUnwrapErr()).toEqual(new TransactionExpiredError())
    })

    it('should return FieldNotFoundInTransactionError when field ID does not exist', async () => {
      const result = await VerificationService.resetFieldForTransaction(
        mockTransactionId,
        // ObjectId which does not exist in mockTransaction
        new ObjectId().toHexString(),
      )

      expect(resetFieldSpy).not.toHaveBeenCalled()
      expect(result._unsafeUnwrapErr()).toEqual(
        new FieldNotFoundInTransactionError(),
      )
    })

    it('should return TransactionNotFoundError when database update returns null', async () => {
      resetFieldSpy.mockReset().mockResolvedValueOnce(null)

      const result = await VerificationService.resetFieldForTransaction(
        mockTransactionId,
        mockFieldId,
      )

      expect(resetFieldSpy).toHaveBeenCalledWith(mockTransactionId, mockFieldId)
      expect(result._unsafeUnwrapErr()).toEqual(new TransactionNotFoundError())
    })

    it('should return DatabaseError when database update errors', async () => {
      resetFieldSpy.mockReset().mockRejectedValueOnce('rejected')

      const result = await VerificationService.resetFieldForTransaction(
        mockTransactionId,
        mockFieldId,
      )

      expect(resetFieldSpy).toHaveBeenCalledWith(mockTransactionId, mockFieldId)
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(DatabaseError)
    })
  })

  describe('sendNewOtp', () => {
    let updateHashSpy: jest.SpyInstance<
      Promise<IVerificationSchema | null>,
      [updateData: UpdateFieldData]
    >

    beforeEach(() => {
      updateHashSpy = jest
        .spyOn(VerificationModel, 'updateHashForField')
        .mockResolvedValueOnce(mockTransaction)
      MockSmsFactory.sendVerificationOtp.mockReturnValueOnce(okAsync(true))
      MockMailService.sendVerificationOtp.mockReturnValueOnce(okAsync(true))
      MockFormsgSdk.verification.generateSignature.mockReturnValueOnce(
        MOCK_SIGNED_DATA,
      )
    })

    it('should send OTP and update hashes when parameters are valid', async () => {
      const result = await VerificationService.sendNewOtp({
        transactionId: mockTransactionId,
        fieldId: mockFieldId,
        hashedOtp: MOCK_HASHED_OTP,
        otp: MOCK_OTP,
        recipient: MOCK_RECIPIENT,
      })

      // Default mock params has fieldType: 'mobile'
      expect(MockSmsFactory.sendVerificationOtp).toHaveBeenCalledWith(
        MOCK_RECIPIENT,
        MOCK_OTP,
        mockTransaction.formId,
      )
      expect(MockFormsgSdk.verification.generateSignature).toHaveBeenCalledWith(
        {
          transactionId: mockTransactionId,
          formId: mockTransaction.formId,
          fieldId: mockFieldId,
          answer: MOCK_RECIPIENT,
        },
      )
      expect(updateHashSpy).toHaveBeenCalledWith({
        fieldId: mockFieldId,
        hashedOtp: MOCK_HASHED_OTP,
        signedData: MOCK_SIGNED_DATA,
        transactionId: mockTransactionId,
      })
      expect(result._unsafeUnwrap()).toEqual(mockTransaction)
    })

    it('should return TransactionNotFoundError when transaction ID does not exist', async () => {
      const result = await VerificationService.sendNewOtp({
        // non-existent transaction ID
        transactionId: new ObjectId().toHexString(),
        fieldId: mockFieldId,
        hashedOtp: MOCK_HASHED_OTP,
        otp: MOCK_OTP,
        recipient: MOCK_RECIPIENT,
      })

      expect(MockMailService.sendVerificationOtp).not.toHaveBeenCalled()
      expect(MockSmsFactory.sendVerificationOtp).not.toHaveBeenCalled()
      expect(
        MockFormsgSdk.verification.generateSignature,
      ).not.toHaveBeenCalled()
      expect(updateHashSpy).not.toHaveBeenCalled()
      expect(result._unsafeUnwrapErr()).toEqual(new TransactionNotFoundError())
    })

    it('should return TransactionExpiredError when transaction has expired', async () => {
      const expiredTransaction = await VerificationModel.create({
        formId: mockFormId,
        // Expire 25 hours ago
        expireAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      })

      const result = await VerificationService.sendNewOtp({
        transactionId: expiredTransaction._id,
        fieldId: mockFieldId,
        hashedOtp: MOCK_HASHED_OTP,
        otp: MOCK_OTP,
        recipient: MOCK_RECIPIENT,
      })

      expect(MockMailService.sendVerificationOtp).not.toHaveBeenCalled()
      expect(MockSmsFactory.sendVerificationOtp).not.toHaveBeenCalled()
      expect(
        MockFormsgSdk.verification.generateSignature,
      ).not.toHaveBeenCalled()
      expect(updateHashSpy).not.toHaveBeenCalled()
      expect(result._unsafeUnwrapErr()).toEqual(new TransactionExpiredError())
    })

    it('should return FieldNotFoundInTransactionError when field ID does not exist', async () => {
      const result = await VerificationService.sendNewOtp({
        transactionId: mockTransactionId,
        // ObjectId which does not exist in mockTransaction
        fieldId: new ObjectId().toHexString(),
        hashedOtp: MOCK_HASHED_OTP,
        otp: MOCK_OTP,
        recipient: MOCK_RECIPIENT,
      })

      expect(MockMailService.sendVerificationOtp).not.toHaveBeenCalled()
      expect(MockSmsFactory.sendVerificationOtp).not.toHaveBeenCalled()
      expect(
        MockFormsgSdk.verification.generateSignature,
      ).not.toHaveBeenCalled()
      expect(updateHashSpy).not.toHaveBeenCalled()
      expect(result._unsafeUnwrapErr()).toEqual(
        new FieldNotFoundInTransactionError(),
      )
    })

    it('should return WaitForOtpError when OTP waiting time has not elapsed', async () => {
      const expiredOtpField = generateFieldParams({
        // Hash created 5 seconds ago
        hashCreatedAt: new Date(Date.now() - 5 * 1000),
      })
      const expiredOtpTransaction = await VerificationModel.create({
        formId: mockFormId,
        // Expire 1 hour in future
        expireAt: new Date(Date.now() + 60 * 60 * 1000),
        fields: [expiredOtpField],
      })

      const result = await VerificationService.sendNewOtp({
        transactionId: expiredOtpTransaction._id,
        fieldId: expiredOtpField._id,
        hashedOtp: MOCK_HASHED_OTP,
        otp: MOCK_OTP,
        recipient: MOCK_RECIPIENT,
      })

      expect(MockMailService.sendVerificationOtp).not.toHaveBeenCalled()
      expect(MockSmsFactory.sendVerificationOtp).not.toHaveBeenCalled()
      expect(
        MockFormsgSdk.verification.generateSignature,
      ).not.toHaveBeenCalled()
      expect(updateHashSpy).not.toHaveBeenCalled()
      expect(result._unsafeUnwrapErr()).toEqual(new WaitForOtpError())
    })

    it('should forward errors returned by MailService.sendVerificationOtp', async () => {
      const error = new MailSendError()
      MockMailService.sendVerificationOtp
        .mockReset()
        .mockReturnValueOnce(errAsync(error))
      const field = generateFieldParams({
        fieldType: BasicField.Email,
      })
      const transaction = await VerificationModel.create({
        formId: mockFormId,
        fields: [field],
      })

      const result = await VerificationService.sendNewOtp({
        transactionId: transaction._id,
        fieldId: field._id,
        hashedOtp: MOCK_HASHED_OTP,
        otp: MOCK_OTP,
        recipient: MOCK_RECIPIENT,
      })

      expect(MockMailService.sendVerificationOtp).toHaveBeenCalledWith(
        MOCK_RECIPIENT,
        MOCK_OTP,
      )
      expect(
        MockFormsgSdk.verification.generateSignature,
      ).not.toHaveBeenCalled()
      expect(updateHashSpy).not.toHaveBeenCalled()
      expect(result._unsafeUnwrapErr()).toEqual(error)
    })

    it('should forward errors returned by SmsFactory.sendVerificationOtp', async () => {
      const error = new SmsSendError()
      MockSmsFactory.sendVerificationOtp
        .mockReset()
        .mockReturnValueOnce(errAsync(error))
      const field = generateFieldParams({
        fieldType: BasicField.Mobile,
      })
      const transaction = await VerificationModel.create({
        formId: mockFormId,
        fields: [field],
      })

      const result = await VerificationService.sendNewOtp({
        transactionId: transaction._id,
        fieldId: field._id,
        hashedOtp: MOCK_HASHED_OTP,
        otp: MOCK_OTP,
        recipient: MOCK_RECIPIENT,
      })

      expect(MockSmsFactory.sendVerificationOtp).toHaveBeenCalledWith(
        MOCK_RECIPIENT,
        MOCK_OTP,
        new ObjectId(mockFormId),
      )
      expect(
        MockFormsgSdk.verification.generateSignature,
      ).not.toHaveBeenCalled()
      expect(updateHashSpy).not.toHaveBeenCalled()
      expect(result._unsafeUnwrapErr()).toEqual(error)
    })

    it('should return TransactionNotFoundError when database update returns null', async () => {
      updateHashSpy.mockReset().mockResolvedValueOnce(null)

      const result = await VerificationService.sendNewOtp({
        transactionId: mockTransactionId,
        fieldId: mockFieldId,
        hashedOtp: MOCK_HASHED_OTP,
        otp: MOCK_OTP,
        recipient: MOCK_RECIPIENT,
      })

      // Mock params default to mobile
      expect(MockSmsFactory.sendVerificationOtp).toHaveBeenCalledWith(
        MOCK_RECIPIENT,
        MOCK_OTP,
        new ObjectId(mockFormId),
      )
      expect(MockFormsgSdk.verification.generateSignature).toHaveBeenCalledWith(
        {
          transactionId: mockTransactionId,
          formId: new ObjectId(mockFormId),
          fieldId: mockFieldId,
          answer: MOCK_RECIPIENT,
        },
      )
      expect(updateHashSpy).toHaveBeenCalledWith({
        fieldId: mockFieldId,
        hashedOtp: MOCK_HASHED_OTP,
        signedData: MOCK_SIGNED_DATA,
        transactionId: mockTransactionId,
      })
      expect(result._unsafeUnwrapErr()).toEqual(new TransactionNotFoundError())
    })
  })
})