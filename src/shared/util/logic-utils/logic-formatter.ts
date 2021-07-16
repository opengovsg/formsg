import { cloneDeep } from 'lodash'

import {
  BasicField,
  FieldSchemaOrResponse,
  IPopulatedForm,
} from '../../../types'
import { LogicFieldSchemaOrResponse } from '../logic'

import { transformCheckboxForLogic } from './checkbox/checkbox-response-value-transformer'

/**
 * Transforms fields into the correct shape for logic module
 * @param fields Form fields
 * @param form
 * @returns Transformed fields to be input into logic module
 * @throws Error if any transformation fails
 */
export const formatFieldsForLogic = (
  fields: FieldSchemaOrResponse[],
  formFields: IPopulatedForm['form_fields'],
): LogicFieldSchemaOrResponse[] => {
  return fields.map((field) => {
    if (field.fieldType === BasicField.Checkbox) {
      return transformCheckboxForLogic(field, formFields)
    } else {
      return cloneDeep(field) as LogicFieldSchemaOrResponse
    }
  })
}
