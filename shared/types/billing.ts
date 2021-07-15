import { AgencyDto } from './agency'
import { FormDto } from './form/form'
import { UserDto } from './user'

/**
 * The name `Login` may cause confusion.
 * This type relates to the data stored when a form respondent logs in to the
 * form via any of the public form auth methods (Singpass, Corppass, MyInfo,
 * etc).
 */
export type LoginBase = {
  admin: UserDto['_id']
  form: FormDto['_id']
  agency: AgencyDto['_id']
  authType: FormDto['authType']
  // A login must be for a form that has an esrvcId.
  esrvcId: NonNullable<FormDto['esrvcId']>
}

export type FormBillingStatistic = {
  adminEmail: UserDto['email']
  formName: FormDto['title']
  formId: FormDto['_id']
  authType: FormDto['authType']
  total: number
}

// yr: The year to get the billing information for
// mth: The month to get the billing information for
// esrvcId: The id of the form
export type BillingQueryDto = {
  esrvcId: NonNullable<FormDto['esrvcId']>
  yr: string
  mth: string
}

export type BillingInfoDto = { loginStats: FormBillingStatistic[] }
