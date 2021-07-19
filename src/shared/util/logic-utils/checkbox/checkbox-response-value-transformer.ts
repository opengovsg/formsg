/* eslint-disable typesafe/no-throw-sync-func */
import { cloneDeep, omit } from 'lodash'

import {
  BasicField,
  FieldSchemaOrResponse,
  ICheckboxField,
  ICheckboxResponse,
  IField,
  ILogicCheckboxResponse,
  ILogicClientFieldSchema,
  ILogicInputClientSchema,
  IPopulatedForm,
} from '../../../../types'
import { isCheckboxField } from '../../../../types/field/utils/guards'
import { hasProp } from '../../has-prop'
import { LogicFieldSchemaOrResponse } from '../../logic'

/**
 * Adaptor function to transform checkbox field response values into checkbox condition shape
 * @param field Logic field from either the backend or frontend
 * @param form
 * @returns Checkbox field response in checkbox condition shape
 * @throws Error if checkbox value has invalid shape or if field cannot be found in the form
 */
export const transformCheckboxForLogic = (
  field: FieldSchemaOrResponse,
  formFields: IPopulatedForm['form_fields'],
): LogicFieldSchemaOrResponse => {
  field = cloneDeep(field) // clone field to prevent changes to original
  if (isClientCheckboxValue(field)) {
    return convertClientCheckboxValue(field, formFields)
  } else if (isServerCheckboxValue(field)) {
    return convertServerCheckboxValue(field, formFields)
  } else {
    // eslint-disable-next-line typesafe/no-throw-sync-func
    throw new Error('Checkbox value shape is invalid')
  }
}

type ClientCheckboxField = Omit<ILogicInputClientSchema, 'fieldValue'> & {
  fieldValue: boolean[]
}

type TransformedClientCheckboxField = ILogicClientFieldSchema

const isClientCheckboxValue = (
  field: FieldSchemaOrResponse,
): field is ClientCheckboxField => {
  if (field.fieldType !== BasicField.Checkbox) {
    return false
  }
  return (
    hasProp(field, 'fieldValue') &&
    Array.isArray(field.fieldValue) &&
    (field.fieldValue as unknown[]).every((value) => typeof value === 'boolean')
  )
}

const convertClientCheckboxValue = (
  field: ClientCheckboxField,
  formFields: IPopulatedForm['form_fields'],
): TransformedClientCheckboxField => {
  const completeField = getCheckboxField(field, formFields)
  const others = field.fieldValue[completeField.fieldOptions.length]
  const options = completeField.fieldOptions.filter(
    (_, i) => field.fieldValue[i],
  )

  return {
    ...omit(field, ['fieldValue']),
    fieldValue: { options, others },
  }
}

type ServerCheckboxField = ICheckboxResponse

type TransformedServerCheckboxField = ILogicCheckboxResponse

const isServerCheckboxValue = (
  field: FieldSchemaOrResponse,
): field is ServerCheckboxField => {
  if (field.fieldType !== BasicField.Checkbox) {
    return false
  }
  return (
    hasProp(field, 'answerArray') &&
    Array.isArray(field.answerArray) &&
    field.answerArray.every((value) => typeof value === 'string')
  )
}

const convertServerCheckboxValue = (
  field: ServerCheckboxField,
  formFields: IPopulatedForm['form_fields'],
): TransformedServerCheckboxField => {
  const completeField = getCheckboxField(field, formFields)
  const withOthersPrefix = field.answerArray.filter((value) =>
    value.startsWith('Others: '),
  )
  // In-built others option is selected if at least one of them is not
  // a user-defined option i.e. is one of the field options
  const inBuiltOthers = withOthersPrefix.find(
    (value) => !completeField.fieldOptions.includes(value),
  )

  let others = false
  if (inBuiltOthers) {
    field.answerArray.splice(field.answerArray.indexOf(inBuiltOthers), 1)
    others = true
  }

  return {
    ...omit(field, ['answerArray']),
    answerArray: { options: field.answerArray, others },
  }
}

const findField = (
  field: FieldSchemaOrResponse,
  formFields: IPopulatedForm['form_fields'],
): IField | undefined => {
  const fieldId = field._id
  return formFields.find((field) => String(field._id) === fieldId) // cast to string because some ids are ObjectIds
}

const getCheckboxField = (
  field: FieldSchemaOrResponse,
  formFields: IPopulatedForm['form_fields'],
): ICheckboxField => {
  const completeField = findField(field, formFields)
  if (!completeField) {
    throw new Error('Field cannot be found')
  }
  if (!isCheckboxField(completeField)) {
    throw new Error(`${completeField} is not a checkbox field`)
  }
  return completeField
}
