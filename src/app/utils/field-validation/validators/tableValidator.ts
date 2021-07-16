import { chain, left, right } from 'fp-ts/lib/Either'
import { flow } from 'fp-ts/lib/function'

import {
  BasicField,
  ITableFieldSchema,
  OmitUnusedValidatorProps,
} from '../../../../types/field'
import { ResponseValidator } from '../../../../types/field/utils/validation'
import {
  ProcessedSingleAnswerResponse,
  ProcessedTableResponse,
} from '../../../modules/submission/submission.types'
import { createAnswerFieldFromColumn } from '../answerField.factory'
import { validateField } from '..'

const ALLOWED_COLUMN_TYPES = [BasicField.ShortText, BasicField.Dropdown]

type TableValidator = ResponseValidator<ProcessedTableResponse>
type TableValidatorConstructor = (
  tableField: OmitUnusedValidatorProps<ITableFieldSchema>,
) => TableValidator

/**
 * Returns a validation function to check if the
 * response has less than the minimum number of rows specified.
 */
const makeMinimumRowsValidator: TableValidatorConstructor =
  (tableField) => (response) => {
    const { answerArray } = response
    const { minimumRows } = tableField

    return answerArray.length >= minimumRows
      ? right(response)
      : left(`TableValidator:\tanswer has less than the minimum number of rows`)
  }

/**
 * Returns a validation function to check if addMoreRows is not set
 * and if so, whether the response has more than minimum number of rows.
 */
const makeAddMoreRowsValidator: TableValidatorConstructor =
  (tableField) => (response) => {
    const { answerArray } = response
    const { minimumRows, addMoreRows } = tableField

    if (addMoreRows) return right(response)
    return answerArray.length === minimumRows
      ? right(response)
      : left(
          `TableValidator:\tanswer has extra rows even though addMoreRows is false`,
        )
  }

/**
 * Returns a validation function to check if the
 * response has more than the maximum number of rows specified.
 */
const makeMaximumRowsValidator: TableValidatorConstructor =
  (tableField) => (response) => {
    const { answerArray } = response
    const { maximumRows } = tableField

    if (!maximumRows) return right(response)

    return answerArray.length <= maximumRows
      ? right(response)
      : left(`TableValidator:\tanswer has more than the maximum number of rows`)
  }

/**
 * Returns a validation function to check if the
 * response has the correct number of answers for each row.
 */
const makeRowLengthValidator: TableValidatorConstructor =
  (tableField) => (response) => {
    const { answerArray } = response
    const { columns } = tableField

    return answerArray.every((row) => row.length === columns.length)
      ? right(response)
      : left(
          `TableValidator:\tanswer has rows with incorrect number of answers`,
        )
  }

/**
 * Returns a validation function that checks that the columns only have allowed types
 */

const makeColumnTypeValidator: TableValidatorConstructor =
  (tableField) => (response) => {
    const { columns } = tableField
    return columns.every((column) =>
      ALLOWED_COLUMN_TYPES.includes(column.columnType),
    )
      ? right(response)
      : left(`TableValidator:\tanswer has columns with non-allowed types`)
  }

/**
 * Returns a validation function that applies
 * the correct validator for each table cell.
 */

const makeTableCellValidator: TableValidatorConstructor =
  (tableField) => (response) => {
    const { answerArray, isVisible, _id } = response
    const { columns } = tableField
    const answerFieldColumns = columns.map((column) =>
      createAnswerFieldFromColumn(column),
    )

    return answerArray.every((row) => {
      return row.every((answer, i) => {
        const answerField = answerFieldColumns[i]
        const answerResponse: ProcessedSingleAnswerResponse = {
          answer,
          isVisible,
          fieldType: answerField.fieldType,
          _id,
          question: answerField.title,
        }

        return validateField(
          answerField._id || 'Table field validation',
          answerField,
          answerResponse,
        ).isOk()
      })
    })
      ? right(response)
      : left(`TableValidator:\tanswer failed field validation`)
  }

/**
 * Returns a validation function for a table field when called.
 */
export const constructTableValidator: TableValidatorConstructor = (
  tableField,
) =>
  flow(
    makeMinimumRowsValidator(tableField),
    chain(makeAddMoreRowsValidator(tableField)),
    chain(makeMaximumRowsValidator(tableField)),
    chain(makeRowLengthValidator(tableField)),
    chain(makeColumnTypeValidator(tableField)),
    chain(makeTableCellValidator(tableField)),
  )
