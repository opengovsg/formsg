import { MyInfoAttributeString } from '@opengovsg/myinfo-gov-client'
import { LeanDocument } from 'mongoose'

import { ISpcpMyInfo } from '../../../config/feature-manager'
import {
  AuthType,
  Environment,
  IFieldSchema,
  IFormSchema,
  IMyInfo,
  MyInfoAttribute,
} from '../../../types'
import { ProcessedFieldResponse } from '../submission/submission.types'

export interface IMyInfoServiceConfig {
  spcpMyInfoConfig: ISpcpMyInfo
  nodeEnv: Environment
  appUrl: string
}

export interface IMyInfoRedirectURLArgs {
  formId: string
  rememberMe: boolean
  isPreview?: true
  formTitle: string
  formEsrvcId: string
  requestedAttributes: MyInfoAttributeString[]
}

export interface IPossiblyPrefilledField extends LeanDocument<IFieldSchema> {
  fieldValue?: string
}

export type MyInfoHashPromises = Partial<
  Record<MyInfoAttribute, Promise<string>>
>

export type VisibleMyInfoResponse = ProcessedFieldResponse & {
  myInfo: IMyInfo
  isVisible: true
  answer: string
}

export type MyInfoComparePromises = Map<string, Promise<boolean>>

export enum MyInfoCookieName {
  MyInfoError = 'MyInfoError',
  MyInfoAccessToken = 'MyInfoAccessToken',
}

export interface MyInfoCookiePayload {
  accessToken: string
  usedCount: number
}

export interface ParsedRelayState {
  uuid: string
  formId: string
  rememberMe: boolean
  isPreview: boolean
  cookieDuration: number
}

export interface IMyInfoForm extends IFormSchema {
  authType: AuthType.MyInfo
  esrvcId: string
}
