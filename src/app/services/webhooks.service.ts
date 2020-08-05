import axios, { AxiosError, AxiosResponse } from 'axios'
import { get } from 'lodash'
import mongoose from 'mongoose'

import formsgSdk from '../../config/formsg-sdk'
import { createLoggerWithLabel } from '../../config/logger'
// Prevents JSON.stringify error for circular JSONs and BigInts
import { stringifySafe } from '../../shared/util/stringify-safe'
import {
  IFormSchema,
  ISubmissionSchema,
  IWebhookResponseSchema,
  WebhookView,
} from '../../types'
import { getEncryptSubmissionModel } from '../models/submission.server.model'
import { WebhookValidationError } from '../utils/custom-errors'

const logger = createLoggerWithLabel('webhooks')
const EncryptSubmission = getEncryptSubmissionModel(mongoose)

type WebhookParams = {
  webhookUrl: string
  submissionWebhookView: WebhookView
  submissionId: ISubmissionSchema['_id']
  formId: IFormSchema['_id']
  now: number
  signature: string
}

type LogWebhookParams = {
  submissionId: ISubmissionSchema['_id']
  formId: IFormSchema['_id']
  now: number
  webhookUrl: string
  signature: string
  status?: number
  errorMessage?: string
}

type WebhookResponse = Pick<IWebhookResponseSchema, 'response'>

/**
 * Logs webhook failure in console and database.
 * @param {error} error Error object returned by axios
 * @param {Object} webhookParams Parameters which fully specify webhook
 * @param {string} webhookParams.webhookUrl URL to POST to
 * @param {Object} webhookParams.submissionWebhookView POST body
 * @param {string} webhookParams.submissionId
 * @param {string} webhookParams.formId
 * @param {string} webhookParams.now Epoch for POST header
 * @param {string} webhookParams.signature Signature generated by FormSG SDK
 */
const handleWebhookFailure = (
  error: Error | AxiosError,
  webhookParams: WebhookParams,
): void => {
  logWebhookFailure(error, webhookParams)
  updateSubmissionsDb(
    webhookParams.formId,
    webhookParams.submissionId,
    getFailureDbUpdate(error, webhookParams),
  )
}

/**
 * Logs webhook success in console and database.
 * @param {response} response Response object returned by axios
 * @param {Object} webhookParams Parameters which fully specify webhook
 * @param {string} webhookParams.webhookUrl URL to POST to
 * @param {Object} webhookParams.submissionWebhookView POST body
 * @param {string} webhookParams.submissionId
 * @param {string} webhookParams.formId
 * @param {string} webhookParams.now Epoch for POST header
 * @param {string} webhookParams.signature Signature generated by FormSG SDK
 */
const handleWebhookSuccess = (
  response: AxiosResponse,
  webhookParams: WebhookParams,
): void => {
  logWebhookSuccess(response, webhookParams)
  updateSubmissionsDb(
    webhookParams.formId,
    webhookParams.submissionId,
    getSuccessDbUpdate(response, webhookParams),
  )
}

/**
 * Sends webhook POST.
 * Note that the arguments are the same as those in webhookParams
 * for handleWebhookSuccess and handleWebhookFailure, just destructured.
 * @param {string} webhookUrl URL to POST to
 * @param {Object} submissionWebhookView POST body
 * @param {string} submissionId
 * @param {string} formId
 * @param {string} now Epoch for POST header
 * @param {string} signature Signature generated by FormSG SDK
 */
const postWebhook = ({
  webhookUrl,
  submissionWebhookView,
  submissionId,
  formId,
  now,
  signature,
}: WebhookParams): Promise<AxiosResponse> => {
  return axios.post(webhookUrl, submissionWebhookView, {
    headers: {
      'X-FormSG-Signature': formsgSdk.webhooks.constructHeader({
        epoch: now,
        submissionId,
        formId,
        signature,
      }),
    },
    maxRedirects: 0,
  })
}

// Logging for webhook success
const logWebhookSuccess = (
  response: AxiosResponse,
  { webhookUrl, submissionId, formId, now, signature }: WebhookParams,
): void => {
  const status = get(response, 'status')
  const loggingParams: LogWebhookParams = {
    status,
    submissionId,
    formId,
    now,
    webhookUrl,
    signature,
  }
  logger.info(getConsoleMessage('Webhook POST succeeded', loggingParams))
}

// Logging for webhook failure
const logWebhookFailure = (
  error: Error | AxiosError,
  { webhookUrl, submissionId, formId, now, signature }: WebhookParams,
): void => {
  const errorMessage = get(error, 'message')
  let loggingParams: LogWebhookParams = {
    submissionId,
    formId,
    now,
    webhookUrl,
    signature,
    errorMessage,
  }
  if (error instanceof WebhookValidationError) {
    logger.error(getConsoleMessage('Webhook not attempted', loggingParams))
  } else {
    loggingParams.status = get(error, 'response.status')
    logger.error(getConsoleMessage('Webhook POST failed', loggingParams))
  }
}

// Updates the submission in the database with the webhook response
const updateSubmissionsDb = (
  formId: IFormSchema['_id'],
  submissionId: ISubmissionSchema['_id'],
  updateObj: Partial<IWebhookResponseSchema>,
): void => {
  EncryptSubmission.updateOne(
    { _id: submissionId },
    { $push: { webhookResponses: updateObj } },
  )
    .then(({ nModified }) => {
      if (nModified !== 1) {
        // Pass on to catch block
        throw new Error('Submission not found in database.')
      }
    })
    .catch((error) => {
      logger.error(
        getConsoleMessage('Database update for webhook status failed', {
          formId,
          submissionId,
          updateObj: stringifySafe(updateObj),
          dbErrorMessage: get(error, 'message'),
        }),
      )
    })
}

// Creates a string with a title, followed by a tab, followed
// by a list of 'key=value' pairs separated by spaces
const getConsoleMessage = (title: string, params: object) => {
  let consoleMessage = title + ':\t'
  consoleMessage += Object.entries(params)
    .map(([key, value]) => key + '=' + value)
    .join(' ')
  return consoleMessage
}

// Formats webhook success info into an object to update Submissions collection
const getSuccessDbUpdate = (
  response: AxiosResponse,
  { webhookUrl, signature }: WebhookParams,
): Partial<IWebhookResponseSchema> => {
  return { webhookUrl, signature, ...getFormattedResponse(response) }
}

// Formats webhook failure info into an object to update Submissions collection
const getFailureDbUpdate = (
  error: Error | AxiosError,
  { webhookUrl, signature }: WebhookParams,
): Partial<IWebhookResponseSchema> => {
  const errorMessage = get(error, 'message')
  let update: Partial<IWebhookResponseSchema> = {
    webhookUrl,
    signature,
    errorMessage,
  }
  if (!(error instanceof WebhookValidationError)) {
    const { response } = getFormattedResponse(get(error, 'response'))
    update.response = response
  }
  return update
}

// Formats a response object for update in the Submissions collection
const getFormattedResponse = (response: AxiosResponse): WebhookResponse => {
  return {
    response: {
      status: get(response, 'status'),
      statusText: get(response, 'statusText'),
      headers: stringifySafe(get(response, 'headers', {})),
      data: stringifySafe(get(response, 'data', {})),
    },
  }
}

module.exports = {
  postWebhook,
  handleWebhookSuccess,
  handleWebhookFailure,
  logWebhookFailure,
}
