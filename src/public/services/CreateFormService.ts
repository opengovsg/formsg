import axios from 'axios'

import {
  AdminDashboardFormMetaDto,
  CreateFormBodyDto,
  DuplicateFormBodyDto,
  FormDto,
} from '../../../shared/types/form/form'

export const ADMIN_FORM_ENDPOINT = '/api/v3/admin/forms'

/**
 * Duplicates the form
 * @param formId formId of form to be duplicated
 * @param duplicateFormBody Title, response mode and relevant information for new form
 * @returns Metadata of duplicated form for dashboard view
 */
export const duplicateForm = async (
  formId: string,
  duplicateFormBody: DuplicateFormBodyDto,
): Promise<AdminDashboardFormMetaDto> => {
  return axios
    .post<AdminDashboardFormMetaDto>(
      `${ADMIN_FORM_ENDPOINT}/${formId}/duplicate`,
      duplicateFormBody,
    )
    .then(({ data }) => data)
}

/**
 * Creates a new form. This function is called without formId, so the endpoint is just /adminform.
 * @param newForm Form fields to newly created form
 * @returns Newly created form.
 */
export const createForm = async (
  newForm: CreateFormBodyDto,
): Promise<FormDto> => {
  return axios
    .post<FormDto>(`${ADMIN_FORM_ENDPOINT}`, { form: newForm })
    .then(({ data }) => data)
}
