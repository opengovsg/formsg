import range from 'lodash/range'
import { Document, LeanDocument, Model, ToObjectOptions, Types } from 'mongoose'
import { SetRequired } from 'type-fest'

import { OverrideProps } from '../app/modules/form/admin-form/admin-form.types'

import { PublicView, UpdateManyMeta } from './database'
import {
  FormField,
  FormFieldWithId,
  IFieldSchema,
  MyInfoAttribute,
} from './field'
import { ILogicSchema, LogicDto } from './form_logic'
import { ICustomFormLogo, IFormLogo } from './form_logo'
import { IPopulatedUser, IUserSchema, PublicUser } from './user'

export enum AuthType {
  NIL = 'NIL',
  SP = 'SP',
  CP = 'CP',
  MyInfo = 'MyInfo',
}

export enum Status {
  Private = 'PRIVATE',
  Public = 'PUBLIC',
  Archived = 'ARCHIVED',
}

export enum Colors {
  Blue = 'blue',
  Red = 'red',
  Green = 'green',
  Orange = 'orange',
  Brown = 'brown',
  Grey = 'grey',
}

export enum ResponseMode {
  Encrypt = 'encrypt',
  Email = 'email',
}

export const Rating = range(1, 11).map(String)

// Typings
// Make sure this is kept in sync with form.server.model#FORM_PUBLIC_FIELDS.
export type PublicFormValues = Pick<
  IFormDocument,
  | 'admin'
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

export type PublicForm = Omit<PublicFormValues, 'admin'> & {
  admin: PublicUser
}

export type FormOtpData = {
  form: IFormSchema['_id']
  formAdmin: {
    email: IUserSchema['email']
    userId: IUserSchema['_id']
  }
  // Used for sending with the correct twilio
  msgSrvcName?: string
}

export type StartPage = {
  paragraph?: string
  estTimeTaken?: number
  colorTheme?: Colors
  logo?: IFormLogo | ICustomFormLogo
}

export type EndPage = {
  title?: string
  paragraph?: string
  buttonLink?: string
  buttonText?: string
}

export type Permission = {
  email: string
  write: boolean
  _id?: string
}

export type Webhook = {
  url: string
  isRetryEnabled: boolean
}

/**
 * Typing for duplicate form with specific keys.
 */
export type PickDuplicateForm = Pick<
  IFormSchema,
  | 'form_fields'
  | 'form_logics'
  | 'startPage'
  | 'endPage'
  | 'authType'
  | 'inactiveMessage'
  | 'submissionLimit'
  | 'responseMode'
>
export interface IForm {
  title: string
  form_fields?: IFieldSchema[]
  form_logics?: ILogicSchema[]
  admin: IUserSchema['_id']
  permissionList?: Permission[]

  startPage?: StartPage
  endPage?: EndPage

  hasCaptcha?: boolean
  authType?: AuthType

  status?: Status

  inactiveMessage?: string
  submissionLimit?: number | null
  isListed?: boolean
  esrvcId?: string
  webhook?: Webhook
  msgSrvcName?: string

  responseMode: ResponseMode

  // Schema properties
  created?: Date
  lastModified?: Date

  publicKey?: string
  // string type is allowed due to a setter on the form schema that transforms
  // strings to string array.
  emails?: string[] | string
}

export type IOnboardedForm<T extends IForm> = T & {
  msgSrvcName: string
}

export type FormSettings = Pick<
  IFormDocument,
  | 'authType'
  | 'emails'
  | 'esrvcId'
  | 'hasCaptcha'
  | 'inactiveMessage'
  | 'status'
  | 'submissionLimit'
  | 'title'
  | 'webhook'
>

export interface IFormSchema extends IForm, Document, PublicView<PublicForm> {
  form_fields?: Types.DocumentArray<IFieldSchema> | IFieldSchema[]
  form_logics?: Types.DocumentArray<ILogicSchema> | ILogicSchema[]

  /**
   * Replaces the field corresponding to given id to given new field
   * @param fieldId the id of the field to update
   * @param newField the new field to replace with
   * @returns updated form after the update if field update is successful
   * @returns null if field not found
   * @throws validation error on invalid updates, or if new field type is different from current field type
   */
  updateFormFieldById<T>(
    this: T,
    fieldId: string,
    newField: FormFieldWithId,
  ): Promise<T | null>

  updateFormCollaborators<T>(
    this: T,
    updateFormCollaborators: Permission[],
  ): Promise<T>

  /**
   * Duplicates a form field into the form
   * @param newField the fieldId of the field to duplicate
   * @returns updated form after the duplication if field duplication is successful
   * @throws FieldNotFound error if field to duplicate does not exist

   */
  duplicateFormFieldById<T>(this: T, fieldId: string): Promise<T | null>

  /**
   * Reorders field corresponding to given fieldId to given newPosition
   * @param fieldId the id of the field to reorder
   * @param newPosition the new position to move the field to
   * @returns updated form after the reordering if field reorder is successful
   * @returns null if field is not found
   */
  reorderFormFieldById<T>(
    this: T,
    fieldId: string,
    newPosition: number,
  ): Promise<T | null>

  /**
   * Inserts a form field into the form
   * @param newField the new field to insert
   * @returns updated form after the insertion if field insertion is successful
   * @throws validation error on invalid updates
   */
  insertFormField<T>(this: T, newField: FormField): Promise<T | null>

  /**
   * Returns the dashboard form view of the form.
   * @param admin the admin to inject into the returned object
   * @returns dashboard form view object
   */
  getDashboardView(admin: IPopulatedUser): FormMetaView
  getUniqueMyInfoAttrs(): MyInfoAttribute[]
  /**
   * Retrieve form settings.
   */
  getSettings(): FormSettings
  /**
   * Archives form.
   * @returns form that has been archived
   */
  archive(): Promise<IFormSchema>

  /**
   * Transfer ownership of the form to another user.
   * @param currentOwner the current owner of the form. The owner is retrieved outside of the method to force validation to be performed correctly.
   * @param newOwner the new owner of the form. Similarly retrieved outside of method to force correct validation.
   * @returns updated form
   */
  transferOwner<T = IFormSchema>(
    currentOwner: IUserSchema,
    newOwner: IUserSchema,
  ): Promise<T>
  /**
   * Return essential form creation parameters with the given properties.
   * @param overrideProps the props to override on the duplicated form
   * @returns params required to create a new duplicated form object
   */
  getDuplicateParams(
    overrideProps: OverrideProps,
  ): PickDuplicateForm & OverrideProps
}

/**
 * Schema type with defaults populated and thus set to be defined.
 */
export interface IFormDocument extends IFormSchema {
  form_fields: NonNullable<IFormSchema['form_fields']>
  form_logics: NonNullable<IFormSchema['form_logics']>
  permissionList: NonNullable<IFormSchema['permissionList']>
  hasCaptcha: NonNullable<IFormSchema['hasCaptcha']>
  authType: NonNullable<IFormSchema['authType']>
  status: NonNullable<IFormSchema['status']>
  inactiveMessage: NonNullable<IFormSchema['inactiveMessage']>
  // NOTE: Due to the way creating a form works, creating a form without specifying submissionLimit will throw an error.
  // Hence, using Exclude here over NonNullable.
  submissionLimit: Exclude<IFormSchema['submissionLimit'], undefined>
  isListed: NonNullable<IFormSchema['isListed']>
  startPage: SetRequired<NonNullable<IFormSchema['startPage']>, 'colorTheme'>
  endPage: SetRequired<
    NonNullable<IFormSchema['endPage']>,
    'title' | 'buttonText'
  >
  webhook: SetRequired<NonNullable<IFormSchema['webhook']>, 'url'>
}
export interface IPopulatedForm extends Omit<IFormDocument, 'toJSON'> {
  admin: IPopulatedUser
  // Override types.
  toJSON(options?: ToObjectOptions): LeanDocument<IPopulatedForm>
}

export interface IEncryptedForm extends IForm {
  publicKey: string
  emails?: never
}

export type IEncryptedFormSchema = IEncryptedForm & IFormSchema

export type IPopulatedEncryptedForm = IPopulatedForm & IEncryptedForm

export interface IEmailForm extends IForm {
  // string type is allowed due to a setter on the form schema that transforms
  // strings to string array.
  emails: string[] | string
  publicKey?: never
}

export type IEmailFormSchema = IEmailForm & IFormSchema

export type IPopulatedEmailForm = IPopulatedForm & IEmailForm

export interface IFormModel extends Model<IFormSchema> {
  getOtpData(formId: string): Promise<FormOtpData | null>

  getFullFormById(
    formId: string,
    fields?: (keyof IPopulatedForm)[],
  ): Promise<IPopulatedForm | null>

  createFormLogic(
    formId: string,
    createLogicBody: LogicDto,
  ): Promise<IFormSchema | null>
  deleteFormLogic(formId: string, logicId: string): Promise<IFormSchema | null>

  /**
   * Deletes specified form field by its id from the form corresponding to given form id.
   * @param formId the id of the form to delete specific form field for
   * @param fieldId the id of the form field to delete from the form
   * @returns updated form after deletion of form field
   */
  deleteFormFieldById(
    formId: string,
    fieldId: string,
  ): Promise<IFormSchema | null>

  deactivateById(formId: string): Promise<IFormSchema | null>

  getMetaByUserIdOrEmail(
    userId: IUserSchema['_id'],
    userEmail: IUserSchema['email'],
  ): Promise<FormMetaView[]>

  disableSmsVerificationsForUser(
    userId: IUserSchema['_id'],
  ): Promise<UpdateManyMeta>

  /**
   * Update the end page of form with given endpage object.
   * @param formId the id of the form to update
   * @param newEndPage the new EndPage object to replace with
   * @returns the updated form document if form exists, null otherwise
   */
  updateEndPageById(
    formId: string,
    newEndPage: EndPage,
  ): Promise<IFormDocument | null>

  /**
   * Update the start page of form with given startpage object.
   * @param formId the id of the form to update
   * @param newStartPage the new StartPage object to replace with
   * @returns the updated form document if form exists, null otherwise
   */
  updateStartPageById(
    formId: string,
    newStartPage: StartPage,
  ): Promise<IFormDocument | null>

  updateFormLogic(
    formId: string,
    logicId: string,
    updatedLogic: LogicDto,
  ): Promise<IFormSchema | null>
}

export type IEncryptedFormModel = IFormModel & Model<IEncryptedFormSchema>
export type IEmailFormModel = IFormModel & Model<IEmailFormSchema>

/** Typing for the shape of the important meta subset for form document. */
export type FormMetaView = Pick<
  IFormSchema,
  'title' | 'lastModified' | 'status' | '_id' | 'responseMode'
> & {
  admin: IPopulatedUser
}
