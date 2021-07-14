import { ApplicationError } from '../core/core.errors'

/**
 * Transaction with given ID not found.
 */
export class TransactionNotFoundError extends ApplicationError {
  constructor(message = 'Transaction with given ID not found') {
    super(message)
  }
}

/**
 * Field with given ID not found in the transaction.
 */
export class FieldNotFoundInTransactionError extends ApplicationError {
  constructor(message = 'Field with given ID not found in the transaction') {
    super(message)
  }
}

/**
 * Transaction is expired
 */
export class TransactionExpiredError extends ApplicationError {
  constructor(message = 'Transaction is expired') {
    super(message)
  }
}

/**
 * OTP is expired
 */
export class OtpExpiredError extends ApplicationError {
  constructor(message = 'OTP is expired') {
    super(message)
  }
}

/**
 * OTP cannot be verified because hash data is missing.
 */
export class MissingHashDataError extends ApplicationError {
  constructor(message = 'Field is missing information on hashed OTP') {
    super(message)
  }
}

/**
 * OTP maximum retries exceeded.
 */
export class OtpRetryExceededError extends ApplicationError {
  constructor(message = 'Too many invalid attempts to enter OTP') {
    super(message)
  }
}

/**
 * Wrong OTP entered.
 */
export class WrongOtpError extends ApplicationError {
  constructor(message = 'Wrong OTP entered') {
    super(message)
  }
}

/**
 * OTP requested too soon after previous request.
 */
export class WaitForOtpError extends ApplicationError {
  constructor(message = 'OTP requested too soon after previous OTP') {
    super(message)
  }
}

/**
 * Unsupported field type for OTP verification
 */
export class NonVerifiedFieldTypeError extends ApplicationError {
  constructor(unsupportedFieldType: string) {
    super(
      `Unsupported field type for OTP verification: ${unsupportedFieldType}`,
    )
  }
}

/**
 * Agency user has sent too many SMSes using default Twilio credentials
 */
export class SmsLimitExceededError extends ApplicationError {
  constructor(
    message = 'You have exceeded the free sms limit. Please refresh and try again.',
  ) {
    super(message)
  }
}
