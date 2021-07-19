import { BasicField, CheckboxFieldBase } from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export type ICheckboxField = CheckboxFieldBase

export interface ICheckboxFieldSchema extends ICheckboxField, IFieldSchema {
  fieldType: BasicField.Checkbox
}
