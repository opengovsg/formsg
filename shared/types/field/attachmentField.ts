import { BasicField, FieldBase } from './base'

export enum AttachmentSize {
  OneMb = '1',
  TwoMb = '2',
  ThreeMb = '3',
  SevenMb = '7',
  TenMb = '10',
  TwentyMb = '20',
}

export interface AttachmentFieldBase extends FieldBase {
  fieldType: BasicField.Attachment
  attachmentSize: AttachmentSize
}
