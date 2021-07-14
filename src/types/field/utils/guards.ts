/* Type guards */
import {
  BasicField,
  IAttachmentField,
  ICheckboxField,
  IDateField,
  IDecimalField,
  IDropdownField,
  IEmailFieldSchema,
  IField,
  IFieldSchema,
  IHomenoField,
  ILongTextField,
  IMobileField,
  INricField,
  INumberField,
  IRadioField,
  IRatingField,
  ISectionFieldSchema,
  IShortTextField,
  ITableFieldSchema,
  IUenField,
  IVerifiableMobileField,
  IYesNoField,
} from '..'

export const isSectionField = (
  formField: IField,
): formField is ISectionFieldSchema => {
  return formField.fieldType === BasicField.Section
}

export const isShortTextField = (
  formField: IField,
): formField is IShortTextField => {
  return formField.fieldType === BasicField.ShortText
}

export const isLongTextField = (
  formField: IField,
): formField is ILongTextField => {
  return formField.fieldType === BasicField.LongText
}

export const isCheckboxField = (
  formField: IField,
): formField is ICheckboxField => {
  return formField.fieldType === BasicField.Checkbox
}

export const isNricField = (formField: IField): formField is INricField => {
  return formField.fieldType === BasicField.Nric
}

export const isHomeNumberField = (
  formField: IField,
): formField is IHomenoField => {
  return formField.fieldType === BasicField.HomeNo
}

export const isRadioButtonField = (
  formField: IField,
): formField is IRadioField => {
  return formField.fieldType === BasicField.Radio
}

export const isRatingField = (formField: IField): formField is IRatingField => {
  return formField.fieldType === BasicField.Rating
}

export const isMobileNumberField = (
  formField: IField,
): formField is IMobileField => {
  return formField.fieldType === BasicField.Mobile
}

export const isVerifiableMobileField = (
  formField: IField,
): formField is IVerifiableMobileField => {
  return isMobileNumberField(formField) && formField.isVerifiable
}

export const isAttachmentField = (
  formField: IField,
): formField is IAttachmentField => {
  return formField.fieldType === BasicField.Attachment
}

export const isDateField = (formField: IField): formField is IDateField => {
  return formField.fieldType === BasicField.Date
}

export const isDecimalField = (
  formField: IField,
): formField is IDecimalField => {
  return formField.fieldType === BasicField.Decimal
}

export const isUenField = (formField: IField): formField is IUenField => {
  return formField.fieldType === BasicField.Uen
}

export const isYesNoField = (formField: IField): formField is IYesNoField => {
  return formField.fieldType === BasicField.YesNo
}

export const isEmailField = (
  formField: IFieldSchema,
): formField is IEmailFieldSchema => {
  return formField.fieldType === BasicField.Email
}

export const isDropdownField = (
  formField: IField,
): formField is IDropdownField => {
  return formField.fieldType === BasicField.Dropdown
}

export const isNumberField = (formField: IField): formField is INumberField => {
  return formField.fieldType === BasicField.Number
}

export const isTableField = (
  formField: IField,
): formField is ITableFieldSchema => {
  return formField.fieldType === BasicField.Table
}
