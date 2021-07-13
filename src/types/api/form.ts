import { LeanDocument } from 'mongoose'
import { ConditionalPick, PartialDeep, Primitive } from 'type-fest'

import { FormField, FormFieldSchema, FormFieldWithId } from '../field'
import {
  EndPage,
  FormSettings,
  IForm,
  IPopulatedForm,
  Permission,
  ResponseMode,
  StartPage,
} from '../form'

import { EditFormFieldParams } from './field'

export { PublicFormViewDto } from '../../../shared/types/form/form'

export type SettingsUpdateDto = PartialDeep<FormSettings>

export type FieldUpdateDto = FormFieldWithId

export type FieldCreateDto = FormField

/**
 * Form field POJO with functions removed
 */
export type FormFieldDto = ConditionalPick<
  LeanDocument<FormFieldSchema>,
  Primitive
>

export type PermissionsUpdateDto = Permission[]

export type EndPageUpdateDto = EndPage

export type StartPageUpdateDto = StartPage

export type FormViewDto = { form: IPopulatedForm }

export type DuplicateFormBody = {
  title: string
} & (
  | {
      responseMode: ResponseMode.Email
      emails: string | string[]
    }
  | {
      responseMode: ResponseMode.Encrypt
      publicKey: string
    }
)

export type FormUpdateParams = {
  editFormField?: EditFormFieldParams
  authType?: IForm['authType']
  emails?: IForm['emails']
  esrvcId?: IForm['esrvcId']
  form_logics?: IForm['form_logics']
  hasCaptcha?: IForm['hasCaptcha']
  inactiveMessage?: IForm['inactiveMessage']
  permissionList?: IForm['permissionList']
  status?: IForm['status']
  title?: IForm['title']
  webhook?: IForm['webhook']
}
