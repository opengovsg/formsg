import { AxiosError } from 'axios'

import { ApplicationError } from '../core/core.errors'

/**
 * A custom error class thrown by the webhook server controller
 * if the submissionWebhookView is null or the webhookUrl is an invalid URL
 */
export class WebhookValidationError extends ApplicationError {
  constructor(message = 'Webhook URL is non-HTTPS or points to private IP') {
    super(message)
  }
}

/**
 * Webhook failed to generate S3 presigned URLs for attachments
 */
export class WebhookFailedWithPresignedUrlGenerationError extends ApplicationError {
  meta: {
    originalError: unknown
  }

  constructor(error: unknown, message = 'Presigned Url Generation failed') {
    super(message)
    this.meta = { originalError: error }
  }
}

/**
 * Webhook returned non-200 status, but error is not instance of AxiosError
 */
export class WebhookFailedWithUnknownError extends ApplicationError {
  meta: {
    originalError: unknown
  }

  constructor(error: unknown, message = 'Webhook POST failed') {
    super(message)
    this.meta = { originalError: error }
  }
}

/**
 * Webhook returned non-200 status, error is instance of AxiosError
 */
export class WebhookFailedWithAxiosError extends ApplicationError {
  meta: {
    originalError: AxiosError<unknown>
  }

  constructor(error: AxiosError<unknown>, message = 'Webhook POST failed') {
    super(message)
    this.meta = { originalError: error }
  }
}

/**
 * Webhook queue message incorrectly formatted and hence could not be parsed
 */
export class WebhookQueueMessageParsingError extends ApplicationError {
  meta: {
    originalError: unknown
  }

  constructor(
    error: unknown,
    message = 'Unable to parse body of webhook queue message',
  ) {
    super(message)
    this.meta = { originalError: error }
  }
}

/**
 * Maximum retries exceeded for webhook.
 */
export class WebhookNoMoreRetriesError extends ApplicationError {
  constructor(message = 'Maximum retries exceeded for webhook') {
    super(message)
  }
}

/**
 * Failed to push message to SQS.
 */
export class WebhookPushToQueueError extends ApplicationError {
  constructor(message = 'Failed to push webhook to message queue') {
    super(message)
  }
}

/**
 * Cannot send webhook retry because form has no webhook URL or does not have
 * retries enabled.
 */
export class WebhookRetriesNotEnabledError extends ApplicationError {
  meta: {
    webhookUrl: string
    isRetryEnabled: boolean
  }

  constructor(
    webhookUrl: string,
    isRetryEnabled: boolean,
    message = 'Unable to send webhook as form has no webhook URL or does not have retries enabled',
  ) {
    super(message)
    this.meta = {
      webhookUrl,
      isRetryEnabled,
    }
  }
}
