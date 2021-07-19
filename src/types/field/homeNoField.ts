import { BasicField, HomenoFieldBase } from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export type IHomenoField = HomenoFieldBase

export interface IHomenoFieldSchema extends IHomenoField, IFieldSchema {
  fieldType: BasicField.HomeNo
}
