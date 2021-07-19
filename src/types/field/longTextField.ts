import { BasicField, LongTextFieldBase } from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export type ILongTextField = LongTextFieldBase

export interface ILongTextFieldSchema extends ILongTextField, IFieldSchema {
  fieldType: BasicField.LongText
}
