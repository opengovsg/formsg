import { UserDto } from '../user'
import { FormField } from '../field'

import { FormLogic } from './form_logic'
import { FormLogo } from './form_logo'

export enum FormColorTheme {
  Blue = 'blue',
  Red = 'red',
  Green = 'green',
  Orange = 'orange',
  Brown = 'brown',
  Grey = 'grey',
}

export type FormPermission = {
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
  paragraph: string
  buttonLink: string
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
  form_fields: FormField[]
  form_logics: FormLogic[]
  admin: UserDto['_id']
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

  created: Date
  lastModified: Date
}

export interface EmailFormBase extends FormBase {
  responseMode: FormResponseMode.Email
  emails: string[]
}

export interface StorageFormBase extends FormBase {
  responseMode: FormResponseMode.Encrypt
  publicKey: string
}
