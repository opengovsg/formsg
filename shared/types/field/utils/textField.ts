/**
 * Utility types for fields that extend text field
 * (i.e. short and long text field)
 */

export enum TextSelectedValidation {
  Maximum = 'Maximum',
  Minimum = 'Minimum',
  Exact = 'Exact',
}

export type TextValidationOptions = {
  customVal: number | null
  selectedValidation: TextSelectedValidation | null
}
