import { chain, left, right } from 'fp-ts/lib/Either'
import { flow } from 'fp-ts/lib/function'

import { TextSelectedValidation } from '../../../../../shared/types/field'
import {
  ILongTextFieldSchema,
  IShortTextFieldSchema,
  OmitUnusedValidatorProps,
} from '../../../../types/field'
import { ResponseValidator } from '../../../../types/field/utils/validation'
import { ProcessedSingleAnswerResponse } from '../../../modules/submission/submission.types'

import { notEmptySingleAnswerResponse } from './common'

type TextFieldValidatorConstructor = (
  textField:
    | OmitUnusedValidatorProps<IShortTextFieldSchema>
    | OmitUnusedValidatorProps<ILongTextFieldSchema>,
) => ResponseValidator<ProcessedSingleAnswerResponse>

/**
 * Returns a validator to check if
 * text length is less than the min length specified.
 */
const minLengthValidator: TextFieldValidatorConstructor =
  (textField) => (response) => {
    const { customVal: min } = textField.ValidationOptions
    if (min === null) return right(response)
    return response.answer.length >= min
      ? right(response)
      : left(`TextValidator.minLength:\tanswer is less than minimum of ${min}`)
  }

/**
 * Returns a validator to check if
 * text length is more than the max length specified.
 */
const maxLengthValidator: TextFieldValidatorConstructor =
  (textField) => (response) => {
    const { customVal: max } = textField.ValidationOptions
    if (max === null) return right(response)
    return response.answer.length <= max
      ? right(response)
      : left(
          `TextValidator.maxLength:\tanswer is greater than maximum of ${max}`,
        )
  }

/**
 * Returns a validator to check if
 * text length is the exact length specified.
 */
const exactLengthValidator: TextFieldValidatorConstructor =
  (textField) => (response) => {
    const { customVal: exact } = textField.ValidationOptions
    if (exact === null) return right(response)
    return response.answer.length === exact
      ? right(response)
      : left(
          `TextValidator.exactLength:\tanswer is not exactly equal to ${exact}`,
        )
  }

/**
 * Returns the appropriate validator
 * based on the text length validation option selected.
 */
const getLengthValidator: TextFieldValidatorConstructor = (textField) => {
  switch (textField.ValidationOptions.selectedValidation) {
    case TextSelectedValidation.Exact:
      return exactLengthValidator(textField)
    case TextSelectedValidation.Minimum:
      return minLengthValidator(textField)
    case TextSelectedValidation.Maximum:
      return maxLengthValidator(textField)
    default:
      return right
  }
}

/**
 * Returns a validation function for a text field when called.
 */
const constructTextValidator: TextFieldValidatorConstructor = (textField) => {
  return flow(
    notEmptySingleAnswerResponse,
    chain(getLengthValidator(textField)),
  )
}

export default constructTextValidator
