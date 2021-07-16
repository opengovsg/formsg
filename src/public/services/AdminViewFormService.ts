import axios from 'axios'

import {
  AdminDashboardFormMetaDto,
  AdminFormViewDto,
  PreviewFormViewDto,
} from '../../../shared/types/form/form'

// endpoint exported for testing
export const ADMIN_FORM_ENDPOINT = '/api/v3/admin/forms'

/**
 * Gets metadata for all forms in dashboard view i.e. forms which user
 * owns or collaborates on
 * @returns Metadata required for forms on dashboard view
 */
export const getDashboardView = async (): Promise<
  AdminDashboardFormMetaDto[]
> => {
  return axios
    .get<AdminDashboardFormMetaDto[]>(`${ADMIN_FORM_ENDPOINT}`)
    .then(({ data }) => data)
}

/**
 * Gets admin view of form.
 * @param formId formId of form in question
 * @returns Admin view of form
 */
export const getAdminFormView = async (
  formId: string,
): Promise<AdminFormViewDto> => {
  return axios
    .get<AdminFormViewDto>(`${ADMIN_FORM_ENDPOINT}/${formId}`)
    .then(({ data }) => data)
}

/**
 * Gets the public view of a form. Used for previewing the form from the form admin page.
 * Must be a viewer, collaborator or admin.
 * @param formId formId of form in question
 * @returns Public view of a form
 */
export const previewForm = async (
  formId: string,
): Promise<PreviewFormViewDto> => {
  return axios
    .get<PreviewFormViewDto>(`${ADMIN_FORM_ENDPOINT}/${formId}/preview`)
    .then(({ data }) => data)
}
