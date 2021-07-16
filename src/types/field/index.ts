import { Document } from 'mongoose'
import { ConditionalExcept, Merge } from 'type-fest'

import {
  BasicField,
  FormField,
  FormFieldWithId,
  MyInfoAttribute,
} from '../../../shared/types/field'

import { IAttachmentFieldSchema } from './attachmentField'
import { ICheckboxFieldSchema } from './checkboxField'
import { IDateFieldSchema } from './dateField'
import { IDecimalFieldSchema } from './decimalField'
import { IDropdownFieldSchema } from './dropdownField'
import { IEmailFieldSchema } from './emailField'
import { IHomenoFieldSchema } from './homeNoField'
import { IImageFieldSchema } from './imageField'
import { ILongTextFieldSchema } from './longTextField'
import { IMobileFieldSchema } from './mobileField'
import { INricFieldSchema } from './nricField'
import { INumberFieldSchema } from './numberField'
import { IRadioFieldSchema } from './radioField'
import { IRatingFieldSchema } from './ratingField'
import { ISectionFieldSchema } from './sectionField'
import { IShortTextFieldSchema } from './shortTextField'
import { IStatementFieldSchema } from './statementField'
import { ITableFieldSchema } from './tableField'
import { IUenFieldSchema } from './uenField'
import { IYesNoFieldSchema } from './yesNoField'

export * from '../../../shared/types/field/utils'
export * from './attachmentField'
export * from './baseField'
export * from './checkboxField'
export * from './dateField'
export * from './decimalField'
export * from './dropdownField'
export * from './emailField'
export * from './homeNoField'
export * from './imageField'
export * from './longTextField'
export * from './mobileField'
export * from './myinfoField'
export * from './nricField'
export * from './numberField'
export * from './radioField'
export * from './ratingField'
export * from './sectionField'
export * from './shortTextField'
export * from './statementField'
export * from './tableField'
export * from './uenField'
export * from './yesNoField'

export { BasicField, MyInfoAttribute, FormField, FormFieldWithId }

export enum SPCPFieldTitle {
  SpNric = 'SingPass Validated NRIC',
  CpUid = 'CorpPass Validated UID',
  CpUen = 'CorpPass Validated UEN',
}

export enum SgidFieldTitle {
  SgidNric = 'sgID Validated NRIC',
}

export type FormFieldSchema =
  | IAttachmentFieldSchema
  | ICheckboxFieldSchema
  | IDateFieldSchema
  | IDecimalFieldSchema
  | IDropdownFieldSchema
  | IEmailFieldSchema
  | IHomenoFieldSchema
  | IImageFieldSchema
  | ILongTextFieldSchema
  | IMobileFieldSchema
  | INricFieldSchema
  | INumberFieldSchema
  | IRadioFieldSchema
  | IRatingFieldSchema
  | ISectionFieldSchema
  | IShortTextFieldSchema
  | IStatementFieldSchema
  | ITableFieldSchema
  | IUenFieldSchema
  | IYesNoFieldSchema

/**
 * Helper type to only retain from FormFieldSchema the props required to create
 * a validator for that field.
 * I have created a monster.
 */
export type OmitUnusedValidatorProps<F extends FormFieldSchema> = Merge<
  Omit<
    // Remove all functions from the given field schema.
    // eslint-disable-next-line @typescript-eslint/ban-types
    ConditionalExcept<F, Function>,
    // Remove unused
    'disabled' | 'description' | keyof Document
  >,
  // Omitting keyof Document removes the _id prop, but it is still needed for
  // some validator functions.
  { _id?: F['_id'] }
>

export type FieldValidationSchema =
  | OmitUnusedValidatorProps<IAttachmentFieldSchema>
  | OmitUnusedValidatorProps<ICheckboxFieldSchema>
  | OmitUnusedValidatorProps<IDateFieldSchema>
  | OmitUnusedValidatorProps<IDecimalFieldSchema>
  | OmitUnusedValidatorProps<IDropdownFieldSchema>
  | OmitUnusedValidatorProps<IEmailFieldSchema>
  | OmitUnusedValidatorProps<IHomenoFieldSchema>
  | OmitUnusedValidatorProps<IImageFieldSchema>
  | OmitUnusedValidatorProps<ILongTextFieldSchema>
  | OmitUnusedValidatorProps<IMobileFieldSchema>
  | OmitUnusedValidatorProps<INricFieldSchema>
  | OmitUnusedValidatorProps<INumberFieldSchema>
  | OmitUnusedValidatorProps<IRadioFieldSchema>
  | OmitUnusedValidatorProps<IRatingFieldSchema>
  | OmitUnusedValidatorProps<ISectionFieldSchema>
  | OmitUnusedValidatorProps<IShortTextFieldSchema>
  | OmitUnusedValidatorProps<IStatementFieldSchema>
  | OmitUnusedValidatorProps<ITableFieldSchema>
  | OmitUnusedValidatorProps<IUenFieldSchema>
  | OmitUnusedValidatorProps<IYesNoFieldSchema>
