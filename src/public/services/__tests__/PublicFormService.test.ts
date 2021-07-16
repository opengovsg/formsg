/* eslint-disable @typescript-eslint/ban-ts-comment */
import MockAxios from 'jest-mock-axios'

import { BasicField } from 'src/types'
import { EmailSubmissionDto, EncryptSubmissionDto } from 'src/types/api'

import { SubmissionResponseDto } from '../../../../shared/types/submission'
import * as SubmissionUtil from '../../utils/submission'
import {
  getPublicFormView,
  submitEmailModeForm,
  submitStorageModeForm,
} from '../PublicFormService'

jest.mock('axios', () => MockAxios)

describe('PublicFormService', () => {
  describe('submitEmailModeForm', () => {
    const MOCK_FORM_ID = 'mock–form-id'
    const MOCK_RESPONSE: SubmissionResponseDto = {
      message: 'some mock response',
      submissionId: 'created submission id',
    }
    const MOCK_CONTENT: EmailSubmissionDto = {
      responses: [
        {
          question: 'some question',
          answer: 'some answer',
          fieldType: BasicField.ShortText,
          _id: 'some_id',
        },
      ],
    }

    it('should call api with correct form data and params successfully when captcha is provided', async () => {
      // Arrange
      const mockCaptcha = 'some captcha response'
      const expectedFormData = 'form data returned imagine this is a form data'
      const createFormDataSpy = jest
        .spyOn(SubmissionUtil, 'createEmailSubmissionFormData')
        // Ignore wrong type; just checking that the util is ran and returns expected.
        // @ts-ignore
        .mockReturnValueOnce(expectedFormData)

      // Act
      const actual = submitEmailModeForm({
        formId: MOCK_FORM_ID,
        content: MOCK_CONTENT,
        captchaResponse: mockCaptcha,
      })
      MockAxios.mockResponse({ data: MOCK_RESPONSE })

      // Assert
      await expect(actual).resolves.toEqual(MOCK_RESPONSE)
      expect(MockAxios.post).toHaveBeenCalledWith(
        `/api/v3/forms/${MOCK_FORM_ID}/submissions/email`,
        expectedFormData,
        { params: { captchaResponse: mockCaptcha } },
      )
      expect(createFormDataSpy).toHaveBeenCalledWith({
        content: MOCK_CONTENT,
      })
    })

    it('should call api with correct form data and params successfully when captcha is not provided', async () => {
      // Arrange
      const expectedFormData =
        'form data returned imagine this is another form data'
      const createFormDataSpy = jest
        .spyOn(SubmissionUtil, 'createEmailSubmissionFormData')
        // Ignore wrong type; just checking that the util is ran and returns expected.
        // @ts-ignore
        .mockReturnValueOnce(expectedFormData)

      // Act
      const actual = submitEmailModeForm({
        formId: MOCK_FORM_ID,
        content: MOCK_CONTENT,
        // No captcha entered
      })
      MockAxios.mockResponse({ data: MOCK_RESPONSE })

      // Assert
      await expect(actual).resolves.toEqual(MOCK_RESPONSE)
      expect(MockAxios.post).toHaveBeenCalledWith(
        `/api/v3/forms/${MOCK_FORM_ID}/submissions/email`,
        expectedFormData,
        // Should default to stringified null
        { params: { captchaResponse: 'null' } },
      )
      expect(createFormDataSpy).toHaveBeenCalledWith({
        content: MOCK_CONTENT,
      })
    })
  })

  describe('submitStorageModeForm', () => {
    const MOCK_FORM_ID = 'mock–form-id-2'
    const MOCK_RESPONSE: SubmissionResponseDto = {
      message: 'some mock response again',
      submissionId: 'created submission id again',
    }
    const MOCK_CONTENT: EncryptSubmissionDto = {
      responses: [
        {
          question: 'some question',
          answer: 'some answer',
          fieldType: BasicField.ShortText,
          _id: 'some_id',
        },
      ],
      encryptedContent: 'encryptedContent1337H@xx0r',
      version: 1,
    }

    it('should call api with correct params successfully when captcha is provided', async () => {
      // Arrange
      const mockCaptcha = 'some captcha response'

      // Act
      const actual = submitStorageModeForm({
        formId: MOCK_FORM_ID,
        content: MOCK_CONTENT,
        captchaResponse: mockCaptcha,
      })
      MockAxios.mockResponse({ data: MOCK_RESPONSE })

      // Assert
      await expect(actual).resolves.toEqual(MOCK_RESPONSE)
      expect(MockAxios.post).toHaveBeenCalledWith(
        `/api/v3/forms/${MOCK_FORM_ID}/submissions/encrypt`,
        MOCK_CONTENT,
        { params: { captchaResponse: mockCaptcha } },
      )
    })

    it('should call api with correct params successfully when captcha is not provided', async () => {
      // Act
      const actual = submitStorageModeForm({
        formId: MOCK_FORM_ID,
        content: MOCK_CONTENT,
        // No captcha entered
      })
      MockAxios.mockResponse({ data: MOCK_RESPONSE })

      // Assert
      await expect(actual).resolves.toEqual(MOCK_RESPONSE)
      expect(MockAxios.post).toHaveBeenCalledWith(
        `/api/v3/forms/${MOCK_FORM_ID}/submissions/encrypt`,
        MOCK_CONTENT,
        // Should default to stringified null
        { params: { captchaResponse: 'null' } },
      )
    })
  })

  describe('getPublicFormView', () => {
    it('should return public form if GET request succeeds', async () => {
      // Arrange
      const MOCK_FORM_ID = 'mock-form-id'
      const expected = {
        form: { _id: MOCK_FORM_ID, form_fields: [] },
        spcpSession: { username: 'username' },
        isIntranetUser: false,
        myInfoError: true,
      }
      MockAxios.get.mockResolvedValueOnce({ data: expected })

      // Act
      const actual = await getPublicFormView(MOCK_FORM_ID)

      // Assert
      expect(actual).toEqual(expected)
      expect(MockAxios.get).toHaveBeenCalledWith(
        `/api/v3/forms/${MOCK_FORM_ID}`,
      )
    })

    it('should reject with error message if GET request fails', async () => {
      // Arrange
      const MOCK_FORM_ID = 'mock-form-id'
      const expected = new Error('error')
      MockAxios.get.mockRejectedValueOnce(expected)

      // Act
      const actualPromise = getPublicFormView(MOCK_FORM_ID)

      // Assert
      await expect(actualPromise).rejects.toEqual(expected)
      expect(MockAxios.get).toHaveBeenCalledWith(
        `/api/v3/forms/${MOCK_FORM_ID}`,
      )
    })
  })
})
