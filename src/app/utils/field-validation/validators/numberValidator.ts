import { chain, left, right } from 'fp-ts/lib/Either'
import { flow } from 'fp-ts/lib/function'

import { ProcessedSingleAnswerResponse } from 'src/app/modules/submission/submission.types'
import { INumberField } from 'src/types/field'
import { ResponseValidator } from 'src/types/field/utils/validation'

import {
  NumberSelectedValidation,
  NumberValidationType,
} from '../../../../types'

import { notEmptySingleAnswerResponse } from './common'

type NumberValidator = ResponseValidator<ProcessedSingleAnswerResponse>
type NumberValidatorConstructor = (numberField: INumberField) => NumberValidator

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
 * based on the number length validation option selected.
 */
const getNumberLengthValidator: NumberValidatorConstructor = (numberField) => {
  switch (numberField.ValidationOptions.selectedValidation) {
    case NumberSelectedValidation.Minimum:
      return minLengthValidator(numberField)
    case NumberSelectedValidation.Maximum:
      return maxLengthValidator(numberField)
    case NumberSelectedValidation.Exact:
      return exactLengthValidator(numberField)
    default:
      return right
  }
}

/**
 * Returns a validation function to check if number value is
 * less than the minimum value specified.
 */
const rangeValidator: NumberValidatorConstructor =
  (numberField) => (response) => {
    const { answer } = response
    const { rangeMin, rangeMax } = numberField.ValidationOptions

    if (rangeMin && Number(answer) < rangeMin) {
      return left(
        `NumberValidator:\t answer is smaller than custom minimum value`,
      )
    }

    if (rangeMax && Number(answer) > rangeMax) {
      return left(
        `NumberValidator:\t answer is larger than custom maximum value`,
      )
    }

    return right(response)
  }

/**
 * Returns the appropriate validation function
 * based on the number range validation option selected.
 */
const getNumberRangeValidator: NumberValidatorConstructor = (numberField) => {
  switch (numberField.ValidationOptions.selectedValidationType) {
    case NumberValidationType.Value:
      return rangeValidator(numberField)
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
    chain(getNumberRangeValidator(numberField)),
  )
