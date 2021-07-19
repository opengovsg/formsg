import {
  AutoReplyOptions,
  BasicField,
  EmailFieldBase,
} from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export { AutoReplyOptions }

export type IEmailField = EmailFieldBase
export interface IEmailFieldSchema extends IEmailField, IFieldSchema {
  fieldType: BasicField.Email
  isVerifiable: boolean
}
