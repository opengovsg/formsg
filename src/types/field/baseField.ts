import { Document } from 'mongoose'

import { IFormSchema } from '../form'

import { BasicField, MyInfoAttribute } from './fieldTypes'

export interface IMyInfo {
  attr: MyInfoAttribute
}

export interface IMyInfoSchema extends IMyInfo, Document {
  /** Returns the top level document of this sub-document. */
  ownerDocument(): IFormSchema
  /** Returns this sub-documents parent document. */
  parent(): IFieldSchema
}

export interface IField {
  globalId?: string
  title: string
  description: string
  required: boolean
  disabled: boolean
  fieldType: BasicField
  myInfo?: IMyInfo
}

// Manual override since mongoose types don't have generics yet.
export interface IFieldSchema extends IField, Document {
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

export enum TextSelectedValidation {
  Maximum = 'Maximum',
  Minimum = 'Minimum',
  Exact = 'Exact',
}
