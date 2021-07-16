import { chain, left, right } from 'fp-ts/lib/Either'
import { flow } from 'fp-ts/lib/function'

import { ProcessedSingleAnswerResponse } from 'src/app/modules/submission/submission.types'
import { INumberFieldSchema, OmitUnusedValidatorProps } from 'src/types/field'
import { ResponseValidator } from 'src/types/field/utils/validation'

import { NumberSelectedValidation } from '../../../../types/field'

import { notEmptySingleAnswerResponse } from './common'

type NumberValidator = ResponseValidator<ProcessedSingleAnswerResponse>
type NumberValidatorConstructor = (
  numberField: OmitUnusedValidatorProps<INumberFieldSchema>,
) => NumberValidator

/**
 * Return a validator to check if number format is correct.
 */
const numberFormatValidator: NumberValidator = (response) => {
  const { answer } = response
  return /^\d*$/.test(answer)
    ? right(response)
    : left(`NumberValidator:\t answer is not a valid number format`)
}

/**
 * Returns a validation function to check if number length is
 * less than the minimum length specified.
 */
const minLengthValidator: NumberValidatorConstructor =
  (numberField) => (response) => {
    const { answer } = response
    const { customVal } = numberField.ValidationOptions
    return !customVal || answer.length >= customVal
      ? right(response)
      : left(`NumberValidator:\t answer is shorter than custom minimum length`)
  }

/**
 * Returns a validation function to check if number length is
 * more than the maximum length specified.
 */
const maxLengthValidator: NumberValidatorConstructor =
  (numberField) => (response) => {
    const { answer } = response
    const { customVal } = numberField.ValidationOptions
    return !customVal || answer.length <= customVal
      ? right(response)
      : left(`NumberValidator:\t answer is longer than custom maximum length`)
  }

/**
 * Returns a validation function to check if number length is
 * equal to the exact length specified.
 */
const exactLengthValidator: NumberValidatorConstructor =
  (numberField) => (response) => {
    const { answer } = response
    const { customVal } = numberField.ValidationOptions
    return !customVal || answer.length === customVal
      ? right(response)
      : left(`NumberValidator:\t answer does not match custom exact length`)
  }

/**
 * Returns the appropriate validation function
 * based on the number validation option selected.
 */
const getNumberLengthValidator: NumberValidatorConstructor = (numberField) => {
  switch (numberField.ValidationOptions.selectedValidation) {
    case NumberSelectedValidation.Min:
      return minLengthValidator(numberField)
    case NumberSelectedValidation.Max:
      return maxLengthValidator(numberField)
    case NumberSelectedValidation.Exact:
      return exactLengthValidator(numberField)
    default:
      return right
  }
}

/**
 * Returns a validation function for a number field when called.
 */
export const constructNumberValidator: NumberValidatorConstructor = (
  numberField,
) =>
  flow(
    notEmptySingleAnswerResponse,
    chain(numberFormatValidator),
    chain(getNumberLengthValidator(numberField)),
  )
