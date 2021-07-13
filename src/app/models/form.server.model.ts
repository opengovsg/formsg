import BSON from 'bson-ext'
import { compact, omit, pick, uniq } from 'lodash'
import mongoose, {
  Mongoose,
  Query,
  Schema,
  SchemaOptions,
  Types,
} from 'mongoose'
import validator from 'validator'

import {
  EMAIL_FORM_SETTINGS_FIELDS,
  EMAIL_PUBLIC_FORM_FIELDS,
  STORAGE_FORM_SETTINGS_FIELDS,
  STORAGE_PUBLIC_FORM_FIELDS,
} from '../../../shared/constants/form'
import { MB } from '../../shared/constants'
import { reorder } from '../../shared/util/immutable-array-fns'
import {
  AuthType,
  BasicField,
  Colors,
  EmailFormSettings,
  EndPage,
  FormField,
  FormFieldWithId,
  FormLogoState,
  FormMetaView,
  FormOtpData,
  FormSettings,
  IEmailFormModel,
  IEmailFormSchema,
  IEncryptedFormModel,
  IEncryptedFormSchema,
  IFieldSchema,
  IFormDocument,
  IFormModel,
  IFormSchema,
  IPopulatedForm,
  LogicDto,
  LogicType,
  Permission,
  PickDuplicateForm,
  PublicForm,
  ResponseMode,
  StartPage,
  Status,
  StorageFormSettings,
} from '../../types'
import { IPopulatedUser, IUserSchema } from '../../types/user'
import { OverrideProps } from '../modules/form/admin-form/admin-form.types'
import { getFormFieldById, transformEmails } from '../modules/form/form.utils'
import { validateWebhookUrl } from '../modules/webhook/webhook.validation'

import getAgencyModel from './agency.server.model'
import {
  BaseFieldSchema,
  createAttachmentFieldSchema,
  createCheckboxFieldSchema,
  createDateFieldSchema,
  createDecimalFieldSchema,
  createDropdownFieldSchema,
  createEmailFieldSchema,
  createHomenoFieldSchema,
  createImageFieldSchema,
  createLongTextFieldSchema,
  createMobileFieldSchema,
  createNricFieldSchema,
  createNumberFieldSchema,
  createRadioFieldSchema,
  createRatingFieldSchema,
  createSectionFieldSchema,
  createShortTextFieldSchema,
  createStatementFieldSchema,
  createTableFieldSchema,
  createUenFieldSchema,
  createYesNoFieldSchema,
} from './field'
import LogicSchema, {
  PreventSubmitLogicSchema,
  ShowFieldsLogicSchema,
} from './form_logic.server.schema'
import { CustomFormLogoSchema, FormLogoSchema } from './form_logo.server.schema'
import getUserModel from './user.server.model'

export const FORM_SCHEMA_ID = 'Form'

const bson = new BSON([
  BSON.Binary,
  BSON.Code,
  BSON.DBRef,
  BSON.Decimal128,
  BSON.Double,
  BSON.Int32,
  BSON.Long,
  BSON.Map,
  BSON.MaxKey,
  BSON.MinKey,
  BSON.ObjectId,
  BSON.BSONRegExp,
  BSON.Symbol,
  BSON.Timestamp,
])

const formSchemaOptions: SchemaOptions = {
  id: false,
  toJSON: {
    getters: true,
  },
  discriminatorKey: 'responseMode',
  read: 'nearest',
  timestamps: {
    createdAt: 'created',
    updatedAt: 'lastModified',
  },
}

const EncryptedFormSchema = new Schema<IEncryptedFormSchema>({
  publicKey: {
    type: String,
    required: true,
  },
})

const EmailFormSchema = new Schema<IEmailFormSchema, IEmailFormModel>({
  emails: {
    type: [
      {
        type: String,
        trim: true,
      },
    ],
    set: transformEmails,
    validate: {
      validator: (v: string[]) => {
        if (!Array.isArray(v)) return false
        if (v.length === 0) return false
        return v.every((email) => validator.isEmail(email))
      },
      message: 'Please provide valid email addresses',
    },
    // Mongoose v5 only checks if the type is an array, not whether the array
    // is non-empty.
    required: true,
  },
})

const compileFormModel = (db: Mongoose): IFormModel => {
  const Agency = getAgencyModel(db)
  const User = getUserModel(db)

  // Schema
  const FormSchema = new Schema<IFormSchema, IFormModel>(
    {
      title: {
        type: String,
        validate: [
          /^[a-zA-Z0-9_\-./() &`;'"]*$/,
          'Form name cannot contain special characters',
        ],
        required: 'Form name cannot be blank',
        minlength: [4, 'Form name must be at least 4 characters'],
        maxlength: [200, 'Form name can have a maximum of 200 characters'],
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        trim: true,
      },

      form_fields: {
        type: [BaseFieldSchema],
        validate: {
          validator: function (this: IFormSchema) {
            const myInfoFieldCount = (this.form_fields ?? []).reduce(
              (acc, field) => acc + (field.myInfo ? 1 : 0),
              0,
            )
            return (
              myInfoFieldCount === 0 ||
              (this.authType === AuthType.MyInfo &&
                this.responseMode === ResponseMode.Email &&
                myInfoFieldCount <= 30)
            )
          },
          message:
            'Check that your form is MyInfo-authenticated, is an email mode form and has 30 or fewer MyInfo fields.',
        },
      },
      form_logics: [LogicSchema],

      admin: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: 'Form must have an Admin',
      },

      permissionList: {
        type: [
          {
            email: {
              type: String,
              trim: true,
              required: true,
            },
            write: {
              type: Boolean,
              default: false,
            },
          },
        ],
        validate: {
          validator: async (users: Permission[]) => {
            // Retrieve count of users that exist in the Agency collection.
            // Map is used instead of for...of loop so that this runs in
            // parallel.
            const areUsersExist = await Promise.all(
              users.map(async (user) => {
                const userEmail = user.email
                if (!userEmail) {
                  return false
                }
                const emailDomain = userEmail.split('@').pop()
                const result = await Agency.findOne({ emailDomain })
                return !!result
              }),
            )

            // Check if number of truthy values equal initial array length.
            return areUsersExist.filter(Boolean).length === users.length
          },
          message: 'Failed to update collaborators list.',
        },
      },

      startPage: {
        paragraph: String,
        estTimeTaken: Number,
        colorTheme: {
          type: String,
          enum: Object.values(Colors),
          default: Colors.Blue,
        },
        logo: {
          type: FormLogoSchema,
          default: () => ({}),
        },
      },

      endPage: {
        title: {
          type: String,
          default: 'Thank you for filling out the form.',
        },
        paragraph: String,
        buttonLink: String,
        buttonText: {
          type: String,
          default: 'Submit another form',
        },
      },

      hasCaptcha: {
        type: Boolean,
        default: true,
      },

      authType: {
        type: String,
        enum: Object.values(AuthType),
        default: AuthType.NIL,
        set: function (this: IFormSchema, v: AuthType) {
          // TODO (#1222): Convert to validator
          // Do not allow authType to be changed if form is published
          if (this.authType !== v && this.status === Status.Public) {
            return this.authType
          } else if (
            this.responseMode === ResponseMode.Encrypt &&
            v === AuthType.MyInfo
          ) {
            // Do not allow storage mode to have MyInfo authentication
            return this.authType
          } else {
            return v
          }
        },
      },

      status: {
        type: String,
        enum: Object.values(Status),
        default: Status.Private,
        set: function (this: IFormSchema, v: Status) {
          if (
            this.status === Status.Private &&
            v === Status.Public &&
            this.authType !== AuthType.NIL &&
            !this.esrvcId
          ) {
            return Status.Private
          }

          return v
        },
      },

      // The subtext of the message shown on the error page if it is deactivated -
      // the header is "{{ title }} is not available."
      inactiveMessage: {
        type: String,
        default:
          'If you think this is a mistake, please contact the agency that gave you the form link.',
      },

      isListed: {
        type: Boolean,
        default: true,
      },
      esrvcId: {
        type: String,
        required: false,
        validate: [
          /^([a-zA-Z0-9-]){1,25}$/i,
          'e-service ID must be alphanumeric, dashes are allowed',
        ],
      },

      webhook: {
        // TODO: URL validation, encrypt mode validation
        url: {
          type: String,
          default: '',
          validate: {
            validator: async (v: string) => !v || validateWebhookUrl(v),
            message:
              'Webhook must be a valid URL over HTTPS and point to a public IP.',
          },
        },
        isRetryEnabled: {
          type: Boolean,
          default: false,
        },
      },

      msgSrvcName: {
        // Name of credentials for messaging service, stored in secrets manager
        type: String,
        required: false,
      },

      submissionLimit: {
        type: Number,
        default: null,
        min: 1,
      },
    },
    formSchemaOptions,
  )

  // Add discriminators for the various field types.
  const FormFieldPath = FormSchema.path(
    'form_fields',
  ) as Schema.Types.DocumentArray

  const TableFieldSchema = createTableFieldSchema()

  FormFieldPath.discriminator(BasicField.Email, createEmailFieldSchema())
  FormFieldPath.discriminator(BasicField.Rating, createRatingFieldSchema())
  FormFieldPath.discriminator(
    BasicField.Attachment,
    createAttachmentFieldSchema(),
  )
  FormFieldPath.discriminator(BasicField.Dropdown, createDropdownFieldSchema())
  FormFieldPath.discriminator(BasicField.Radio, createRadioFieldSchema())
  FormFieldPath.discriminator(BasicField.Checkbox, createCheckboxFieldSchema())
  FormFieldPath.discriminator(
    BasicField.ShortText,
    createShortTextFieldSchema(),
  )
  FormFieldPath.discriminator(BasicField.HomeNo, createHomenoFieldSchema())
  FormFieldPath.discriminator(BasicField.Mobile, createMobileFieldSchema())
  FormFieldPath.discriminator(BasicField.LongText, createLongTextFieldSchema())
  FormFieldPath.discriminator(BasicField.Number, createNumberFieldSchema())
  FormFieldPath.discriminator(BasicField.Decimal, createDecimalFieldSchema())
  FormFieldPath.discriminator(BasicField.Image, createImageFieldSchema())
  FormFieldPath.discriminator(BasicField.Date, createDateFieldSchema())
  FormFieldPath.discriminator(BasicField.Nric, createNricFieldSchema())
  FormFieldPath.discriminator(BasicField.Uen, createUenFieldSchema())
  FormFieldPath.discriminator(BasicField.YesNo, createYesNoFieldSchema())
  FormFieldPath.discriminator(
    BasicField.Statement,
    createStatementFieldSchema(),
  )
  FormFieldPath.discriminator(BasicField.Section, createSectionFieldSchema())
  FormFieldPath.discriminator(BasicField.Table, TableFieldSchema)
  const TableColumnPath = TableFieldSchema.path(
    'columns',
  ) as Schema.Types.DocumentArray
  TableColumnPath.discriminator(
    BasicField.ShortText,
    createShortTextFieldSchema(),
  )
  TableColumnPath.discriminator(
    BasicField.Dropdown,
    createDropdownFieldSchema(),
  )

  // Discriminator defines all possible values of startPage.logo
  const StartPageLogoPath = FormSchema.path(
    'startPage.logo',
  ) as Schema.Types.DocumentArray
  StartPageLogoPath.discriminator(FormLogoState.Custom, CustomFormLogoSchema)

  // Discriminator defines different logic types
  const FormLogicPath = FormSchema.path(
    'form_logics',
  ) as Schema.Types.DocumentArray

  FormLogicPath.discriminator(LogicType.ShowFields, ShowFieldsLogicSchema)
  FormLogicPath.discriminator(LogicType.PreventSubmit, PreventSubmitLogicSchema)

  // Methods
  FormSchema.methods.getDashboardView = function (admin: IPopulatedUser) {
    return {
      _id: this._id,
      title: this.title,
      status: this.status,
      lastModified: this.lastModified,
      responseMode: this.responseMode,
      admin,
    }
  }

  // Method to return myInfo attributes
  FormSchema.methods.getUniqueMyInfoAttrs = function () {
    if (this.authType !== AuthType.MyInfo) {
      return []
    }

    // Compact is used to remove undefined from array
    return compact(uniq(this.form_fields?.map((field) => field.myInfo?.attr)))
  }

  // Return essential form creation parameters with the given properties
  FormSchema.methods.getDuplicateParams = function (
    overrideProps: OverrideProps,
  ) {
    const newForm = pick(this, [
      'form_fields',
      'form_logics',
      'startPage',
      'endPage',
      'authType',
      'inactiveMessage',
      'responseMode',
      'submissionLimit',
    ]) as PickDuplicateForm
    return { ...newForm, ...overrideProps }
  }

  // Archives form.
  FormSchema.methods.archive = function () {
    // Return instantly when form is already archived.
    if (this.status === Status.Archived) {
      return Promise.resolve(this)
    }

    this.status = Status.Archived
    return this.save()
  }

  const FormDocumentSchema = FormSchema as unknown as Schema<IFormDocument>

  FormDocumentSchema.methods.getSettings = function (): FormSettings {
    const formSettings =
      this.responseMode === ResponseMode.Encrypt
        ? (pick(this, STORAGE_FORM_SETTINGS_FIELDS) as StorageFormSettings)
        : (pick(this, EMAIL_FORM_SETTINGS_FIELDS) as EmailFormSettings)

    return formSettings
  }

  FormDocumentSchema.methods.getPublicView = function (): PublicForm {
    const basePublicView =
      this.responseMode === ResponseMode.Encrypt
        ? (pick(this, STORAGE_PUBLIC_FORM_FIELDS) as PublicForm)
        : (pick(this, EMAIL_PUBLIC_FORM_FIELDS) as PublicForm)

    // Return non-populated public fields of form if not populated.
    if (!this.populated('admin')) {
      return basePublicView
    }

    // Populated, return public view with user's public view.
    return {
      ...basePublicView,
      admin: (this.admin as IUserSchema).getPublicView(),
    }
  }

  // Transfer ownership of the form to another user
  FormDocumentSchema.methods.transferOwner = async function (
    currentOwner: IUserSchema,
    newOwner: IUserSchema,
  ) {
    // Update form's admin to new owner's id.
    this.admin = newOwner._id

    // Remove new owner from perm list and include previous owner as an editor.
    this.permissionList = this.permissionList.filter(
      (item) => item.email !== newOwner.email,
    )
    this.permissionList.push({ email: currentOwner.email, write: true })

    return this.save()
  }

  FormDocumentSchema.methods.updateFormCollaborators = async function (
    updatedPermissions: Permission[],
  ) {
    this.permissionList = updatedPermissions
    return this.save()
  }

  FormDocumentSchema.methods.updateFormFieldById = function (
    fieldId: string,
    newField: FormFieldWithId,
  ) {
    const fieldToUpdate = getFormFieldById(this.form_fields, fieldId)
    if (!fieldToUpdate) return Promise.resolve(null)

    if (fieldToUpdate.fieldType !== newField.fieldType) {
      this.invalidate('form_fields', 'Changing form field type is not allowed')
    } else {
      fieldToUpdate.set(newField)
    }

    return this.save()
  }

  FormDocumentSchema.methods.insertFormField = function (newField: FormField) {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;(this.form_fields as Types.DocumentArray<IFieldSchema>).push(newField)
    return this.save()
  }

  FormDocumentSchema.methods.duplicateFormFieldById = function (
    fieldId: string,
  ) {
    const fieldToDuplicate = getFormFieldById(this.form_fields, fieldId)
    if (!fieldToDuplicate) return Promise.resolve(null)
    const duplicatedField = omit(fieldToDuplicate, ['_id', 'globalId'])

    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;(this.form_fields as Types.DocumentArray<IFieldSchema>).push(
      duplicatedField,
    )
    return this.save()
  }

  FormDocumentSchema.methods.reorderFormFieldById = function (
    fieldId: string,
    newPosition: number,
  ): Promise<IFormDocument | null> {
    const existingFieldPosition = this.form_fields.findIndex(
      (f) => String(f._id) === fieldId,
    )

    if (existingFieldPosition === -1) return Promise.resolve(null)

    // Exist, reorder form fields and save.
    const updatedFormFields = reorder(
      this.form_fields,
      existingFieldPosition,
      newPosition,
    )
    this.form_fields = updatedFormFields
    return this.save()
  }

  // Statics
  // Method to retrieve data for OTP verification
  FormSchema.statics.getOtpData = async function (formId: string) {
    try {
      const data = await this.findById(formId, 'msgSrvcName admin').populate({
        path: 'admin',
        select: 'email',
      })
      return data
        ? ({
            form: data._id,
            formAdmin: {
              email: data.admin.email,
              userId: data.admin._id,
            },
            msgSrvcName: data.msgSrvcName,
          } as FormOtpData)
        : null
    } catch {
      return null
    }
  }

  // Returns the form with populated admin details
  FormSchema.statics.getFullFormById = async function (
    formId: string,
    fields?: (keyof IPopulatedForm)[],
  ): Promise<IPopulatedForm | null> {
    return this.findById(formId, fields).populate({
      path: 'admin',
      populate: {
        path: 'agency',
      },
    }) as Query<IPopulatedForm, IFormDocument>
  }

  // Deactivate form by ID
  FormSchema.statics.deactivateById = async function (
    formId: string,
  ): Promise<IFormSchema | null> {
    const form = await this.findById(formId)
    if (!form) return null
    if (form.status === Status.Public) {
      form.status = Status.Private
    }
    return form.save()
  }

  FormSchema.statics.getMetaByUserIdOrEmail = async function (
    userId: IUserSchema['_id'],
    userEmail: IUserSchema['email'],
  ): Promise<FormMetaView[]> {
    return (
      this.find()
        // List forms when either the user is an admin or collaborator.
        .or([{ 'permissionList.email': userEmail }, { admin: userId }])
        // Filter out archived forms.
        .where('status')
        .ne(Status.Archived)
        // Project selected fields.
        // `responseMode` is a discriminator key and is returned regardless,
        // selection is made for explicitness.
        // `_id` is also returned regardless and selection is made for
        // explicitness.
        .select('_id title admin lastModified status responseMode')
        .sort('-lastModified')
        .populate({
          path: 'admin',
          populate: {
            path: 'agency',
          },
        })
        .lean()
        .exec()
    )
  }

  // Deletes specified form logic.
  FormSchema.statics.deleteFormLogic = async function (
    formId: string,
    logicId: string,
  ): Promise<IFormSchema | null> {
    return this.findByIdAndUpdate(
      mongoose.Types.ObjectId(formId),
      {
        $pull: { form_logics: { _id: logicId } },
      },
      {
        new: true,
        runValidators: true,
      },
    ).exec()
  }

  // Creates specified form logic.
  FormSchema.statics.createFormLogic = async function (
    formId: string,
    createLogicBody: LogicDto,
  ): Promise<IFormSchema | null> {
    return this.findByIdAndUpdate(
      formId,
      { $push: { form_logics: createLogicBody } },
      {
        new: true,
        runValidators: true,
      },
    ).exec()
  }

  // Deletes specified form field by id.
  FormSchema.statics.deleteFormFieldById = async function (
    formId: string,
    fieldId: string,
  ): Promise<IFormSchema | null> {
    return this.findByIdAndUpdate(
      formId,
      { $pull: { form_fields: { _id: fieldId } } },
      { new: true, runValidators: true },
    ).exec()
  }

  // Updates specified form logic.
  FormSchema.statics.updateFormLogic = async function (
    formId: string,
    logicId: string,
    updatedLogic: LogicDto,
  ): Promise<IFormSchema | null> {
    return this.findByIdAndUpdate(
      formId,
      {
        $set: { 'form_logics.$[object]': updatedLogic },
      },
      {
        arrayFilters: [{ 'object._id': logicId }],
        new: true,
        runValidators: true,
      },
    ).exec()
  }

  FormSchema.statics.updateEndPageById = async function (
    formId: string,
    newEndPage: EndPage,
  ) {
    return this.findByIdAndUpdate(
      formId,
      { endPage: newEndPage },
      { new: true, runValidators: true },
    ).exec()
  }

  FormSchema.statics.updateStartPageById = async function (
    formId: string,
    newStartPage: StartPage,
  ) {
    return this.findByIdAndUpdate(
      formId,
      { startPage: newStartPage },
      { new: true, runValidators: true },
    ).exec()
  }

  // Hooks
  FormSchema.pre<IFormSchema>('validate', function (next) {
    // Reject save if form document is too large
    if (bson.calculateObjectSize(this) > 10 * MB) {
      const err = new Error('Form size exceeded.')
      err.name = 'FormSizeError'
      return next(err)
    }

    // Validate that admin exists before form is created.
    return User.findById(this.admin).then((admin) => {
      if (!admin) {
        const validationError = this.invalidate(
          'admin',
          'Admin for this form is not found.',
        ) as mongoose.Error.ValidationError
        return next(validationError)
      }

      // Remove admin from the permission list if they exist.
      // This prevents the form owner from being both an admin and another role.
      this.permissionList = this.permissionList?.filter(
        (item) => item.email !== admin.email,
      )

      return next()
    })
  })

  // Indexes
  // Provide an index to allow text search for form examples
  FormSchema.index({
    'startPage.paragraph': 'text',
    title: 'text',
  })

  FormSchema.index({
    'permissionList.email': 1,
    lastModified: -1,
  })

  FormSchema.index({
    admin: 1,
    lastModified: -1,
  })

  const FormModel = db.model<IFormSchema, IFormModel>(
    FORM_SCHEMA_ID,
    FormSchema,
  )

  // Adding form discriminators
  FormModel.discriminator(ResponseMode.Email, EmailFormSchema)
  FormModel.discriminator(ResponseMode.Encrypt, EncryptedFormSchema)

  return FormModel
}

const getFormModel = (db: Mongoose): IFormModel => {
  try {
    return db.model(FORM_SCHEMA_ID) as IFormModel
  } catch {
    return compileFormModel(db)
  }
}

export const getEmailFormModel = (db: Mongoose): IEmailFormModel => {
  // Load or build base model first
  getFormModel(db)
  return db.model(ResponseMode.Email) as IEmailFormModel
}

export const getEncryptedFormModel = (db: Mongoose): IEncryptedFormModel => {
  // Load or build base model first
  getFormModel(db)
  return db.model(ResponseMode.Encrypt) as IEncryptedFormModel
}

export default getFormModel
