import { BasicField, SectionFieldBase } from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export type ISectionField = SectionFieldBase
export interface ISectionFieldSchema extends ISectionField, IFieldSchema {
  fieldType: BasicField.Section
}
