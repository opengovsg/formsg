import { ApplicationError } from '../core/core.errors'

/**
 * Circuit breaker is open
 */
export class MyInfoCircuitBreakerError extends ApplicationError {
  constructor(message = 'Circuit breaker tripped') {
    super(message)
  }
}

/**
 * Error while attempting to retrieve MyInfo data from the MyInfo API
 */
export class MyInfoFetchError extends ApplicationError {
  constructor(message = 'Error while requesting MyInfo data') {
    super(message)
  }
}

/**
 * Error while attempting to hash data or compare hashed data
 */
export class MyInfoHashingError extends ApplicationError {
  constructor(message = 'Error occurred while hashing data') {
    super(message)
  }
}

/**
 * Hashes not found in the database
 */
export class MyInfoMissingHashError extends ApplicationError {
  constructor(message = 'Requested hashes not found in database') {
    super(message)
  }
}

/**
 * Hashes did not match responses
 */
export class MyInfoHashDidNotMatchError extends ApplicationError {
  constructor(message = 'Responses did not match hashed values') {
    super(message)
  }
}

export class MyInfoParseRelayStateError extends ApplicationError {
  constructor(
    message = 'Relay state received from MyInfo had incorrect format',
  ) {
    super(message)
  }
}
