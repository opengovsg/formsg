import { ValidateFieldError } from 'src/app/modules/submission/submission.errors'
import { validateField } from 'src/app/utils/field-validation'
import { BasicField, TextSelectedValidation } from 'src/types/field'

import {
  generateDefaultField,
  generateNewSingleAnswerResponse,
} from 'tests/unit/backend/helpers/generate-form-data'

describe('Text validation', () => {
  describe('Short text', () => {
    it('should disallow empty submissions if field is required', () => {
      const formField = generateDefaultField(BasicField.ShortText)
      const response = generateNewSingleAnswerResponse(BasicField.ShortText, {
        answer: '',
      })

      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isErr()).toBe(true)
      expect(validateResult._unsafeUnwrapErr()).toEqual(
        new ValidateFieldError('Invalid answer submitted'),
      )
    })

    it('should allow empty submissions if field is optional', () => {
      const formField = generateDefaultField(BasicField.ShortText, {
        required: false,
      })
      const response = generateNewSingleAnswerResponse(BasicField.ShortText, {
        answer: '',
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isOk()).toBe(true)
      expect(validateResult._unsafeUnwrap()).toEqual(true)
    })

    it('should allow any number of characters in submission if selectedValidation is not set', () => {
      const formField = generateDefaultField(BasicField.ShortText)
      const response = generateNewSingleAnswerResponse(BasicField.ShortText, {
        answer: 'hello world',
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isOk()).toBe(true)
      expect(validateResult._unsafeUnwrap()).toEqual(true)
    })

    it('should disallow whitespace answer if field is required', () => {
      const formField = generateDefaultField(BasicField.ShortText)
      const response = generateNewSingleAnswerResponse(BasicField.ShortText, {
        answer: ' ',
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isErr()).toBe(true)
      expect(validateResult._unsafeUnwrapErr()).toEqual(
        new ValidateFieldError('Invalid answer submitted'),
      )
    })

    it('should disallow fewer characters than customVal if selectedValidation is Exact', () => {
      const formField = generateDefaultField(BasicField.ShortText, {
        ValidationOptions: {
          selectedValidation: TextSelectedValidation.Exact,
          customVal: 10,
        },
      })
      const response = generateNewSingleAnswerResponse(BasicField.ShortText, {
        answer: 'fewer',
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isErr()).toBe(true)
      expect(validateResult._unsafeUnwrapErr()).toEqual(
        new ValidateFieldError('Invalid answer submitted'),
      )
    })

    it('should disallow more characters than customVal if selectedValidation is Exact', () => {
      const formField = generateDefaultField(BasicField.ShortText, {
        ValidationOptions: {
          selectedValidation: TextSelectedValidation.Exact,
          customVal: 10,
        },
      })
      const response = generateNewSingleAnswerResponse(BasicField.ShortText, {
        answer: 'more than 10 chars',
      })

      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isErr()).toBe(true)
      expect(validateResult._unsafeUnwrapErr()).toEqual(
        new ValidateFieldError('Invalid answer submitted'),
      )
    })

    it('should disallow fewer characters than customVal if selectedValidation is Minimum', () => {
      const formField = generateDefaultField(BasicField.ShortText, {
        ValidationOptions: {
          selectedValidation: TextSelectedValidation.Minimum,
          customVal: 10,
        },
      })
      const response = generateNewSingleAnswerResponse(BasicField.ShortText, {
        answer: 'fewer',
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isErr()).toBe(true)
      expect(validateResult._unsafeUnwrapErr()).toEqual(
        new ValidateFieldError('Invalid answer submitted'),
      )
    })

    it('should disallow more characters than customVal if selectedValidation is Maximum', () => {
      const formField = generateDefaultField(BasicField.ShortText, {
        ValidationOptions: {
          selectedValidation: TextSelectedValidation.Maximum,
          customVal: 10,
        },
      })
      const response = generateNewSingleAnswerResponse(BasicField.ShortText, {
        answer: 'more than 10 chars',
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isErr()).toBe(true)
      expect(validateResult._unsafeUnwrapErr()).toEqual(
        new ValidateFieldError('Invalid answer submitted'),
      )
    })
    it('should disallow responses submitted for hidden fields', () => {
      const formField = generateDefaultField(BasicField.ShortText, {
        ValidationOptions: {
          selectedValidation: null,
          customVal: null,
        },
      })
      const response = generateNewSingleAnswerResponse(BasicField.ShortText, {
        answer: 'fewer',
        isVisible: false,
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isErr()).toBe(true)
      expect(validateResult._unsafeUnwrapErr()).toEqual(
        new ValidateFieldError(
          'Attempted to submit response on a hidden field',
        ),
      )
    })
  })

  describe('Long text', () => {
    it('should disallow empty submissions if field is required', () => {
      const formField = generateDefaultField(BasicField.LongText, {
        ValidationOptions: {
          selectedValidation: null,
          customVal: null,
        },
      })
      const response = generateNewSingleAnswerResponse(BasicField.LongText, {
        answer: '',
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isErr()).toBe(true)
      expect(validateResult._unsafeUnwrapErr()).toEqual(
        new ValidateFieldError('Invalid answer submitted'),
      )
    })

    it('should allow empty submissions if field is optional', () => {
      const formField = generateDefaultField(BasicField.LongText, {
        ValidationOptions: {
          selectedValidation: null,
          customVal: null,
        },
        required: false,
      })
      const response = generateNewSingleAnswerResponse(BasicField.LongText, {
        answer: '',
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isOk()).toBe(true)
      expect(validateResult._unsafeUnwrap()).toEqual(true)
    })

    it('should allow a valid submission if selectedValidation is not set', () => {
      const formField = generateDefaultField(BasicField.LongText, {
        ValidationOptions: {
          selectedValidation: null,
          customVal: null,
        },
      })
      const response = generateNewSingleAnswerResponse(BasicField.LongText, {
        answer: 'valid',
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isOk()).toBe(true)
      expect(validateResult._unsafeUnwrap()).toEqual(true)
    })

    it('should disallow whitespace answer if field is required', () => {
      const formField = generateDefaultField(BasicField.LongText, {
        ValidationOptions: {
          selectedValidation: null,
          customVal: null,
        },
      })
      const response = generateNewSingleAnswerResponse(BasicField.LongText, {
        answer: ' ',
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isErr()).toBe(true)
      expect(validateResult._unsafeUnwrapErr()).toEqual(
        new ValidateFieldError('Invalid answer submitted'),
      )
    })

    it('should disallow fewer characters than customVal if selectedValidation is Exact', () => {
      const formField = generateDefaultField(BasicField.LongText, {
        ValidationOptions: {
          selectedValidation: TextSelectedValidation.Exact,
          customVal: 10,
        },
      })
      const response = generateNewSingleAnswerResponse(BasicField.LongText, {
        answer: 'less',
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isErr()).toBe(true)
      expect(validateResult._unsafeUnwrapErr()).toEqual(
        new ValidateFieldError('Invalid answer submitted'),
      )
    })

    it('should disallow more characters than customVal if selectedValidation is Exact', () => {
      const formField = generateDefaultField(BasicField.LongText, {
        ValidationOptions: {
          selectedValidation: TextSelectedValidation.Exact,
          customVal: 10,
        },
      })
      const response = generateNewSingleAnswerResponse(BasicField.LongText, {
        answer: 'more than 10 chars',
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isErr()).toBe(true)
      expect(validateResult._unsafeUnwrapErr()).toEqual(
        new ValidateFieldError('Invalid answer submitted'),
      )
    })

    it('should disallow fewer characters than customVal if selectedValidation is Minimum', () => {
      const formField = generateDefaultField(BasicField.LongText, {
        ValidationOptions: {
          selectedValidation: TextSelectedValidation.Minimum,
          customVal: 10,
        },
      })
      const response = generateNewSingleAnswerResponse(BasicField.LongText, {
        answer: 'fewer',
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isErr()).toBe(true)
      expect(validateResult._unsafeUnwrapErr()).toEqual(
        new ValidateFieldError('Invalid answer submitted'),
      )
    })

    it('should disallow more characters than customVal if selectedValidation is Maximum', () => {
      const formField = generateDefaultField(BasicField.LongText, {
        ValidationOptions: {
          selectedValidation: TextSelectedValidation.Maximum,
          customVal: 10,
        },
      })
      const response = generateNewSingleAnswerResponse(BasicField.LongText, {
        answer: 'more than 10 chars',
      })
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isErr()).toBe(true)
      expect(validateResult._unsafeUnwrapErr()).toEqual(
        new ValidateFieldError('Invalid answer submitted'),
      )
    })
    it('should disallow responses submitted for hidden fields', () => {
      const formField = generateDefaultField(BasicField.LongText, {
        ValidationOptions: {
          selectedValidation: null,
          customVal: null,
        },
      })
      const response = generateNewSingleAnswerResponse(BasicField.LongText, {
        answer: 'some answer',
        isVisible: false,
      })
      response.isVisible = false
      const validateResult = validateField('formId', formField, response)
      expect(validateResult.isErr()).toBe(true)
      expect(validateResult._unsafeUnwrapErr()).toEqual(
        new ValidateFieldError(
          'Attempted to submit response on a hidden field',
        ),
      )
    })
  })
})
