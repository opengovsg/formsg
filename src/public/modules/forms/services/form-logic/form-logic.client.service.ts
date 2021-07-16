import { omit } from 'lodash'

import { isLogicCheckboxCondition } from '../../../../../shared/util/logic-utils'
import {
  IClientConditionSchema,
  IClientLogicSchema,
  IConditionSchema,
  ILogicSchema,
} from '../../../../../types'

import {
  convertArrayCheckboxCondition,
  convertObjectCheckboxCondition,
  isClientCheckboxCondition,
} from './form-logic-checkbox.client.service'

/**
 * Transforms logic conditions retrieved from the backend into frontend representation.
 * This function should be used when retrieving logic objects from the backend.
 * @param formLogic Logic object
 * @returns Transformed logic object
 */
export const transformBackendLogic = (
  formLogic: ILogicSchema,
): IClientLogicSchema => {
  const transformedLogic = formLogic.conditions.map((condition) => {
    if (isLogicCheckboxCondition(condition)) {
      return convertObjectCheckboxCondition(condition)
    } else {
      return condition as IClientConditionSchema
    }
  })

  return { ...omit(formLogic, ['conditions']), conditions: transformedLogic }
}

/**
 * Transforms logic conditions retrieved from the frontend into backend representation.
 * This function should be used before sending logic objects to the backend.
 * @param formLogic Logic object
 * @param formFields Form fields of the form.
 * @returns Tranformed logic object
 */
export const transformFrontendLogic = (
  formLogic: IClientLogicSchema,
): ILogicSchema => {
  const transformedLogic = formLogic.conditions.map((condition) => {
    if (isClientCheckboxCondition(condition)) {
      return convertArrayCheckboxCondition(condition)
    } else {
      return condition as IConditionSchema
    }
  })
  return { ...omit(formLogic, ['conditions']), conditions: transformedLogic }
}
