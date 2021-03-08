import { IField, IFieldSchema } from './baseField'

export type AutoReplyOptions = {
  hasAutoReply: boolean
  autoReplySubject: string
  autoReplySender: string
  autoReplyMessage: string
  includeFormSummary: boolean
}

export interface IEmailField extends IField {
  autoReplyOptions: AutoReplyOptions
  isVerifiable: boolean
  allowedEmailDomains: string[]
}

export interface IEmailFieldSchema extends IEmailField, IFieldSchema {
  isVerifiable: boolean
}
