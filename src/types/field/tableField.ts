import { Document } from 'mongoose'

import { BasicField, Column, TableFieldBase } from '../../../shared/types/field'
import { IFormSchema } from '../form'

import { IFieldSchema } from './baseField'

export type IColumn = Column

export type IColumnSchema = Column &
  Document & {
    /** Returns the top level document of this sub-document. */
    ownerDocument(): IFormSchema
    /** Returns this sub-documents parent document. */
    parent(): ITableFieldSchema
  }

export interface ITableField extends TableFieldBase {
  columns: IColumnSchema[]
}
export interface ITableFieldSchema extends ITableField, IFieldSchema {
  fieldType: BasicField.Table
}
