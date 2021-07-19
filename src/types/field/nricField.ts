import { BasicField, NricFieldBase } from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export type INricField = NricFieldBase

export interface INricFieldSchema extends INricField, IFieldSchema {
  fieldType: BasicField.Nric
}
