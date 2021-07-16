import { PublicUserDto, UserDto } from '../user'
import { FormField, FormFieldDto } from '../field'

import { FormLogic } from './form_logic'
import { FormLogo } from './form_logo'
import { Merge, Opaque, PartialDeep } from 'type-fest'
import {
  ADMIN_FORM_META_FIELDS,
  EMAIL_FORM_SETTINGS_FIELDS,
  EMAIL_PUBLIC_FORM_FIELDS,
  STORAGE_FORM_SETTINGS_FIELDS,
  STORAGE_PUBLIC_FORM_FIELDS,
} from '../../constants/form'
import { DateString } from '../generic'

export type FormId = Opaque<string, 'FormId'>

export enum FormColorTheme {
  Blue = 'blue',
  Red = 'red',
  Green = 'green',
  Orange = 'orange',
  Brown = 'brown',
  Grey = 'grey',
}

export type FormPermission = {
  id?: string
  email: string
  write: boolean
}

export type FormStartPage = {
  paragraph?: string
  estTimeTaken?: number
  colorTheme: FormColorTheme
  logo: FormLogo
}

export type FormEndPage = {
  title: string
  paragraph?: string
  buttonLink?: string
  buttonText: string
}

export enum FormAuthType {
  NIL = 'NIL',
  SP = 'SP',
  CP = 'CP',
  MyInfo = 'MyInfo',
  SGID = 'SGID',
}

export enum FormStatus {
  Private = 'PRIVATE',
  Public = 'PUBLIC',
  Archived = 'ARCHIVED',
}

export type FormWebhook = {
  url: string
  isRetryEnabled: boolean
}

export enum FormResponseMode {
  Encrypt = 'encrypt',
  Email = 'email',
}

export interface FormBase {
  title: string
  admin: UserDto['_id']

  form_fields: FormField[]
  form_logics: FormLogic[]
  permissionList: FormPermission[]

  startPage: FormStartPage
  endPage: FormEndPage

  hasCaptcha: boolean
  authType: FormAuthType

  status: FormStatus

  inactiveMessage: string
  submissionLimit: number | null
  isListed: boolean

  esrvcId?: string

  msgSrvcName?: string

  webhook: FormWebhook

  responseMode: FormResponseMode
}

export interface EmailFormBase extends FormBase {
  responseMode: FormResponseMode.Email
  emails: string[]
}

export interface StorageFormBase extends FormBase {
  responseMode: FormResponseMode.Encrypt
  publicKey: string
}

/**
 * Additional props to be added/replaced when tranformed into DTO.
 */
type FormDtoBase = {
  _id: FormId
  form_fields: FormFieldDto[]
  created: DateString
  lastModified: DateString
}

export type StorageFormDto = Merge<StorageFormBase, FormDtoBase>

export type EmailFormDto = Merge<EmailFormBase, FormDtoBase>

export type FormDto = StorageFormDto | EmailFormDto

export type AdminFormDto = Merge<FormDto, { admin: UserDto }>

type PublicFormBase = {
  admin: PublicUserDto
}

export type PublicStorageFormDto = Merge<
  Pick<
    StorageFormDto,
    // Arrays like typeof list have numeric index signatures, so their number key
    // yields the union of all numerically-indexed properties.
    typeof STORAGE_PUBLIC_FORM_FIELDS[number]
  >,
  PublicFormBase
>

export type PublicEmailFormDto = Merge<
  Pick<
    StorageFormDto,
    // Arrays like typeof list have numeric index signatures, so their number key
    // yields the union of all numerically-indexed properties.
    typeof EMAIL_PUBLIC_FORM_FIELDS[number]
  >,
  PublicFormBase
>

export type PublicFormDto = PublicStorageFormDto | PublicEmailFormDto

export type EmailFormSettings = Pick<
  EmailFormDto,
  typeof EMAIL_FORM_SETTINGS_FIELDS[number]
>
export type StorageFormSettings = Pick<
  StorageFormDto,
  typeof STORAGE_FORM_SETTINGS_FIELDS[number]
>

export type FormSettings = EmailFormSettings | StorageFormSettings

export type SettingsUpdateDto = PartialDeep<FormSettings>

/**
 * Misnomer. More of a public form auth session.
 */
export interface SpcpSession {
  userName: string
  iat?: number // Optional as these are not returned for MyInfo forms
  rememberMe?: boolean
  exp?: number
}

export type PublicFormViewDto = {
  form: PublicFormDto
  spcpSession?: SpcpSession
  isIntranetUser?: boolean
  myInfoError?: true
}

export type PreviewFormViewDto = Pick<PublicFormViewDto, 'form'>

export type AdminFormViewDto = {
  form: AdminFormDto
}

export type AdminDashboardFormMetaDto = Pick<
  AdminFormDto,
  typeof ADMIN_FORM_META_FIELDS[number]
>

export type DuplicateFormBodyDto = {
  title: string
} & (
  | {
      responseMode: FormResponseMode.Email
      emails: string | string[]
    }
  | {
      responseMode: FormResponseMode.Encrypt
      publicKey: string
    }
)

export type CreateEmailFormBodyDto = Pick<
  EmailFormDto,
  'emails' | 'responseMode' | 'title'
>
export type CreateStorageFormBodyDto = Pick<
  StorageFormDto,
  'publicKey' | 'responseMode' | 'title'
>

export type CreateFormBodyDto =
  | CreateEmailFormBodyDto
  | CreateStorageFormBodyDto

export type EndPageUpdateDto = FormEndPage
export type StartPageUpdateDto = FormStartPage
export type PermissionsUpdateDto = FormPermission[]
