import {
  AttachmentFieldBase,
  AttachmentSize,
  BasicField,
} from '../../../shared/types/field'

import { IFieldSchema } from './baseField'

export { AttachmentSize }

export type IAttachmentField = AttachmentFieldBase
export interface IAttachmentFieldSchema extends IAttachmentField, IFieldSchema {
  fieldType: BasicField.Attachment
}
