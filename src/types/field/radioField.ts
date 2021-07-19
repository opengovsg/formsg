import { BasicField, RadioFieldBase } from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export type IRadioField = RadioFieldBase
export interface IRadioFieldSchema extends IRadioField, IFieldSchema {
  fieldType: BasicField.Radio
}
