import { ObjectId } from 'bson'
import MockAxios from 'jest-mock-axios'

import {
  CreateEmailFormBodyDto,
  CreateStorageFormBodyDto,
  DuplicateFormBodyDto,
} from '../../../../shared/types/form/form'
import { IPopulatedUser, IYesNoFieldSchema } from '../../../types'
import { ResponseMode } from '../../../types/form'
import {
  ADMIN_FORM_ENDPOINT,
  createForm,
  duplicateForm,
} from '../CreateFormService'

jest.mock('axios', () => MockAxios)

const MOCK_USER = {
  _id: new ObjectId(),
} as IPopulatedUser

describe('CreateFormService', () => {
  afterEach(() => MockAxios.reset())
  describe('duplicateForm', () => {
    it('should return saved form if POST request succeeds', async () => {
      // Arrange
      const expected = {
        title: 'title',
        lastModified: new Date(),
        _id: new ObjectId().toHexString(),
        responseMode: ResponseMode.Email,
        admin: MOCK_USER,
      }
      const MOCK_FORM_ID = expected._id
      const MOCK_DUPLICATE_FORM_BODY = _generateDuplicateFormBody()
      MockAxios.post.mockResolvedValueOnce({ data: expected })

      // Act
      const actual = await duplicateForm(MOCK_FORM_ID, MOCK_DUPLICATE_FORM_BODY)

      // Assert
      expect(actual).toEqual(expected)
      expect(MockAxios.post).toHaveBeenCalledWith(
        `${ADMIN_FORM_ENDPOINT}/${MOCK_FORM_ID}/duplicate`,
        MOCK_DUPLICATE_FORM_BODY,
      )
    })

    it('should reject with error message if POST request fails', async () => {
      // Arrange
      const expected = new Error('error')
      const MOCK_FORM_ID = new ObjectId().toHexString()
      const MOCK_DUPLICATE_FORM_BODY = _generateDuplicateFormBody()
      MockAxios.post.mockRejectedValueOnce(expected)

      // Act
      const actualPromise = duplicateForm(
        MOCK_FORM_ID,
        MOCK_DUPLICATE_FORM_BODY,
      )

      // Assert
      await expect(actualPromise).rejects.toEqual(expected)
      expect(MockAxios.post).toHaveBeenCalledWith(
        `${ADMIN_FORM_ENDPOINT}/${MOCK_FORM_ID}/duplicate`,
        MOCK_DUPLICATE_FORM_BODY,
      )
    })
  })

  describe('createForm', () => {
    it('should return created form if POST request succeeds', async () => {
      // Arrange
      const expected = { form_fields: [{} as IYesNoFieldSchema] }
      const mockFormParams: CreateStorageFormBodyDto = {
        title: 'title',
        responseMode: ResponseMode.Encrypt,
        publicKey: 'test',
      }
      MockAxios.post.mockResolvedValueOnce({ data: expected })

      // Act
      const actual = await createForm(mockFormParams)

      // Assert
      expect(actual).toEqual(expected)
      expect(MockAxios.post).toHaveBeenCalledWith(`${ADMIN_FORM_ENDPOINT}`, {
        form: mockFormParams,
      })
    })

    it('should reject with error message if POST request fails', async () => {
      // Arrange
      const expected = new Error('error')
      const mockFormParams: CreateEmailFormBodyDto = {
        title: 'title',
        responseMode: ResponseMode.Email,
        emails: ['mock'],
      }
      MockAxios.post.mockRejectedValueOnce(expected)
      // Act
      const actualPromise = createForm(mockFormParams)

      // Assert
      await expect(actualPromise).rejects.toEqual(expected)
      expect(MockAxios.post).toHaveBeenCalledWith(`${ADMIN_FORM_ENDPOINT}`, {
        form: mockFormParams,
      })
    })
  })
})

const _generateDuplicateFormBody = (): DuplicateFormBodyDto => {
  return {
    title: 'title',
    responseMode: ResponseMode.Email,
    emails: 'test@example.com',
  } as DuplicateFormBodyDto
}
