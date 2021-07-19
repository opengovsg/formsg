import { BasicField, ShortTextFieldBase } from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export type IShortTextField = ShortTextFieldBase
export interface IShortTextFieldSchema extends IShortTextField, IFieldSchema {
  fieldType: BasicField.ShortText
}
