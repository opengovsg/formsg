import { chain, left, right } from 'fp-ts/lib/Either'
import { flow } from 'fp-ts/lib/function'

import { ProcessedSingleAnswerResponse } from 'src/app/modules/submission/submission.types'
import { IRadioFieldSchema, OmitUnusedValidatorProps } from 'src/types/field'
import { ResponseValidator } from 'src/types/field/utils/validation'

import { notEmptySingleAnswerResponse } from './common'
import { isOneOfOptions, isOtherOption } from './options'

type RadioButtonValidator = ResponseValidator<ProcessedSingleAnswerResponse>
type RadioButtonValidatorConstructor = (
  radioButtonField: OmitUnusedValidatorProps<IRadioFieldSchema>,
) => RadioButtonValidator

/**
 * Returns a validation function to check if the
 * selected radio option is one of the specified options.
 */
const makeRadioOptionsValidator: RadioButtonValidatorConstructor =
  (radioButtonField) => (response) => {
    const { answer } = response
    const { fieldOptions, othersRadioButton } = radioButtonField
    const isValid =
      isOneOfOptions(fieldOptions, answer) ||
      isOtherOption(othersRadioButton, answer)

    return isValid
      ? right(response)
      : left(`RadioButtonValidator:\tanswer is not a valid radio button option`)
  }

/**
 * Returns a validation function for a radio button field when called.
 */
export const constructRadioButtonValidator: RadioButtonValidatorConstructor = (
  radioButtonField,
) =>
  flow(
    notEmptySingleAnswerResponse,
    chain(makeRadioOptionsValidator(radioButtonField)),
  )
