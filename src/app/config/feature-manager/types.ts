import { MyInfoMode } from '@opengovsg/myinfo-gov-client'
import { Schema } from 'convict'

export enum FeatureNames {
  Sms = 'sms',
  SpcpMyInfo = 'spcp-myinfo',
  VerifiedFields = 'verified-fields',
  WebhookVerifiedContent = 'webhook-verified-content',
}

export interface ISms {
  twilioAccountSid: string
  twilioApiKey: string
  twilioApiSecret: string
  twilioMsgSrvcSid: string
}

export interface ISpcpConfig {
  isSPMaintenance: string
  isCPMaintenance: string
  spCookieMaxAge: number
  spCookieMaxAgePreserved: number
  spcpCookieDomain: string
  cpCookieMaxAge: number
  spIdpId: string
  cpIdpId: string
  spPartnerEntityId: string
  cpPartnerEntityId: string
  spIdpLoginUrl: string
  cpIdpLoginUrl: string
  spIdpEndpoint: string
  cpIdpEndpoint: string
  spEsrvcId: string
  cpEsrvcId: string
  spFormSgKeyPath: string
  cpFormSgKeyPath: string
  spFormSgCertPath: string
  cpFormSgCertPath: string
  spIdpCertPath: string
  cpIdpCertPath: string
}

export interface IMyInfoConfig {
  myInfoClientMode: MyInfoMode
  myInfoKeyPath: string
  myInfoCertPath: string
  myInfoClientId: string
  myInfoClientSecret: string
}

export type ISpcpMyInfo = ISpcpConfig & IMyInfoConfig

export interface IVerifiedFields {
  verificationSecretKey: string
}

export interface IWebhookVerifiedContent {
  signingSecretKey: string
  webhookQueueUrl: string
}

export interface IFeatureManager {
  [FeatureNames.Sms]: ISms
  [FeatureNames.SpcpMyInfo]: ISpcpMyInfo
  [FeatureNames.VerifiedFields]: IVerifiedFields
  [FeatureNames.WebhookVerifiedContent]: IWebhookVerifiedContent
}

export interface RegisteredFeature<T extends FeatureNames> {
  isEnabled: boolean
  props?: IFeatureManager[T]
}

export interface RegisterableFeature<K extends FeatureNames> {
  name: K
  schema: Schema<IFeatureManager[K]>
}
