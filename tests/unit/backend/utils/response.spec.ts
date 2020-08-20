import { ObjectID } from 'bson'
import { cloneDeep } from 'lodash'
import mongoose from 'mongoose'

import getFormModel from 'src/app/models/form.server.model'
import * as ResponseUtil from 'src/app/utils/response'
import {
  AttachmentSize,
  BasicField,
  FieldResponse,
  IEmailFormSchema,
  IEncryptedFormSchema,
  ISingleAnswerResponse,
  PossibleField,
  ResponseMode,
} from 'src/types'

import dbHandler from '../helpers/jest-db'

const Form = getFormModel(mongoose)

const MOCK_ADMIN_ID = new ObjectID()
const MOCK_FORM_PARAMS = {
  title: 'Test Form',
  admin: MOCK_ADMIN_ID,
}
const MOCK_ENCRYPTED_FORM_PARAMS = {
  ...MOCK_FORM_PARAMS,
  publicKey: 'mockPublicKey',
  responseMode: 'encrypt',
}
const MOCK_EMAIL_FORM_PARAMS = {
  ...MOCK_FORM_PARAMS,
  emails: ['test@example.com'],
  responseMode: 'email',
}

// Declare here so the array is static.
const FIELD_TYPES = Object.values(BasicField)
const TYPE_TO_INDEX_MAP = (() => {
  const map: { [field: string]: number } = {}
  FIELD_TYPES.forEach((type, index) => {
    map[type] = index
  })
  return map
})()

describe('Response Util', () => {
  let defaultEmailForm: IEmailFormSchema
  let defaultEmailResponses: FieldResponse[]
  let defaultEncryptForm: IEncryptedFormSchema
  let defaultEncryptResponses: FieldResponse[]

  beforeAll(async () => {
    await dbHandler.connect()
    await dbHandler.insertFormCollectionReqs({ userId: MOCK_ADMIN_ID })

    const defaultFormFields = generateDefaultFields()

    defaultEmailForm = (await createAndReturnFormWithFields(
      defaultFormFields,
      ResponseMode.Email,
    )) as IEmailFormSchema
    defaultEncryptForm = (await createAndReturnFormWithFields(
      defaultFormFields,
      ResponseMode.Encrypt,
    )) as IEncryptedFormSchema

    // Process default responses
    defaultEmailResponses = defaultEmailForm.form_fields.map((field) => {
      return {
        _id: String(field._id),
        fieldType: field.fieldType,
        question: field.getQuestion(),
        answer: '',
      }
    })
    defaultEncryptResponses = defaultEncryptForm.form_fields.map((field) => {
      return {
        _id: String(field._id),
        fieldType: field.fieldType,
        question: field.getQuestion(),
        answer: '',
      }
    })
  })
  afterAll(async () => await dbHandler.closeDatabase())

  describe('getParsedResponses', () => {
    it('should return list of parsed responses for encrypted form submission successfully', async () => {
      // Arrange
      // Only mobile and email fields are parsed, since the other fields are
      // e2e encrypted from the browser.
      const mobileFieldIndex = TYPE_TO_INDEX_MAP[BasicField.Mobile]
      const emailFieldIndex = TYPE_TO_INDEX_MAP[BasicField.Email]

      // Add answers to both mobile and email fields
      const updatedResponses = cloneDeep(defaultEncryptResponses)
      const newEmailResponse: ISingleAnswerResponse = {
        ...updatedResponses[emailFieldIndex],
        answer: 'test@example.com',
      }
      const newMobileResponse: ISingleAnswerResponse = {
        ...updatedResponses[mobileFieldIndex],
        answer: '+6587654321',
      }
      updatedResponses[mobileFieldIndex] = newMobileResponse
      updatedResponses[emailFieldIndex] = newEmailResponse

      // Act
      const actual = ResponseUtil.getParsedResponses(
        defaultEncryptForm,
        updatedResponses,
        ResponseMode.Encrypt,
      )

      // Assert
      const expectedParsed: ResponseUtil.ParsedFieldResponse[] = [
        { ...newEmailResponse, isVisible: true },
        { ...newMobileResponse, isVisible: true },
      ]
      expect(actual).toEqual(expect.arrayContaining(expectedParsed))
    })

    it('should return list of parsed responses for email form submission successfully', async () => {
      // Arrange
      // Add answer to subset of field types
      const shortTextFieldIndex = TYPE_TO_INDEX_MAP[BasicField.ShortText]
      const decimalFieldIndex = TYPE_TO_INDEX_MAP[BasicField.Decimal]

      // Add answers to both selected fields.
      const updatedResponses = cloneDeep(defaultEmailResponses)
      const newShortTextResponse: ISingleAnswerResponse = {
        ...updatedResponses[shortTextFieldIndex],
        answer: 'the quick brown fox jumps over the lazy dog',
      }
      const newDecimalResponse: ISingleAnswerResponse = {
        ...updatedResponses[decimalFieldIndex],
        answer: '3.142',
      }
      updatedResponses[shortTextFieldIndex] = newShortTextResponse
      updatedResponses[decimalFieldIndex] = newDecimalResponse

      // Act
      const actual = ResponseUtil.getParsedResponses(
        defaultEmailForm,
        updatedResponses,
        ResponseMode.Email,
      )

      // Assert
      // Should only return the responses that have been submitted.
      const expectedParsed: ResponseUtil.ParsedFieldResponse[] = [
        { ...newShortTextResponse, isVisible: true },
        { ...newDecimalResponse, isVisible: true },
      ]
      expect(actual).toEqual(expect.arrayContaining(expectedParsed))
    })

    it('should throw error when any responses are not valid for encrypted form submission ', async () => {
      // Arrange
      // Only mobile and email fields are parsed, since the other fields are
      // e2e encrypted from the browser.
      const mobileFieldIndex = TYPE_TO_INDEX_MAP[BasicField.Mobile]

      const requireMobileEncryptForm = cloneDeep(defaultEncryptForm)
      requireMobileEncryptForm.form_fields[mobileFieldIndex].required = true

      // Act + Assert
      expect(() =>
        ResponseUtil.getParsedResponses(
          requireMobileEncryptForm,
          defaultEncryptResponses,
          ResponseMode.Encrypt,
        ),
      ).toThrowError('Invalid answer submitted')
    })

    it('should throw error when any responses are not valid for email form submission ', async () => {
      // Arrange
      // Set NRIC field in form as required.
      const nricFieldIndex = TYPE_TO_INDEX_MAP[BasicField.Nric]
      const requireNricEmailForm = cloneDeep(defaultEmailForm)
      requireNricEmailForm.form_fields[nricFieldIndex].required = true

      // Act + Assert
      expect(() =>
        ResponseUtil.getParsedResponses(
          requireNricEmailForm,
          defaultEmailResponses,
          ResponseMode.Email,
        ),
      ).toThrowError('Invalid answer submitted')
    })

    it.skip('should throw error when encrypted form submission is prevented by logic', async () => {})

    it.skip('should throw error when email form submission is prevented by logic', async () => {})
  })
})

const createAndReturnFormWithFields = async (
  formFieldParamsList: Partial<PossibleField>[],
  formType: ResponseMode = ResponseMode.Email,
) => {
  let baseParams

  switch (formType) {
    case ResponseMode.Email:
      baseParams = MOCK_EMAIL_FORM_PARAMS
      break
    case ResponseMode.Encrypt:
      baseParams = MOCK_ENCRYPTED_FORM_PARAMS
      break
    default:
      baseParams = MOCK_FORM_PARAMS
  }

  const processedParamList = formFieldParamsList.map((params) => {
    // Insert required params if they do not exist.
    if (params.fieldType === 'attachment') {
      params = { attachmentSize: AttachmentSize.ThreeMb, ...params }
    }
    if (params.fieldType === 'image') {
      params = {
        url: 'http://example.com',
        fileMd5Hash: 'some hash',
        name: 'test image name',
        size: 'some size',
        ...params,
      }
    }

    return params
  })

  const formParam = {
    ...baseParams,
    form_fields: processedParamList,
  }
  const form = await Form.create(formParam)

  return form
}

const generateDefaultFields = () => {
  // Get all field types
  const formFields: Partial<PossibleField>[] = FIELD_TYPES.map((fieldType) => {
    const fieldTitle = `test ${fieldType} field title`
    if (fieldType === BasicField.Table) {
      return {
        title: fieldTitle,
        minimumRows: 1,
        columns: [
          {
            title: 'Test Column Title 1',
            required: false,
            columnType: BasicField.ShortText,
          },
          {
            title: 'Test Column Title 2',
            required: false,
            columnType: BasicField.Dropdown,
          },
        ],
        fieldType,
      }
    }

    return {
      fieldType,
      title: fieldTitle,
      required: false,
    }
  })

  return formFields
}
