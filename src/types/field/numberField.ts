import {
  BasicField,
  NumberFieldBase,
  NumberSelectedValidation,
  NumberValidationOptions,
} from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export { NumberValidationOptions, NumberSelectedValidation }

export type INumberField = NumberFieldBase
export interface INumberFieldSchema extends INumberField, IFieldSchema {
  fieldType: BasicField.Number
}
