import { BasicField, ImageFieldBase } from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export type IImageField = ImageFieldBase

export interface IImageFieldSchema extends IImageField, IFieldSchema {
  fieldType: BasicField.Image
}
