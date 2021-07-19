import {
  IColumnSchema,
  IDropdownFieldSchema,
  IShortTextFieldSchema,
  OmitUnusedValidatorProps,
} from '../../../types'

/**
 * Return type of createAnswerFieldFromColumn().
 * This is a subset of IFieldSchema (note that the
 * fieldType is restricted) and allows the result to be
 * passed into validateField().
 * */
type ColumnWithFieldProperties =
  | OmitUnusedValidatorProps<IShortTextFieldSchema>
  | OmitUnusedValidatorProps<IDropdownFieldSchema>

/**
 * Takes a table field column and generates a form field by
 * filling in the missing fieldType attribute.
 * */
export const createAnswerFieldFromColumn = (
  column: IColumnSchema,
): ColumnWithFieldProperties => {
  return {
    ...column.toObject(),
    fieldType: column.columnType,
  } as ColumnWithFieldProperties
}
