import { BasicField, FieldBase } from './base'

export enum RatingShape {
  Heart = 'Heart',
  Star = 'Star',
}

export interface RatingFieldBase extends FieldBase {
  fieldType: BasicField.Rating
  ratingOptions: {
    steps: number
    shape: RatingShape
  }
}
