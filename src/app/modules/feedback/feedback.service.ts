import { isEmpty } from 'lodash'
import moment from 'moment-timezone'
import mongoose from 'mongoose'
import { ResultAsync } from 'neverthrow'

import { IFormFeedbackSchema } from '../../../types'
import { FormFeedbackMetaDto } from '../../../types/api/form_feedback'
import { ProcessedFeedbackMeta } from '../../../types/form_feedback'
import { createLoggerWithLabel } from '../../config/logger'
import getFormFeedbackModel from '../../models/form_feedback.server.model'
import { getMongoErrorMessage } from '../../utils/handle-mongo-error'
import { DatabaseError } from '../core/core.errors'

const FormFeedbackModel = getFormFeedbackModel(mongoose)
const logger = createLoggerWithLabel(module)

/**
 * Returns number of form feedback for given form id.
 *
 * @param formId the form id to retrieve feedback counts for
 * @returns ok(form feedback count)
 * @returns err(DatabaseError) if database query errors
 */
export const getFormFeedbackCount = (
  formId: string,
): ResultAsync<number, DatabaseError> => {
  return ResultAsync.fromPromise(
    FormFeedbackModel.countDocuments({ formId }).exec(),
    (error) => {
      logger.error({
        message: 'Error counting feedback documents from database',
        meta: {
          action: 'getFormFeedbackCount',
          formId,
        },
        error,
      })

      return new DatabaseError(getMongoErrorMessage(error))
    },
  )
}

/**
 * Retrieves form feedback stream.
 * @param formId the formId of form to retrieve feedback for
 * @returns form feedback stream
 */
export const getFormFeedbackStream = (
  formId: string,
): mongoose.QueryCursor<IFormFeedbackSchema> => {
  return FormFeedbackModel.getFeedbackCursorByFormId(formId)
}

/**
 * Returned processed object containing count of feedback, average rating, and
 * list of feedback.
 * @param formId the form to retrieve feedback for
 * @returns ok(feedback response object) on success
 * @returns err(DatabaseError) if database error occurs during query
 */
export const getFormFeedbacks = (
  formId: string,
): ResultAsync<FormFeedbackMetaDto, DatabaseError> => {
  return ResultAsync.fromPromise(
    FormFeedbackModel.find({ formId }).sort({ created: 1 }).exec(),
    (error) => {
      logger.error({
        message: 'Error retrieving feedback documents from database',
        meta: {
          action: 'getFormFeedbacks',
          formId,
        },
        error,
      })

      return new DatabaseError(getMongoErrorMessage(error))
    },
  ).map((feedbacks) => {
    if (isEmpty(feedbacks)) {
      return {
        count: 0,
        feedback: [],
      }
    }

    // Process retrieved feedback.
    const totalFeedbackCount = feedbacks.length
    let totalRating = 0
    const processedFeedback = feedbacks.map((fb, idx) => {
      totalRating += fb.rating
      const response: ProcessedFeedbackMeta = {
        // 1-based indexing.
        index: idx + 1,
        timestamp: moment(fb.created).valueOf(),
        rating: fb.rating,
        comment: fb.comment ?? '',
        date: moment(fb.created).tz('Asia/Singapore').format('D MMM YYYY'),
        dateShort: moment(fb.created).tz('Asia/Singapore').format('D MMM'),
      }

      return response
    })
    const averageRating = (totalRating / totalFeedbackCount).toFixed(2)
    return {
      average: averageRating,
      count: totalFeedbackCount,
      feedback: processedFeedback,
    }
  })
}
