import axios from 'axios'

import { SuccessMessageDto } from '../../../shared/types/core'
import {
  FormFeedbackDto,
  FormFeedbackMetaDto,
  SubmitFormFeedbackBodyDto,
} from '../../../shared/types/form/form_feedback'
import { FeedbackCsvGenerator } from '../modules/forms/helpers/FeedbackCsvGenerator'

// Exported for testing
export const PUBLIC_FORM_ENDPOINT = '/api/v3/forms'
export const ADMIN_FORM_ENDPOINT = '/api/v3/admin/forms'

/**
 * Post feedback for a given form.
 * @param formId the id of the form to post feedback for
 * @param feedbackToPost object containing the feedback
 * @returns success message
 */
export const postFeedback = async (
  formId: string,
  feedbackToPost: SubmitFormFeedbackBodyDto,
): Promise<SuccessMessageDto> => {
  return axios
    .post<SuccessMessageDto>(
      `${PUBLIC_FORM_ENDPOINT}/${formId}/feedback`,
      feedbackToPost,
    )
    .then(({ data }) => data)
}

/**
 * Retrieves feedback for a given form.
 * @param formId the id of the form to retrieve feedback for
 * @returns object containing average?, count, and feedback[]
 */
export const getFeedback = async (
  formId: string,
): Promise<FormFeedbackMetaDto> => {
  return axios
    .get<FormFeedbackMetaDto>(`${ADMIN_FORM_ENDPOINT}/${formId}/feedback`)
    .then(({ data }) => data)
}

/**
 * Counts feedback for a given form.
 * @param formId the id of the form to count feedback for
 * @returns the count of the retrieved feedback
 */
export const countFeedback = async (formId: string): Promise<number> => {
  return axios
    .get<number>(`${ADMIN_FORM_ENDPOINT}/${formId}/feedback/count`)
    .then(({ data }) => data)
}

/**
 * Downloads feedback for a given form.
 * @param formId the id of the form to download feedback for
 * @returns a stream of feedback
 */
export const downloadFeedback = async (
  formId: string,
  formTitle: string,
): Promise<void> => {
  const expectedNumResponses = await countFeedback(formId)

  return axios
    .get<FormFeedbackDto[]>(
      `${ADMIN_FORM_ENDPOINT}/${formId}/feedback/download`,
    )
    .then(({ data }) => {
      if (!data) {
        return Promise.reject(new Error('Error downloading feedback'))
      }

      const csvGenerator = new FeedbackCsvGenerator(expectedNumResponses)

      data.forEach((feedback) => {
        csvGenerator.addLineFromFeedback(feedback)
      })

      csvGenerator.triggerFileDownload(`${formTitle}-${formId}-feedback.csv`)
    })
}
