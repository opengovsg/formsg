import { Document } from 'mongoose'

import { AllowMyInfoBase, FieldBase } from '../../../shared/types/field'
import { IFormSchema } from '../form'

export type IMyInfo = NonNullable<AllowMyInfoBase['myInfo']>
export interface IMyInfoSchema extends IMyInfo, Document {
  /** Returns the top level document of this sub-document. */
  ownerDocument(): IFormSchema
  /** Returns this sub-documents parent document. */
  parent(): IFieldSchema
}

export type IField = FieldBase

// Manual override since mongoose types don't have generics yet.
export interface IFieldSchema extends AllowMyInfoBase, FieldBase, Document {
  /** Returns the top level document of this sub-document. */
  ownerDocument(): IFormSchema
  /** Returns this sub-documents parent document. */
  parent(): IFormSchema

  // Discriminatable parameter
  isVerifiable?: boolean

  // Instance methods
  /**
   * Returns the string to be displayed as the asked question in form
   * responses.
   */
  getQuestion(): string
}

// We don't store a fieldValue in the database, but the client
// needs it as a variable to store the client's answer to a field.
// Hence we need this interface for client-side fields.
export interface IClientFieldSchema extends IFieldSchema {
  fieldValue: string
}
