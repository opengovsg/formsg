import { decode } from '@stablelib/base64'
import axios from 'axios'
import JSZip from 'jszip'
import { mocked } from 'ts-jest/utils'

import { SubmissionMetadataList } from 'src/types'

import { DateString } from '../../../../shared/types/generic'
import { SubmissionId } from '../../../../shared/types/submission'
import * as AdminSubmissionService from '../AdminSubmissionsService'
import * as formsSdk from '../FormSgSdkService'
import { ADMIN_FORM_ENDPOINT } from '../UpdateFormService'

jest.mock('axios')
const MockAxios = mocked(axios, true)

jest.mock('../FormSgSdkService')

const mockFormSgSdk = mocked(formsSdk.FormSgSdk, true)

jest.mock('@stablelib/base64')
const mockDecodeBase64 = mocked(decode)

describe('AdminSubmissionsService', () => {
  describe('countFormSubmissions', () => {
    const MOCK_FORM_ID = 'mock–form-id'
    const MOCK_START_DATE = new Date(2020, 11, 17).toISOString() as DateString
    const MOCK_END_DATE = new Date(2021, 1, 10).toISOString() as DateString

    it('should call api successfully when all parameters are provided', async () => {
      // Arrange
      MockAxios.get.mockResolvedValueOnce({ data: 123 })

      // Act
      const actual = await AdminSubmissionService.countFormSubmissions({
        formId: MOCK_FORM_ID,
        dates: { startDate: MOCK_START_DATE, endDate: MOCK_END_DATE },
      })

      // Assert
      expect(actual).toEqual(123)
      expect(MockAxios.get).toHaveBeenCalledWith(
        `${ADMIN_FORM_ENDPOINT}/${MOCK_FORM_ID}/submissions/count`,
        {
          params: {
            startDate: MOCK_START_DATE,
            endDate: MOCK_END_DATE,
          },
        },
      )
    })

    it('should call api successfully when only formId is provided', async () => {
      // Arrange
      MockAxios.get.mockResolvedValueOnce({ data: 123 })

      // Act
      const actual = await AdminSubmissionService.countFormSubmissions({
        formId: MOCK_FORM_ID,
      })

      // Assert
      expect(actual).toEqual(123)
      expect(MockAxios.get).toHaveBeenCalledWith(
        `${ADMIN_FORM_ENDPOINT}/${MOCK_FORM_ID}/submissions/count`,
      )
    })
  })

  describe('getSubmissionsMetadataByPage', () => {
    const MOCK_FORM_ID = 'mock–form-id'
    const MOCK_PAGE_NUM = 1
    const MOCK_RESPONSE: SubmissionMetadataList = {
      count: 1,
      metadata: [
        {
          number: 1,
          refNo: '1234' as SubmissionId,
          submissionTime: 'sometime',
        },
      ],
    }

    it('should call the api correctly', async () => {
      // Arrange
      MockAxios.get.mockResolvedValueOnce({ data: MOCK_RESPONSE })

      // Act
      const actual = await AdminSubmissionService.getSubmissionsMetadataByPage({
        formId: MOCK_FORM_ID,
        page: MOCK_PAGE_NUM,
      })

      // Assert
      expect(actual).toEqual(MOCK_RESPONSE)
      expect(MockAxios.get).toHaveBeenCalledWith(
        `${ADMIN_FORM_ENDPOINT}/${MOCK_FORM_ID}/submissions/metadata`,
        {
          params: {
            page: MOCK_PAGE_NUM,
          },
        },
      )
    })
  })

  describe('getSubmissionMetadataById', () => {
    const MOCK_FORM_ID = 'mock–form-id'
    const MOCK_SUBMISSION_ID = 'fake'
    const MOCK_RESPONSE: SubmissionMetadataList = {
      count: 1,
      metadata: [
        {
          number: 1,
          refNo: '1234' as SubmissionId,
          submissionTime: 'sometime',
        },
      ],
    }

    it('should call the api correctly', async () => {
      // Arrange
      MockAxios.get.mockResolvedValueOnce({ data: MOCK_RESPONSE })

      // Act
      const actual = await AdminSubmissionService.getSubmissionMetadataById({
        formId: MOCK_FORM_ID,
        submissionId: MOCK_SUBMISSION_ID,
      })

      // Assert
      expect(actual).toEqual(MOCK_RESPONSE)
      expect(MockAxios.get).toHaveBeenCalledWith(
        `${ADMIN_FORM_ENDPOINT}/${MOCK_FORM_ID}/submissions/metadata`,
        {
          params: {
            submissionId: MOCK_SUBMISSION_ID,
          },
        },
      )
    })
  })

  describe('getEncryptedResponse', () => {
    const MOCK_FORM_ID = 'mock–form-id'
    const MOCK_SUBMISSION_ID = 'fake'
    const MOCK_RESPONSE = {
      refNo: '1',
      submissionTime: 'sometime',
      content: 'jk',
      verified: 'whups',
      attachmentMetadata: {},
    }

    it('should call the api correctly when the parameters are valid', async () => {
      // Arrange
      MockAxios.get.mockResolvedValueOnce({ data: MOCK_RESPONSE })

      // Act
      const actual = await AdminSubmissionService.getEncryptedResponse({
        formId: MOCK_FORM_ID,
        submissionId: MOCK_SUBMISSION_ID,
      })

      // Assert
      expect(actual).toEqual(MOCK_RESPONSE)
      expect(MockAxios.get).toHaveBeenCalledWith(
        `${ADMIN_FORM_ENDPOINT}/${MOCK_FORM_ID}/submissions/${MOCK_SUBMISSION_ID}`,
      )
    })
  })

  describe('downloadAndDecryptAttachment', () => {
    const MOCK_URL = 'www.decryptme.com'
    const MOCK_SECRET_KEY = 'this is a secret'
    const MOCK_PUBLIC_KEY = 'some public key'
    const MOCK_NONCE = 'use me once and throw away pls'
    const MOCK_BINARY =
      '01101001 00100000 01100001 01101101 00100000 01100001 00100000 01101000 01110101 01101101 01100001 01101110'

    it('should decrypt successfully when there is data', async () => {
      // Arrange
      // Do not really want to mock an Uint8Array since it does not matter for
      // this test.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      mockFormSgSdk.crypto.decryptFile.mockResolvedValueOnce('great decryption')
      const MOCK_ENCRYPTED_ATTACHMENT = {
        encryptedFile: {
          submissionPublicKey: MOCK_PUBLIC_KEY,
          nonce: MOCK_NONCE,
          binary: MOCK_BINARY,
        },
      }
      const MOCK_ARRAY = Uint8Array.from([1, 2, 3, 4])
      MockAxios.get.mockResolvedValueOnce({ data: MOCK_ENCRYPTED_ATTACHMENT })
      mockDecodeBase64.mockReturnValueOnce(MOCK_ARRAY)

      // Act
      const actual = await AdminSubmissionService.downloadAndDecryptAttachment(
        MOCK_URL,
        MOCK_SECRET_KEY,
      )

      // Arrange
      expect(mockDecodeBase64).toHaveBeenCalledWith(MOCK_BINARY)
      expect(mockFormSgSdk.crypto.decryptFile).toHaveBeenCalledWith(
        MOCK_SECRET_KEY,
        MOCK_ENCRYPTED_ATTACHMENT.encryptedFile,
      )
      expect(actual).toBe('great decryption')
    })

    it('should return null when the sdk returns null', async () => {
      // Arrange
      mockFormSgSdk.crypto.decryptFile.mockResolvedValueOnce(null)
      const MOCK_ENCRYPTED_ATTACHMENT = {
        encryptedFile: {
          submissionPublicKey: MOCK_PUBLIC_KEY,
          nonce: MOCK_NONCE,
          binary: MOCK_BINARY,
        },
      }
      const MOCK_ARRAY = Uint8Array.from([1, 2, 3, 4])
      MockAxios.get.mockResolvedValueOnce({ data: MOCK_ENCRYPTED_ATTACHMENT })
      mockDecodeBase64.mockReturnValueOnce(MOCK_ARRAY)

      // Act
      const actual = await AdminSubmissionService.downloadAndDecryptAttachment(
        MOCK_URL,
        MOCK_SECRET_KEY,
      )

      // Arrange
      expect(mockDecodeBase64).toHaveBeenCalledWith(MOCK_BINARY)
      expect(mockFormSgSdk.crypto.decryptFile).toHaveBeenCalledWith(
        MOCK_SECRET_KEY,
        MOCK_ENCRYPTED_ATTACHMENT.encryptedFile,
      )
      expect(actual).toBe(null)
    })
  })

  describe('downloadAndDecryptAttachmentsAsZip', () => {
    const MOCK_DOWNLOAD_URLS = new Map([
      [1, { url: 'something', filename: '1' }],
      [2, { url: 'something', filename: '1' }],
    ])
    const MOCK_SECRET_KEY = 'keep this secret'
    const MOCK_ARRAY = Uint8Array.from([1, 2, 3])

    it('should return the zipfile when downloads are successful', async () => {
      // Arrange
      const decryptSpy = jest.spyOn(
        AdminSubmissionService,
        'downloadAndDecryptAttachment',
      )
      decryptSpy.mockResolvedValue(MOCK_ARRAY)
      const MOCK_ZIP = new JSZip()
      const zipPromises = Array.from(MOCK_DOWNLOAD_URLS).map(
        async ([questionNum, { filename }]) => {
          const fileName = `Question ${questionNum} - ${filename}`
          return MOCK_ZIP.file(fileName, MOCK_ARRAY)
        },
      )
      const expected = await Promise.all(zipPromises).then(() => {
        return MOCK_ZIP.generateAsync({ type: 'blob' })
      })

      // Act
      const actual =
        await AdminSubmissionService.downloadAndDecryptAttachmentsAsZip(
          MOCK_DOWNLOAD_URLS,
          MOCK_SECRET_KEY,
        )

      // Assert
      // Check that function is called with correct params for each element in the map
      MOCK_DOWNLOAD_URLS.forEach(({ url }) => {
        expect(decryptSpy).toHaveBeenCalledWith(url, MOCK_SECRET_KEY)
      })
      expect(actual).toEqual(expected)
    })

    it('should reject when any single download failed', async () => {
      // Arrange
      const decryptSpy = jest.spyOn(
        AdminSubmissionService,
        'downloadAndDecryptAttachment',
      )
      // NOTE: 2 urls but only 1 single rejection
      decryptSpy.mockRejectedValueOnce('oh no i failed')

      // Act
      const actual = AdminSubmissionService.downloadAndDecryptAttachmentsAsZip(
        MOCK_DOWNLOAD_URLS,
        MOCK_SECRET_KEY,
      )

      // Assert
      await expect(actual).rejects.toEqual('oh no i failed')
    })
  })
})
