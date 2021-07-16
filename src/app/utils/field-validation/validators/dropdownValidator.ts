import { chain, left, right } from 'fp-ts/lib/Either'
import { flow } from 'fp-ts/lib/function'

import { ProcessedSingleAnswerResponse } from 'src/app/modules/submission/submission.types'
import { IDropdownFieldSchema, OmitUnusedValidatorProps } from 'src/types/field'
import { ResponseValidator } from 'src/types/field/utils/validation'

import { getMyInfoFieldOptions } from '../../../modules/myinfo/myinfo.util'

import { notEmptySingleAnswerResponse } from './common'
import { isOneOfOptions } from './options'

type DropdownValidator = ResponseValidator<ProcessedSingleAnswerResponse>
type DropdownValidatorConstructor = (
  dropdownField: OmitUnusedValidatorProps<IDropdownFieldSchema>,
) => DropdownValidator

/**
 * Returns a validation function
 * to check if dropdown selection is one of the options.
 */
const makeDropdownValidator: DropdownValidatorConstructor =
  (dropdownField) => (response) => {
    const { myInfo, fieldOptions } = dropdownField
    // Inject fieldOptions for MyInfo. This is necessary because the
    // client strips out MyInfo data to keep each form submission lightweight
    const validOptions = myInfo?.attr
      ? getMyInfoFieldOptions(myInfo.attr)
      : fieldOptions
    const { answer } = response
    return isOneOfOptions(validOptions, answer)
      ? right(response)
      : left(`DropdownValidator:\t answer is not a valid dropdown option`)
  }

/**
 * Returns a validation function for a dropdown field when called.
 */
export const constructDropdownValidator: DropdownValidatorConstructor = (
  dropdownField,
) =>
  flow(
    notEmptySingleAnswerResponse,
    chain(makeDropdownValidator(dropdownField)),
  )
