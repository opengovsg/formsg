import { BasicField, MyInfoableFieldBase, VerifiableFieldBase } from './base'

export interface MobileFieldBase
  extends MyInfoableFieldBase,
    VerifiableFieldBase {
  fieldType: BasicField.Mobile
  allowIntlNumbers: boolean
}
