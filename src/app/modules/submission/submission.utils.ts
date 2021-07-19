import { differenceBy, intersectionBy, keyBy, uniqBy } from 'lodash'
import { err, ok, Result } from 'neverthrow'

import { FIELDS_TO_REJECT } from '../../../shared/resources/basic'
import {
  BasicField,
  FieldResponse,
  FormFieldSchema,
  IFormDocument,
  ResponseMode,
} from '../../../types'
import { AutoReplyMailData } from '../../services/mail/mail.types'

import { IncomingSubmission } from './IncomingSubmission.class'
import { ConflictError } from './submission.errors'
import { FilteredResponse } from './submission.types'

type ModeFilterParam = {
  fieldType: BasicField
}

export const getModeFilter = (
  responseMode: ResponseMode,
): (<T extends ModeFilterParam>(responses: T[]) => T[]) => {
  switch (responseMode) {
    case ResponseMode.Email:
      return emailModeFilter
    case ResponseMode.Encrypt:
      return encryptModeFilter
  }
}

const emailModeFilter = <T extends ModeFilterParam>(responses: T[]) => {
  return responses.filter(
    ({ fieldType }) => !FIELDS_TO_REJECT.includes(fieldType),
  )
}

const encryptModeFilter = <T extends ModeFilterParam>(responses: T[] = []) => {
  // To filter for autoreply-able fields.
  return responses.filter(({ fieldType }) =>
    [BasicField.Mobile, BasicField.Email].includes(fieldType),
  )
}

/**
 * Extracts response data to be sent in email confirmations
 * @param responses Responses from form filler
 * @param formFields Fields from form object
 * @returns Array of data for email confirmations
 */
// TODO: Migrate to extractEmailConfirmationDataFromIncomingSubmission
export const extractEmailConfirmationData = (
  responses: FieldResponse[],
  formFields: FormFieldSchema[] | undefined,
): AutoReplyMailData[] => {
  const fieldsById = keyBy(formFields, '_id')
  return responses.reduce<AutoReplyMailData[]>((acc, response) => {
    const field = fieldsById[response._id]
    if (
      field &&
      field.fieldType === BasicField.Email &&
      response.fieldType === BasicField.Email &&
      response.answer
    ) {
      const options = field.autoReplyOptions
      if (options.hasAutoReply) {
        acc.push({
          email: response.answer,
          subject: options.autoReplySubject,
          sender: options.autoReplySender,
          body: options.autoReplyMessage,
          includeFormSummary: options.includeFormSummary,
        })
      }
    }
    return acc
  }, [])
}

/**
 * Extracts response data to be sent in email confirmations
 * @param responses Responses from form filler
 * @param formFields Fields from form object
 * @returns Array of data for email confirmations
 */
export const extractEmailConfirmationDataFromIncomingSubmission = (
  incomingSubmission: IncomingSubmission,
): AutoReplyMailData[] => {
  const { responses, form } = incomingSubmission
  return extractEmailConfirmationData(responses, form.form_fields)
}

/**
 * Filter allowed form field responses from given responses and return the
 * array of responses with duplicates removed.
 *
 * @param form The form document
 * @param responses the responses that corresponds to the given form
 * @returns neverthrow ok() filtered list of allowed responses with duplicates (if any) removed
 * @returns neverthrow err(ConflictError) if the given form's form field ids count do not match given responses'
 */
export const getFilteredResponses = (
  form: IFormDocument,
  responses: FieldResponse[],
): Result<FilteredResponse[], ConflictError> => {
  const modeFilter = getModeFilter(form.responseMode)

  if (!form.form_fields) {
    return err(new ConflictError('Form fields are missing'))
  }
  // _id must be transformed to string as form response is jsonified.
  const fieldIds = modeFilter(form.form_fields).map((field) => ({
    _id: String(field._id),
  }))
  const uniqueResponses = uniqBy(modeFilter(responses), '_id')
  const results = intersectionBy(uniqueResponses, fieldIds, '_id')

  if (results.length < fieldIds.length) {
    const onlyInForm = differenceBy(fieldIds, results, '_id').map(
      ({ _id }) => _id,
    )
    return err(
      new ConflictError('Some form fields are missing', {
        formId: form._id,
        onlyInForm,
      }),
    )
  }
  return ok(results as FilteredResponse[])
}
