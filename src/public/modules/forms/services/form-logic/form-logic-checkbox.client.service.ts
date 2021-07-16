import { cloneDeep, omit } from 'lodash'

import { isClientCheckboxConditionValue } from '../../../../../shared/util/logic-utils'
import {
  ClientCheckboxCondition,
  ClientCheckboxConditionOption,
  IClientConditionSchema,
  LogicCheckboxCondition,
} from '../../../../../types'

/**
 * Converts checkbox condition value with backend representation to frontend 2D array representation.
 * @param conditionValue Backend representation of checkbox logic condition value
 * @param field Corresponding checkbox field
 * @returns Transformed logic condition with frontend representation
 */
export const convertObjectCheckboxCondition = (
  condition: LogicCheckboxCondition,
): ClientCheckboxCondition => {
  condition = cloneDeep(condition) // clone to prevent changes to original
  const convertedValue: ClientCheckboxConditionOption[][] = []
  condition.value.forEach((value) => {
    const combination = []
    if (value.others) {
      combination.push({ value: 'Others', other: true })
    }
    value.options.forEach((option) => {
      combination.push({ value: option, other: false })
    })
    convertedValue.push(combination)
  })
  return {
    ...omit(condition, ['value']),
    value: convertedValue,
  }
}

/**
 * Converts checkbox condition with frontend 2D array representation to backend object representation.
 * @param conditionValue Frontend representation of checkbox logic condition value
 * @param field Corresponding checkbox field
 * @throws Error if checkbox field does not have othersRadioButton key
 * @returns Transformed logic condition with backend representation
 */
export const convertArrayCheckboxCondition = (
  condition: ClientCheckboxCondition,
): LogicCheckboxCondition => {
  condition = cloneDeep(condition) // clone to prevent changes to original
  const convertedValue = condition.value.map((options) => {
    const indexOfOthers = options.findIndex((option) => option.other)
    const others = indexOfOthers > -1
    if (others) {
      options.splice(indexOfOthers, 1)
    }
    return { options: options.map((option) => option.value), others }
  })
  return {
    ...omit(condition, ['value']),
    value: convertedValue,
  }
}

export const isClientCheckboxCondition = (
  condition: IClientConditionSchema,
): condition is ClientCheckboxCondition => {
  const conditionValue = condition.value
  return isClientCheckboxConditionValue(conditionValue)
}
