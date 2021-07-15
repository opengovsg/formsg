import axios from 'axios'

import { PublicFormViewDto } from '../../../shared/types/form/form'
import { SubmissionResponseDto } from '../../../shared/types/submission'
import { EmailSubmissionDto, EncryptSubmissionDto } from '../../types/api'
import { createEmailSubmissionFormData } from '../utils/submission'

const PUBLIC_FORMS_ENDPOINT = '/api/v3/forms'

/**
 * Submits an email mode form submission.
 * @param formId id of form to submit submission for
 * @param content content of submission
 * @param attachments any attachments included in submission
 * @param captchaResponse string if captcha to be included, defaults to null
 *
 * @returns SubmissionResponseDto if successful, else SubmissionErrorDto on error
 */
export const submitEmailModeForm = async ({
  formId,
  content,
  attachments,
  captchaResponse = null,
}: {
  formId: string
  content: EmailSubmissionDto
  attachments?: Record<string, File>
  captchaResponse?: string | null
}): Promise<SubmissionResponseDto> => {
  const formData = createEmailSubmissionFormData({
    content,
    attachments,
  })

  return axios
    .post<SubmissionResponseDto>(
      `${PUBLIC_FORMS_ENDPOINT}/${formId}/submissions/email`,
      formData,
      {
        params: {
          captchaResponse: String(captchaResponse),
        },
      },
    )
    .then(({ data }) => data)
}

/**
 * Submits a storage mode form's submission.
 * @param formId id of form to submit submission for
 * @param content the storage mode submission object to submit
 * @param captchaResponse string if captcha to be included, defaults to null
 *
 * @returns SubmissionResponseDto if successful, else SubmissionErrorDto on error
 */
export const submitStorageModeForm = async ({
  formId,
  content,
  captchaResponse = null,
}: {
  formId: string
  content: EncryptSubmissionDto
  captchaResponse?: string | null
}): Promise<SubmissionResponseDto> => {
  return axios
    .post<SubmissionResponseDto>(
      `${PUBLIC_FORMS_ENDPOINT}/${formId}/submissions/encrypt`,
      content,
      {
        params: {
          captchaResponse: String(captchaResponse),
        },
      },
    )
    .then(({ data }) => data)
}

/**
 * Gets public view of form, along with any
 * identify information obtained from Singpass/Corppass/MyInfo.
 * @param formId FormId of form in question
 * @returns Public view of form, with additional identify information
 */
export const getPublicFormView = async (
  formId: string,
): Promise<PublicFormViewDto> => {
  return axios
    .get<PublicFormViewDto>(`${PUBLIC_FORMS_ENDPOINT}/${formId}`)
    .then(({ data }) => data)
}
