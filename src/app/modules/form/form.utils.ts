import { pick } from 'lodash'
import { Merge } from 'type-fest'

import { IPopulatedForm } from 'src/types'

// Kept in this file instead of form.types.ts so that this can be kept in sync
// with FORM_PUBLIC_FIELDS more easily.
type PublicFormValues = Pick<
  IPopulatedForm,
  | 'authType'
  | 'endPage'
  | 'esrvcId'
  | 'form_fields'
  | 'form_logics'
  | 'hasCaptcha'
  | 'publicKey'
  | 'startPage'
  | 'status'
  | 'title'
  | '_id'
  | 'responseMode'
>

export type PublicForm = Merge<
  PublicFormValues,
  { admin: Pick<IPopulatedForm['admin'], 'agency'> }
>

const FORM_PUBLIC_FIELDS = [
  'admin',
  'authType',
  'endPage',
  'esrvcId',
  'form_fields',
  'form_logics',
  'hasCaptcha',
  'publicKey',
  'startPage',
  'status',
  'title',
  '_id',
  'responseMode',
]

/**
 * Removes all private details such as admin email from given form.
 * @param form the form to scrub
 * @returns form with only public details
 */
export const removePrivateDetailsFromForm = (
  form: IPopulatedForm,
): PublicForm => {
  return {
    ...(pick(form, FORM_PUBLIC_FIELDS) as PublicFormValues),
    admin: pick(form.admin, 'agency'),
  }
}
