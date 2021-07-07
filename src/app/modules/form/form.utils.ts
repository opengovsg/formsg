import {
  IEncryptedFormSchema,
  IFieldSchema,
  IFormSchema,
  ILogicSchema,
  IPopulatedEmailForm,
  IPopulatedForm,
  Permission,
  ResponseMode,
} from '../../../types'
import { smsConfig } from '../../config/features/sms.config'
import { isMongooseDocumentArray } from '../../utils/mongoose'

// Converts 'test@hotmail.com, test@gmail.com' to ['test@hotmail.com', 'test@gmail.com']
export const transformEmailString = (v: string): string[] => {
  return v
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((email) => email.includes('@')) // remove ""
}

// Function that coerces the string of comma-separated emails sent by the client
// into an array of emails
export const transformEmails = (v: string | string[]): string[] => {
  // Cases
  // ['test@hotmail.com'] => ['test@hotmail.com'] ~ unchanged
  // ['test@hotmail.com', 'test@gmail.com'] => ['test@hotmail.com', 'test@gmail.com'] ~ unchanged
  // ['test@hotmail.com, test@gmail.com'] => ['test@hotmail.com', 'test@gmail.com']
  // ['test@hotmail.com, test@gmail.com', 'test@yahoo.com'] => ['test@hotmail.com', 'test@gmail.com', 'test@yahoo.com']
  // 'test@hotmail.com, test@gmail.com' => ['test@hotmail.com', 'test@gmail.com']
  if (Array.isArray(v)) {
    return v.flatMap(transformEmailString)
  } else {
    return transformEmailString(v)
  }
}

/**
 * Typeguard to check if given form is an encrypt mode form.
 * @param form the form to check
 * @returns true if form is encrypt mode form, false otherwise.
 */
export const isFormEncryptMode = (
  form: IFormSchema | IPopulatedForm,
): form is IEncryptedFormSchema => {
  return form.responseMode === ResponseMode.Encrypt
}

/**
 * Extracts emails of collaborators, optionally filtering for a specific
 * write permission.
 * @param permissionList List of collaborators
 * @param writePermission Optional write permission to filter on
 * @returns Array of emails
 */
export const getCollabEmailsWithPermission = (
  permissionList?: Permission[],
  writePermission?: boolean,
): string[] => {
  if (!permissionList) {
    return []
  }
  return permissionList.reduce<string[]>((acc, collaborator) => {
    if (
      writePermission === undefined ||
      writePermission === collaborator.write
    ) {
      acc.push(collaborator.email)
    }
    return acc
  }, [])
}

/**
 * Type guard for whether a populated form is email mode
 * @param form Form document to check
 */
export const isEmailModeForm = (
  form: IPopulatedForm,
): form is IPopulatedEmailForm => {
  return form.responseMode === ResponseMode.Email
}

/**
 * Finds and returns form field in given form by its id
 * @param formFields the form fields to search from
 * @param fieldId the id of the field to retrieve
 * @returns the form field if found, `null` otherwise
 */
export const getFormFieldById = (
  formFields: IFormSchema['form_fields'],
  fieldId: IFieldSchema['_id'],
): IFieldSchema | null => {
  if (!formFields) {
    return null
  }

  if (isMongooseDocumentArray(formFields)) {
    return formFields.id(fieldId)
  }

  return formFields.find((f) => fieldId === String(f._id)) ?? null
}

/**
 * Finds and returns form logic in given form by its id
 * @param form_logics the logics to search from
 * @param logicId the id of the logic to retrieve
 * @returns the logic if found, `null` otherwise
 */
export const getLogicById = (
  form_logics: IFormSchema['form_logics'],
  logicId: ILogicSchema['_id'],
): ILogicSchema | null => {
  if (!form_logics) {
    return null
  }

  if (isMongooseDocumentArray(form_logics)) {
    return form_logics.id(logicId)
  }

  return form_logics.find((logic) => logicId === String(logic._id)) ?? null
}

/**
 * Checks if a given form is onboarded (the form's message service name is defined and different from the default)
 * @param form The form to check
 * @returns boolean indicating if the form is/is not onboarded
 */
export const isFormOnboarded = (
  form: Pick<IPopulatedForm, 'msgSrvcName'>,
): boolean => {
  return form.msgSrvcName
    ? !(form.msgSrvcName === smsConfig.twilioMsgSrvcSid)
    : false
}
