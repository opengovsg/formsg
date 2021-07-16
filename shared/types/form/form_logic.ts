import { FormFieldDto } from '../field'

export enum LogicConditionState {
  Equal = 'is equals to',
  Lte = 'is less than or equal to',
  Gte = 'is more than or equal to',
  Either = 'is either',
}

export enum LogicType {
  ShowFields = 'showFields',
  PreventSubmit = 'preventSubmit',
}

export enum LogicIfValue {
  Number = 'number',
  SingleSelect = 'single-select',
  MultiSelect = 'multi-select',
}

export type FormCondition = {
  field: FormFieldDto['_id']
  state: LogicConditionState
  value: string | number | string[] | number[]
  ifValueType?: LogicIfValue
}

export type FormLogicBase = {
  logicType: LogicType
  conditions: FormCondition[]
}

export interface ShowFieldLogic extends FormLogicBase {
  logicType: LogicType.ShowFields
  show: FormFieldDto['_id'][]
}

export interface PreventSubmitLogic extends FormLogicBase {
  logicType: LogicType.PreventSubmit
  preventSubmitMessage: string
}

export type FormLogic = ShowFieldLogic | PreventSubmitLogic

export type ShowFieldLogicDto = ShowFieldLogic & { _id: string }
export type PreventSubmitLogicDto = PreventSubmitLogic & { _id: string }

export type LogicDto = FormLogic & { _id: string }
