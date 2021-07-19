import { BasicField, FieldBase } from './base'
import { TextValidationOptions } from './utils'

export interface LongTextFieldBase extends FieldBase {
  fieldType: BasicField.LongText
  ValidationOptions: TextValidationOptions
}
