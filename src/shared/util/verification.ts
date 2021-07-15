import { BasicField } from '../../types'

export const VERIFIED_FIELDTYPES = [BasicField.Email, BasicField.Mobile]
export const SALT_ROUNDS = 10
export const TRANSACTION_EXPIRE_AFTER_SECONDS = 14400 // 4 hours
export const HASH_EXPIRE_AFTER_SECONDS = 60 * 30 // 30 minutes
export const WAIT_FOR_OTP_SECONDS = 30
/**
 * WAIT_FOR_OTP_SECONDS tolerance. Server allows OTPs to be requested every
 * (WAIT_FOR_OTP_SECONDS - WAIT_FOR_OTP_TOLERANCE_SECONDS) seconds.
 */
export const WAIT_FOR_OTP_TOLERANCE_SECONDS = 2
export const NUM_OTP_RETRIES = 4

export enum VfnErrors {
  ResendOtp = 'RESEND_OTP',
  SendOtpFailed = 'SEND_OTP_FAILED',
  WaitForOtp = 'WAIT_FOR_OTP',
  InvalidOtp = 'INVALID_OTP',
  FieldNotFound = 'FIELD_NOT_FOUND',
  TransactionNotFound = 'TRANSACTION_NOT_FOUND',
  InvalidMobileNumber = 'INVALID_MOBILE_NUMBER',
}

export enum ADMIN_VERIFIED_SMS_STATES {
  limitExceeded = 'LIMIT_EXCEEDED',
  belowLimit = 'BELOW_LIMIT',
  hasMessageServiceId = 'MESSAGE_SERVICE_ID_OBTAINED',
}

export enum SMS_WARNING_TIERS {
  LOW = 2500,
  MED = 5000,
  HIGH = 7500,
}
