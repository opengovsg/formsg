import { ResultAsync } from 'neverthrow'
import promiseRetry from 'promise-retry'
import { OperationOptions } from 'retry'
import { Producer } from 'sqs-producer'

import config from '../../config/config'
import { createLoggerWithLabel } from '../../config/logger'

import { WebhookPushToQueueError } from './webhook.errors'
import { WebhookQueueMessage } from './webhook.message'
import { calculateDelaySeconds } from './webhook.utils'

const logger = createLoggerWithLabel(module)

/**
 * Encapsulates a producer which can write webhook retry messages
 * to a message queue.
 */
export class WebhookProducer {
  producer: Producer

  constructor(queueUrl: string) {
    this.producer = Producer.create({
      queueUrl,
      region: config.aws.region,
    })
  }

  /**
   * Enqueues a message.
   * @param queueMessage Message to send
   * @param retryOptions optional customisation of retry parameters
   * @returns ok(true) if sending message suceeds
   * @returns err if sending message fails
   */
  sendMessage(
    queueMessage: WebhookQueueMessage,
    retryOptions?: OperationOptions,
  ): ResultAsync<true, WebhookPushToQueueError> {
    const sendMessageRetry = promiseRetry<true>(async (retry, attemptNum) => {
      try {
        await this.producer.send({
          body: queueMessage.serialise(),
          id: queueMessage.submissionId, // only needs to be unique within request
          delaySeconds: calculateDelaySeconds(queueMessage.nextAttempt),
        })
        logger.info({
          message: `Pushed webhook to queue`,
          meta: {
            action: 'sendMessage',
            webhookMessage: queueMessage.prettify(),
            attemptNum,
          },
        })
        return true
      } catch (error) {
        logger.error({
          message: `Failed to push webhook to queue`,
          meta: {
            action: 'sendMessage',
            webhookMessage: queueMessage.prettify(),
            attemptNum,
          },
          error,
        })
        return retry(error)
      }
    }, retryOptions)
    return ResultAsync.fromPromise(sendMessageRetry, (error) => {
      logger.error({
        message: 'All attempts to push webhook to queue failed',
        meta: {
          action: 'sendMessage',
          webhookMessage: queueMessage.prettify(),
        },
        error,
      })
      return new WebhookPushToQueueError()
    })
  }
}
