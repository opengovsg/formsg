import { ValidateFieldError } from 'src/app/modules/submission/submission.errors'
import { validateField } from 'src/app/utils/field-validation'
import {
  BasicField,
  NumberSelectedValidation,
  NumberValidationType,
} from 'src/types'

import {
  generateDefaultField,
  generateNewSingleAnswerResponse,
} from 'tests/unit/backend/helpers/generate-form-data'

describe('Number field validation', () => {
  it('should allow number with valid maximum', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Length,
        selectedValidation: NumberSelectedValidation.Maximum,
        customVal: 2,
        rangeMax: null,
        rangeMin: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '5',
    })

    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should allow number with valid maximum (inclusive)', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Length,
        selectedValidation: NumberSelectedValidation.Maximum,
        customVal: 2,
        rangeMax: null,
        rangeMin: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '55',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should disallow number with invalid maximum', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Length,
        selectedValidation: NumberSelectedValidation.Maximum,
        customVal: 2,
        rangeMax: null,
        rangeMin: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '555',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isErr()).toBe(true)
    expect(validateResult._unsafeUnwrapErr()).toEqual(
      new ValidateFieldError('Invalid answer submitted'),
    )
  })

  it('should allow number with valid minimum', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Length,
        selectedValidation: NumberSelectedValidation.Minimum,
        customVal: 2,
        rangeMax: null,
        rangeMin: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '555',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should allow number with valid minimum (inclusive)', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Length,
        selectedValidation: NumberSelectedValidation.Minimum,
        customVal: 2,
        rangeMax: null,
        rangeMin: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '55',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should allow number with valid exact', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Length,
        selectedValidation: NumberSelectedValidation.Exact,
        customVal: 2,
        rangeMax: null,
        rangeMin: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '55',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should disallow number with invalid exact', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Length,
        selectedValidation: NumberSelectedValidation.Exact,
        customVal: 2,
        rangeMax: null,
        rangeMin: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '5',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isErr()).toBe(true)
    expect(validateResult._unsafeUnwrapErr()).toEqual(
      new ValidateFieldError('Invalid answer submitted'),
    )
  })

  it('should allow number with valid minimum value', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Value,
        selectedValidation: null,
        customVal: null,
        rangeMax: null,
        rangeMin: 45,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '55',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should disallow number with invalid minimum value', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Value,
        selectedValidation: null,
        customVal: null,
        rangeMax: null,
        rangeMin: 6,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '5',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isErr()).toBe(true)
    expect(validateResult._unsafeUnwrapErr()).toEqual(
      new ValidateFieldError('Invalid answer submitted'),
    )
  })

  it('should allow number with valid maximum value', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Value,
        selectedValidation: null,
        customVal: null,
        rangeMax: 65,
        rangeMin: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '55',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should disallow number with invalid maximum value', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Value,
        selectedValidation: null,
        customVal: null,
        rangeMax: 4,
        rangeMin: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '5',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isErr()).toBe(true)
    expect(validateResult._unsafeUnwrapErr()).toEqual(
      new ValidateFieldError('Invalid answer submitted'),
    )
  })

  it('should allow number within minimum and maximum range', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Value,
        selectedValidation: null,
        customVal: null,
        rangeMax: 65,
        rangeMin: 45,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '55',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should disallow number beyond minimum and maximum range', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Value,
        selectedValidation: null,
        customVal: null,
        rangeMax: 4,
        rangeMin: 1,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '5',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isErr()).toBe(true)
    expect(validateResult._unsafeUnwrapErr()).toEqual(
      new ValidateFieldError('Invalid answer submitted'),
    )
  })

  it('should allow number with maximum left undefined', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Length,
        selectedValidation: NumberSelectedValidation.Maximum,
        customVal: null,
        rangeMax: null,
        rangeMin: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '55',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should allow number with minimum left undefined', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Length,
        selectedValidation: NumberSelectedValidation.Minimum,
        customVal: null,
        rangeMax: null,
        rangeMin: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '55',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should allow number with exact undefined', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidationType: NumberValidationType.Length,
        selectedValidation: NumberSelectedValidation.Exact,
        customVal: null,
        rangeMax: null,
        rangeMin: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '55',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should allow number with no custom validation', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidation: null,
        customVal: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '55',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should allow number with optional answer', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidation: null,
        customVal: null,
      },
      required: false,
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '55',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should allow answer to be zero', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidation: null,
        customVal: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '0',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should disallow negative answers', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidation: null,
        customVal: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '-55',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isErr()).toBe(true)
    expect(validateResult._unsafeUnwrapErr()).toEqual(
      new ValidateFieldError('Invalid answer submitted'),
    )
  })

  it('should allow leading zeroes in answer', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidation: null,
        customVal: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '05',
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isOk()).toBe(true)
    expect(validateResult._unsafeUnwrap()).toEqual(true)
  })

  it('should disallow responses submitted for hidden fields', () => {
    const formField = generateDefaultField(BasicField.Number, {
      ValidationOptions: {
        selectedValidation: null,
        customVal: null,
      },
    })
    const response = generateNewSingleAnswerResponse(BasicField.Number, {
      answer: '2',
      isVisible: false,
    })
    const validateResult = validateField('formId', formField, response)
    expect(validateResult.isErr()).toBe(true)
    expect(validateResult._unsafeUnwrapErr()).toEqual(
      new ValidateFieldError('Attempted to submit response on a hidden field'),
    )
  })
})
