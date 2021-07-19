import { BasicField, FieldBase } from './base'

export type DecimalValidationOptions = {
  customMax: number | null
  customMin: number | null
}

export interface DecimalFieldBase extends FieldBase {
  fieldType: BasicField.Decimal
  ValidationOptions: DecimalValidationOptions
  validateByValue: boolean
}
