import { left, right } from 'fp-ts/lib/Either'

import { ProcessedSingleAnswerResponse } from 'src/app/modules/submission/submission.types'
import {
  IEmailFieldSchema,
  IMobileFieldSchema,
  OmitUnusedValidatorProps,
} from 'src/types/field'
import { ResponseValidator } from 'src/types/field/utils/validation'

import formsgSdk from '../../../config/formsg-sdk'

/**
 * A function which returns a validator to check if single answer has a non-empty response
 */
export const notEmptySingleAnswerResponse: ResponseValidator<ProcessedSingleAnswerResponse> =
  (response) => {
    if (response.answer.trim().length === 0)
      return left(
        'CommonValidator.notEmptySingleAnswerResponse:\tanswer is an empty string',
      )
    return right(response)
  }

/**
 * A function which returns a signature validator constructor for mobile and email verified field.
 * The validator checks if field has correct signature.
 */
export const makeSignatureValidator: (
  formField:
    | OmitUnusedValidatorProps<IEmailFieldSchema>
    | OmitUnusedValidatorProps<IMobileFieldSchema>,
) => ResponseValidator<ProcessedSingleAnswerResponse> =
  (formField) => (response) => {
    const { isVerifiable, _id } = formField
    if (!isVerifiable) {
      return right(response) // no validation occurred
    }
    const { signature, answer } = response
    if (!signature) {
      return left(
        `CommonValidator.makeSignatureValidator:\t answer does not have valid signature`,
      )
    }
    const isSigned =
      formsgSdk.verification.authenticate &&
      formsgSdk.verification.authenticate({
        signatureString: signature,
        submissionCreatedAt: Date.now(),
        fieldId: _id,
        answer,
      })

    return isSigned
      ? right(response)
      : left(
          `CommonValidator.makeSignatureValidator:\t answer does not have valid signature`,
        )
  }
