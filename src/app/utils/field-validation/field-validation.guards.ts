import { types as basicTypes } from '../../../shared/resources/basic'
import {
  BasicField,
  IEmailFieldSchema,
  IFieldSchema,
  ITableRow,
} from '../../../types'
import {
  ColumnResponse,
  ProcessedAttachmentResponse,
  ProcessedCheckboxResponse,
  ProcessedFieldResponse,
  ProcessedSingleAnswerResponse,
  ProcessedTableResponse,
} from '../../modules/submission/submission.types'

const singleAnswerFieldTypes = basicTypes
  .filter((field) => !field.answerArray && field.name !== BasicField.Attachment)
  .map((f) => f.name)

export const isProcessedSingleAnswerResponse = (
  response: ProcessedFieldResponse,
): response is ProcessedSingleAnswerResponse => {
  return (
    singleAnswerFieldTypes.includes(response.fieldType) &&
    'answer' in response &&
    typeof response.answer === 'string'
  )
}

export const isProcessedCheckboxResponse = (
  response: ProcessedFieldResponse,
): response is ProcessedCheckboxResponse => {
  return (
    response.fieldType === BasicField.Checkbox &&
    'answerArray' in response &&
    isStringArray(response.answerArray)
  )
}

const isStringArray = (arr: unknown): arr is string[] =>
  Array.isArray(arr) && arr.every((item) => typeof item === 'string')

// Check that the row contains a single array of only string (including empty string)
export const isTableRow = (row: unknown): row is ITableRow =>
  isStringArray(row) && row.length > 0

export const isProcessedTableResponse = (
  response: ProcessedFieldResponse,
): response is ProcessedTableResponse => {
  if (
    response.fieldType === BasicField.Table &&
    'answerArray' in response &&
    Array.isArray(response.answerArray) &&
    response.answerArray.length > 0 &&
    response.answerArray.every(isTableRow)
  ) {
    // Check that all arrays in answerArray have the same length
    const subArrLength: number = response.answerArray[0].length
    return response.answerArray.every((arr) => arr.length === subArrLength)
  }
  return false
}

export const isColumnResponseContainingAnswer = (
  response: ColumnResponse,
): response is ProcessedSingleAnswerResponse => {
  return 'answer' in response
}

export const isProcessedAttachmentResponse = (
  response: ProcessedFieldResponse,
): response is ProcessedAttachmentResponse => {
  return (
    response.fieldType === BasicField.Attachment &&
    'answer' in response &&
    typeof response.answer === 'string'
    // No check for response.filename as response.filename is generated only when actual file is uploaded
    // Hence hidden attachment fields - which still return empty response - will not have response.filename property
  )
}

export const isEmailFieldSchema = (
  field: IFieldSchema,
): field is IEmailFieldSchema => {
  return field.fieldType === BasicField.Email
}
