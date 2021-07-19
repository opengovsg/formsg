import { BasicField, DropdownFieldBase } from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export type IDropdownField = DropdownFieldBase

export interface IDropdownFieldSchema extends IDropdownField, IFieldSchema {
  fieldType: BasicField.Dropdown
}
