import { ObjectId } from 'bson-ext'
import { Types } from 'mongoose'

import { BasicField, FormFieldSchema, Permission } from 'src/types'

import { generateDefaultField } from 'tests/unit/backend/helpers/generate-form-data'

import { getCollabEmailsWithPermission, getFormFieldById } from '../form.utils'

const MOCK_EMAIL_1 = 'a@abc.com'
const MOCK_EMAIL_2 = 'b@def.com'

describe('form.utils', () => {
  describe('getCollabEmailsWithPermission', () => {
    it('should return empty array when no arguments are given', () => {
      expect(getCollabEmailsWithPermission()).toEqual([])
    })

    it('should return empty array when permissionList is undefined but writePermission is defined', () => {
      expect(getCollabEmailsWithPermission(undefined, true)).toEqual([])
    })

    it('should return all collaborators when writePermission is undefined', () => {
      const collabs: Permission[] = [
        { email: MOCK_EMAIL_1, write: true },
        { email: MOCK_EMAIL_2, write: false },
      ]
      const result = getCollabEmailsWithPermission(collabs)
      expect(result).toEqual([MOCK_EMAIL_1, MOCK_EMAIL_2])
    })

    it('should return write-only collaborators when writePermission is true', () => {
      const collabs: Permission[] = [
        { email: MOCK_EMAIL_1, write: true },
        { email: MOCK_EMAIL_2, write: false },
      ]
      const result = getCollabEmailsWithPermission(collabs, true)
      expect(result).toEqual([MOCK_EMAIL_1])
    })

    it('should return read-only collaborators when writePermission is false', () => {
      const collabs: Permission[] = [
        { email: MOCK_EMAIL_1, write: true },
        { email: MOCK_EMAIL_2, write: false },
      ]
      const result = getCollabEmailsWithPermission(collabs, false)
      expect(result).toEqual([MOCK_EMAIL_2])
    })
  })

  describe('getFormFieldById', () => {
    it('should return form field with valid id when form fields given is a primitive array', async () => {
      // Arrange
      const fieldToFind = generateDefaultField(BasicField.HomeNo)
      const formFields = [generateDefaultField(BasicField.Date), fieldToFind]

      // Act
      const result = getFormFieldById(formFields, fieldToFind._id)

      // Assert
      expect(result).toEqual(fieldToFind)
    })

    it('should return form field with valid id when form fields given is a mongoose document array', async () => {
      // Arrange
      const fieldToFind = generateDefaultField(BasicField.Number)
      // Should not turn this unit test into an integration test, so mocking return and leaving responsibility to mongoose.
      const mockDocArray = {
        0: generateDefaultField(BasicField.LongText),
        1: fieldToFind,
        isMongooseDocumentArray: true,
        id: jest.fn().mockReturnValue(fieldToFind),
      } as unknown as Types.DocumentArray<FormFieldSchema>

      // Act
      const result = getFormFieldById(mockDocArray, fieldToFind._id)

      // Assert
      expect(result).toEqual(fieldToFind)
      expect(mockDocArray.id).toHaveBeenCalledWith(fieldToFind._id)
    })

    it('should return null when given form fields are undefined', async () => {
      // Arrange
      const someFieldId = new ObjectId()

      // Act
      const result = getFormFieldById(undefined, someFieldId)

      // Assert
      expect(result).toEqual(null)
    })

    it('should return null when no fields correspond to given field id', async () => {
      // Arrange
      const invalidFieldId = new ObjectId()
      const formFields = [
        generateDefaultField(BasicField.Date),
        generateDefaultField(BasicField.Date),
      ]

      // Act
      const result = getFormFieldById(formFields, invalidFieldId)

      // Assert
      expect(result).toEqual(null)
    })
  })
})
