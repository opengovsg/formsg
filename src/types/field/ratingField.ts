import {
  BasicField,
  RatingFieldBase,
  RatingShape,
} from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export { RatingShape }

export type IRatingField = RatingFieldBase
export interface IRatingFieldSchema extends IRatingField, IFieldSchema {
  fieldType: BasicField.Rating
}
