import { Opaque, RequireAtLeastOne } from 'type-fest'
import { ErrorDto } from './core'
import { MyInfoAttribute } from './field'
import { FormAuthType, FormDto } from './form/form'
import { DateString } from './generic'

export type SubmissionId = Opaque<string, 'SubmissionId'>

export enum SubmissionType {
  Email = 'emailSubmission',
  Encrypt = 'encryptSubmission',
}

export type SubmissionBase = {
  form: FormDto['_id']
  authType: FormAuthType
  myInfoFields?: MyInfoAttribute[]
  submissionType: SubmissionType
}

export interface EmailModeSubmissionBase extends SubmissionBase {
  submissionType: SubmissionType.Email
  recipientEmails: string[]
  responseHash: string
  responseSalt: string
  hasBounced: boolean
}

export type WebhookResponse = {
  webhookUrl: string
  signature: string
  response: {
    status: number
    headers: string
    data: string
  }
}

export interface StorageModeSubmissionBase extends SubmissionBase {
  submissionType: SubmissionType.Encrypt
  encryptedContent: string
  verifiedContent?: string
  attachmentMetadata?: Map<string, string>
  version: number
  webhookResponses?: WebhookResponse[]
}

export type StorageModeSubmissionDto = {
  refNo: SubmissionId
  submissionTime: string
  content: string
  verified?: string
  attachmentMetadata: Record<string, string>
  version: number
}

export type StorageModeSubmissionMetadata = {
  number: number
  refNo: SubmissionId
  /** Not a DateString, format is `Do MMM YYYY, h:mm:ss a` */
  submissionTime: string
}

export type StorageModeSubmissionMetadataList = {
  metadata: StorageModeSubmissionMetadata[]
  count: number
}

export type SubmissionResponseDto = {
  message: string
  submissionId: string
}

export type SubmissionErrorDto = ErrorDto & { spcpSubmissionFailure?: true }

export type SubmissionCountQueryDto =
  | {
      startDate: DateString
      endDate: DateString
    }
  | undefined

export type FormSubmissionMetadataQueryDto = RequireAtLeastOne<
  {
    page: number
    submissionId: string
  },
  'page' | 'submissionId'
>
