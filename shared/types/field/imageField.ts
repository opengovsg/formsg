import { BasicField, FieldBase } from './base'

export interface ImageFieldBase extends FieldBase {
  fieldType: BasicField.Image
  url: string
  fileMd5Hash: string
  name: string
  size: string
}
