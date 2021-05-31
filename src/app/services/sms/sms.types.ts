import { Document, Model } from 'mongoose'
import { Twilio } from 'twilio'

import {
  AdminContactOtpData,
  FormOtpData,
  IFormSchema,
  IUserSchema,
  Permission,
  PhoneNumber,
} from '../../../types'

export enum SmsType {
  Verification = 'VERIFICATION',
  AdminContact = 'ADMIN_CONTACT',
  DeactivatedForm = 'DEACTIVATED_FORM',
  BouncedSubmission = 'BOUNCED_SUBMISSION',
}

export enum LogType {
  failure = 'FAILURE',
  success = 'SUCCESS',
}

export type FormDeactivatedSmsData = {
  form: IFormSchema['_id']
  formAdmin: {
    email: IUserSchema['email']
    userId: IUserSchema['_id']
  }
  collaboratorEmail: Permission['email']
  recipientNumber: string
}

export type BouncedSubmissionSmsData = FormDeactivatedSmsData

export type LogSmsParams = {
  smsData:
    | FormOtpData
    | AdminContactOtpData
    | FormDeactivatedSmsData
    | BouncedSubmissionSmsData
  msgSrvcSid: string
  smsType: SmsType
  logType: LogType
}

export interface ISmsCount {
  // The Twilio SID used to send the SMS. Not to be confused with msgSrvcName.
  msgSrvcSid: string
  logType: LogType
  smsType: SmsType
  createdAt?: Date
}

export interface ISmsCountSchema extends ISmsCount, Document {}

export interface IVerificationSmsCount extends ISmsCount {
  form: IFormSchema['_id']
  formAdmin: {
    email: string
    userId: IUserSchema['_id']
  }
}

export type IVerificationSmsCountSchema = ISmsCountSchema

export interface IAdminContactSmsCount extends ISmsCount {
  admin: IUserSchema['_id']
}

export type IAdminContactSmsCountSchema = ISmsCountSchema

export interface IFormDeactivatedSmsCount
  extends ISmsCount,
    FormDeactivatedSmsData {}

export interface IFormDeactivatedSmsCountSchema
  extends ISmsCountSchema,
    FormDeactivatedSmsData {}

export interface IBouncedSubmissionSmsCount
  extends ISmsCount,
    BouncedSubmissionSmsData {}

export interface IBouncedSubmissionSmsCountSchema
  extends ISmsCountSchema,
    BouncedSubmissionSmsData {}

export interface ISmsCountModel extends Model<ISmsCountSchema> {
  logSms: (logParams: LogSmsParams) => Promise<ISmsCountSchema>
}

export type TwilioCredentials = {
  accountSid: string
  apiKey: string
  apiSecret: string
  messagingServiceSid: string
}

export type TwilioConfig = {
  client: Twilio
  msgSrvcSid: string
}

export interface BounceNotificationSmsParams {
  recipient: PhoneNumber
  recipientEmail: string
  adminId: string
  adminEmail: string
  formId: string
  formTitle: string
}
