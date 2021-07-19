import { BasicField, YesNoFieldBase } from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export type IYesNoField = YesNoFieldBase

export interface IYesNoFieldSchema extends IYesNoField, IFieldSchema {
  fieldType: BasicField.YesNo
}
