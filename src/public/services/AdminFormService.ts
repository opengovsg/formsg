import axios from 'axios'

import { FormSettings, LogicDto } from '../../types'
import {
  EmailSubmissionDto,
  EncryptSubmissionDto,
  EndPageUpdateDto,
  FieldCreateDto,
  FieldUpdateDto,
  FormFieldDto,
  PermissionsUpdateDto,
  SettingsUpdateDto,
  StartPageUpdateDto,
  SubmissionResponseDto,
} from '../../types/api'
import { createEmailSubmissionFormData } from '../utils/submission'

const ADMIN_FORM_ENDPOINT = '/api/v3/admin/forms'

export const updateFormSettings = async (
  formId: string,
  settingsToUpdate: SettingsUpdateDto,
): Promise<FormSettings> => {
  return axios
    .patch<FormSettings>(
      `${ADMIN_FORM_ENDPOINT}/${formId}/settings`,
      settingsToUpdate,
    )
    .then(({ data }) => data)
}

export const getSingleFormField = async (
  formId: string,
  fieldId: string,
): Promise<FormFieldDto> => {
  return axios
    .get<FormFieldDto>(`${ADMIN_FORM_ENDPOINT}/${formId}/fields/${fieldId}`)
    .then(({ data }) => data)
}

export const updateSingleFormField = async (
  formId: string,
  fieldId: string,
  updateFieldBody: FieldUpdateDto,
): Promise<FieldUpdateDto> => {
  return axios
    .put<FieldUpdateDto>(
      `${ADMIN_FORM_ENDPOINT}/${formId}/fields/${fieldId}`,
      updateFieldBody,
    )
    .then(({ data }) => data)
}

export const createSingleFormField = async (
  formId: string,
  createFieldBody: FieldCreateDto,
): Promise<FormFieldDto> => {
  return axios
    .post<FormFieldDto>(
      `${ADMIN_FORM_ENDPOINT}/${formId}/fields`,
      createFieldBody,
    )
    .then(({ data }) => data)
}

export const updateCollaborators = async (
  formId: string,
  collaboratorsToUpdate: PermissionsUpdateDto,
): Promise<PermissionsUpdateDto> => {
  return axios
    .put<PermissionsUpdateDto>(
      `${ADMIN_FORM_ENDPOINT}/${formId}/collaborators`,
      collaboratorsToUpdate,
    )
    .then(({ data }) => data)
}

export const duplicateSingleFormField = async (
  formId: string,
  fieldId: string,
): Promise<FormFieldDto> => {
  return axios
    .post<FormFieldDto>(
      `${ADMIN_FORM_ENDPOINT}/${formId}/fields/${fieldId}/duplicate`,
    )
    .then(({ data }) => data)
}

/**
 * Reorders the field to the given new position.
 * @param formId the id of the form to perform the field reorder
 * @param fieldId the id of the field to reorder
 * @param newPosition the position to move the field to
 * @returns the reordered form fields of the form corresponding to the formId
 */
export const reorderSingleFormField = async (
  formId: string,
  fieldId: string,
  newPosition: number,
): Promise<FormFieldDto[]> => {
  return axios
    .post<FormFieldDto[]>(
      `${ADMIN_FORM_ENDPOINT}/${formId}/fields/${fieldId}/reorder`,
      {},
      { params: { to: newPosition } },
    )
    .then(({ data }) => data)
}

/**
 * Delete a single form field by its id in given form
 * @param formId the id of the form to delete the field from
 * @param fieldId the id of the field to delete
 * @returns void on success
 */
export const deleteSingleFormField = async (
  formId: string,
  fieldId: string,
): Promise<void> => {
  return axios.delete(`${ADMIN_FORM_ENDPOINT}/${formId}/fields/${fieldId}`)
}

/**
 * Updates the end page for the given form referenced by its id
 * @param formId the id of the form to update end page for
 * @param newEndPage the new endpage to replace with
 * @returns the updated end page on success
 */
export const updateFormEndPage = async (
  formId: string,
  newEndPage: EndPageUpdateDto,
): Promise<EndPageUpdateDto> => {
  return axios
    .put<EndPageUpdateDto>(
      `${ADMIN_FORM_ENDPOINT}/${formId}/end-page`,
      newEndPage,
    )
    .then(({ data }) => data)
}

export const createFormLogic = async (
  formId: string,
  createLogicBody: LogicDto,
): Promise<LogicDto> => {
  return axios
    .post<LogicDto>(`${ADMIN_FORM_ENDPOINT}/${formId}/logic`, createLogicBody)
    .then(({ data }) => data)
}

export const deleteFormLogic = async (
  formId: string,
  logicId: string,
): Promise<true> => {
  return axios
    .delete(`${ADMIN_FORM_ENDPOINT}/${formId}/logic/${logicId}`)
    .then(() => true)
}

export const updateFormLogic = async (
  formId: string,
  logicId: string,
  updatedLogic: LogicDto,
): Promise<LogicDto> => {
  return axios
    .put<LogicDto>(
      `${ADMIN_FORM_ENDPOINT}/${formId}/logic/${logicId}`,
      updatedLogic,
    )
    .then(({ data }) => data)
}

/**
 * Updates the start page for the given form referenced by its id
 * @param formId the id of the form to update start page for
 * @param newEndPage the new start page to replace with
 * @returns the updated start page on success
 */
export const updateFormStartPage = async (
  formId: string,
  newStartPage: StartPageUpdateDto,
): Promise<StartPageUpdateDto> => {
  return axios
    .put<StartPageUpdateDto>(
      `${ADMIN_FORM_ENDPOINT}/${formId}/start-page`,
      newStartPage,
    )
    .then(({ data }) => data)
}

/**
 * Submits a preview version of an email mode form submission.
 * @param formId id of form to submit submission for
 * @param content content of submission
 * @param attachments any attachments included in submission
 * @param captchaResponse string if captcha to be included, defaults to null
 *
 * @returns SubmissionResponseDto if successful, else SubmissionErrorDto on error
 */
export const submitEmailModeFormSubmissionPreview = async ({
  formId,
  content,
  attachments,
  captchaResponse,
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
      `${ADMIN_FORM_ENDPOINT}/${formId}/preview/submissions/email`,
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
 * Submits a preview version of a storage mode form's submission.
 * @param formId id of form to submit submission for
 * @param content the storage mode submission object to submit
 * @param captchaResponse string if captcha to be included, defaults to null
 *
 * @returns SubmissionResponseDto if successful, else SubmissionErrorDto on error
 */
export const submitStorageModeFormSubmissionPreview = async ({
  formId,
  content,
  captchaResponse,
}: {
  formId: string
  content: EncryptSubmissionDto
  captchaResponse: string
}): Promise<SubmissionResponseDto> => {
  return axios
    .post<SubmissionResponseDto>(
      `${ADMIN_FORM_ENDPOINT}/${formId}/preview/submissions/encrypt`,
      content,
      {
        params: {
          captchaResponse: String(captchaResponse),
        },
      },
    )
    .then(({ data }) => data)
}
