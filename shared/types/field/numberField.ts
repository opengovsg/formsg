import { BasicField, MyInfoableFieldBase } from './base'

export enum NumberSelectedValidation {
  Max = 'Maximum',
  Min = 'Minimum',
  Exact = 'Exact',
}

export type NumberValidationOptions = {
  customVal: number | null
  selectedValidation: NumberSelectedValidation | null
}

export interface NumberFieldBase extends MyInfoableFieldBase {
  fieldType: BasicField.Number
  ValidationOptions: NumberValidationOptions
}
