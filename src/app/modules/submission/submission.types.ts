import { Opaque } from 'type-fest'

import {
  FieldResponse,
  IAttachmentResponse,
  ICheckboxResponse,
  ISingleAnswerResponse,
  ITableResponse,
} from 'src/types/response'

import { BasicField, FormFieldSchema } from '../../../types/field'

export type ProcessedResponse = {
  question: string
  isVisible?: boolean
  isUserVerified?: boolean
}

/**
 * Represents a field map that is guaranteed to contain the id of
 * ALL field responses in an incoming submission.
 */
export type ValidatedFieldMap = Opaque<
  { [p: string]: FormFieldSchema },
  'ValidatedFieldMap'
>

export type VisibleResponseIdSet = Opaque<Set<string>, 'VisibleResponseIdSet'>

export type VerifiableResponseIdSet = Opaque<
  Set<string>,
  'VerifiableResponseIdSet'
>

/**
 * Represents a response allowed by `getModeFilter`. When presented as a
 * list, additionally guarantees that duplicates (if any) are removed.
 * Instantiated ONLY via `getFilteredResponses`.
 */
export type FilteredResponse = Opaque<FieldResponse, 'FilteredResponse'>

export type ColumnResponse = {
  fieldType: BasicField
  answer: string
  isVisible?: boolean
}

export type ProcessedSingleAnswerResponse = ISingleAnswerResponse &
  ProcessedResponse

export type ProcessedCheckboxResponse = ICheckboxResponse & ProcessedResponse
export type ProcessedTableResponse = ITableResponse & ProcessedResponse
export type ProcessedAttachmentResponse = IAttachmentResponse &
  ProcessedResponse

export type ProcessedFieldResponse =
  | ProcessedSingleAnswerResponse
  | ProcessedCheckboxResponse
  | ProcessedTableResponse
  | ProcessedAttachmentResponse
