import { BasicField, DecimalFieldBase } from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export type IDecimalField = DecimalFieldBase

export interface IDecimalFieldSchema extends IDecimalField, IFieldSchema {
  fieldType: BasicField.Decimal
}
