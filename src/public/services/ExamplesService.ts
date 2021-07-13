import axios from 'axios'

import {
  AdminDashboardFormMetaDto,
  DuplicateFormBodyDto,
  PreviewFormViewDto,
} from '../../../shared/types/form/form'
import {
  ExampleFormsQueryDto,
  ExampleFormsResult,
  ExampleSingleFormResult,
} from '../../types/api'

export const EXAMPLES_ENDPOINT = '/examples'

/**
 * Gets example forms that matches the specified parameters for listing
 * @param exampleFormsSearchParams The search terms to query the backend for
 * @returns The list of retrieved examples if `shouldGetTotalNumResults` is false
 * @returns The list of retrieved examples with the total results if `shouldGetTotalNumResults` is true
 */
export const getExampleForms = (
  exampleFormsSearchParams: ExampleFormsQueryDto,
): Promise<ExampleFormsResult> => {
  return axios
    .get<ExampleFormsResult>(EXAMPLES_ENDPOINT, {
      params: exampleFormsSearchParams,
      headers: { 'If-Modified-Since': '0' },
    })
    .then(({ data }) => data)
}
/**
 * Gets a single form for examples
 * @param formId The id of the form to search for
 * @returns The information of the example form
 */
export const getSingleExampleForm = (
  formId: string,
): Promise<ExampleSingleFormResult> => {
  return axios
    .get<ExampleSingleFormResult>(`${EXAMPLES_ENDPOINT}/${formId}`, {
      headers: { 'If-Modified-Since': '0' },
    })
    .then(({ data }) => data)
}

/**
 * Used to create a new form from an existing template.
 * @param formId formId of template to base the new form on
 * @returns Metadata for newly created form in dashboard view
 */
export const useTemplate = async (
  formId: string,
  overrideParams: DuplicateFormBodyDto,
): Promise<AdminDashboardFormMetaDto> => {
  return axios
    .post<AdminDashboardFormMetaDto>(`${formId}/adminform/copy`, overrideParams)
    .then(({ data }) => data)
}

/**
 * Queries templates with use-template or examples listings. Any logged in officer is authorized.
 * @param formId formId of template in question
 * @returns Public view of a template
 */
export const queryTemplate = async (
  formId: string,
): Promise<PreviewFormViewDto> => {
  return axios
    .get<PreviewFormViewDto>(`${formId}/adminform/template`)
    .then(({ data }) => data)
}
