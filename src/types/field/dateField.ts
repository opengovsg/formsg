import { BasicField, DateFieldBase } from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export type IDateField = DateFieldBase

export interface IDateFieldSchema extends DateFieldBase, IFieldSchema {
  fieldType: BasicField.Date
}
