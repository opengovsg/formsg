import { BasicField, FieldBase, MyInfoableFieldBase } from './base'
import { TextValidationOptions } from './utils'

export interface ShortTextFieldBase extends MyInfoableFieldBase, FieldBase {
  fieldType: BasicField.ShortText
  ValidationOptions: TextValidationOptions
  allowPrefill?: boolean
}
