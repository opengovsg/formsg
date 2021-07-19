import { BasicField, UenFieldBase } from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export type IUenField = UenFieldBase

export interface IUenFieldSchema extends IUenField, IFieldSchema {
  fieldType: BasicField.Uen
}
