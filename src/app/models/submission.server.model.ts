import moment from 'moment-timezone'
import mongoose, { Mongoose, QueryCursor, Schema } from 'mongoose'
import { FixedLengthArray } from 'type-fest'

import {
  AuthType,
  FindFormsWithSubsAboveResult,
  IEmailSubmissionModel,
  IEmailSubmissionSchema,
  IEncryptedSubmissionSchema,
  IEncryptSubmissionModel,
  IPopulatedWebhookSubmission,
  ISubmissionModel,
  ISubmissionSchema,
  IWebhookResponse,
  IWebhookResponseSchema,
  MyInfoAttribute,
  SubmissionCursorData,
  SubmissionData,
  SubmissionMetadata,
  SubmissionType,
  SubmissionWebhookInfo,
  WebhookData,
  WebhookView,
} from '../../types'
import { createQueryWithDateParam } from '../utils/date'

import { FORM_SCHEMA_ID } from './form.server.model'

export const SUBMISSION_SCHEMA_ID = 'Submission'

const SubmissionSchema = new Schema<ISubmissionSchema, ISubmissionModel>(
  {
    form: {
      type: Schema.Types.ObjectId,
      ref: FORM_SCHEMA_ID,
      required: true,
    },
    authType: {
      type: String,
      enum: Object.values(AuthType),
      default: AuthType.NIL,
    },
    myInfoFields: {
      type: [
        {
          type: String,
          trim: true,
          enum: Object.values(MyInfoAttribute),
        },
      ],
    },
    submissionType: {
      type: String,
      enum: Object.values(SubmissionType),
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created',
      updatedAt: 'lastModified',
    },
    discriminatorKey: 'submissionType',
    read: 'secondary',
  },
)

SubmissionSchema.index({
  form: 1,
  submissionType: 1,
  created: -1,
})

// Base schema static methods
SubmissionSchema.statics.findFormsWithSubsAbove = function (
  minSubCount: number,
): Promise<FindFormsWithSubsAboveResult[]> {
  return this.aggregate<FindFormsWithSubsAboveResult>([
    {
      $group: {
        _id: '$form',
        count: { $sum: 1 },
      },
    },
    {
      $match: {
        count: {
          $gt: minSubCount,
        },
      },
    },
  ]).exec()
}

const EmailSubmissionSchema = new Schema<IEmailSubmissionSchema>({
  recipientEmails: {
    type: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  responseHash: {
    type: String,
    trim: true,
    required: true,
  },
  responseSalt: {
    type: String,
    trim: true,
    required: true,
  },
  hasBounced: {
    type: Boolean,
    default: false,
  },
})

// EmailSubmission Instance methods
/**
 * Returns null as email submission does not have a webhook view
 */
EmailSubmissionSchema.methods.getWebhookView = function (): null {
  return null
}

const webhookResponseSchema = new Schema<IWebhookResponseSchema>(
  {
    webhookUrl: {
      type: String,
      required: true,
    },
    signature: {
      type: String,
      required: true,
    },
    response: {
      status: {
        type: Number,
        required: true,
      },
      headers: String,
      data: String,
    },
  },
  {
    timestamps: {
      createdAt: 'created',
      updatedAt: false,
    },
  },
)

const EncryptSubmissionSchema = new Schema<
  IEncryptedSubmissionSchema,
  IEncryptSubmissionModel
>({
  encryptedContent: {
    type: String,
    trim: true,
    required: true,
  },
  verifiedContent: {
    type: String,
    trim: true,
  },
  attachmentMetadata: {
    type: Map,
    of: String,
  },
  version: {
    type: Number,
    required: true,
  },
  webhookResponses: [webhookResponseSchema],
})

/**
 * Returns an object which represents the encrypted submission
 * which will be posted to the webhook URL.
 */
EncryptSubmissionSchema.methods.getWebhookView = function (
  this: IEncryptedSubmissionSchema | IPopulatedWebhookSubmission,
): WebhookView {
  const formId = this.populated('form')
    ? String((this as IPopulatedWebhookSubmission).form._id)
    : String(this.form)
  const attachmentRecords = Object.fromEntries(
    this.attachmentMetadata ?? new Map(),
  )

  const webhookData: WebhookData = {
    formId,
    submissionId: String(this._id),
    encryptedContent: this.encryptedContent,
    verifiedContent: this.verifiedContent,
    version: this.version,
    created: this.created,
    attachmentDownloadUrls: attachmentRecords,
  }

  return {
    data: webhookData,
  }
}

EncryptSubmissionSchema.statics.addWebhookResponse = function (
  submissionId: string,
  webhookResponse: IWebhookResponse,
): Promise<IEncryptedSubmissionSchema | null> {
  return this.findByIdAndUpdate(
    submissionId,
    { $push: { webhookResponses: webhookResponse } },
    { new: true, setDefaultsOnInsert: true, runValidators: true },
  ).exec()
}

EncryptSubmissionSchema.statics.retrieveWebhookInfoById = function (
  this: IEncryptSubmissionModel,
  submissionId: string,
): Promise<SubmissionWebhookInfo | null> {
  return this.findById(submissionId)
    .populate('form', 'webhook')
    .then((populatedSubmission: IPopulatedWebhookSubmission | null) => {
      if (!populatedSubmission) return null
      return {
        webhookUrl: populatedSubmission.form.webhook?.url ?? '',
        isRetryEnabled: !!populatedSubmission.form.webhook?.isRetryEnabled,
        webhookView: populatedSubmission.getWebhookView(),
      }
    })
}

EncryptSubmissionSchema.statics.findSingleMetadata = function (
  formId: string,
  submissionId: string,
): Promise<SubmissionMetadata | null> {
  return (
    this.findOne(
      {
        form: formId,
        _id: submissionId,
        submissionType: SubmissionType.Encrypt,
      },
      { created: 1 },
    )
      // Reading from primary to avoid any contention issues with bulk queries
      // on secondary servers.
      .read('primary')
      .then((result) => {
        if (!result) {
          return null
        }

        // Build submissionMetadata object.
        const metadata: SubmissionMetadata = {
          number: 1,
          refNo: result._id,
          submissionTime: moment(result.created)
            .tz('Asia/Singapore')
            .format('Do MMM YYYY, h:mm:ss a'),
        }

        return metadata
      })
  )
}

/**
 * Unexported as the type is only used in {@see findAllMetadataByFormId} for
 * now.
 */
type MetadataAggregateResult = {
  pageResults: Pick<ISubmissionSchema, '_id' | 'created'>[]
  allResults: FixedLengthArray<{ count: number }, 1> | []
}

EncryptSubmissionSchema.statics.findAllMetadataByFormId = function (
  formId: string,
  {
    page = 1,
    pageSize = 10,
  }: {
    page?: number
    pageSize?: number
  } = {},
): Promise<{
  metadata: SubmissionMetadata[]
  count: number
}> {
  const numToSkip = (page - 1) * pageSize

  return (
    this.aggregate()
      .match({
        // Casting to ObjectId as Mongoose does not cast pipeline stages.
        // See https://mongoosejs.com/docs/api.html#aggregate_Aggregate.
        form: mongoose.Types.ObjectId(formId),
        submissionType: SubmissionType.Encrypt,
      })
      .sort({ created: -1 })
      .facet({
        pageResults: [
          { $skip: numToSkip },
          { $limit: pageSize },
          { $project: { _id: 1, created: 1 } },
        ],
        allResults: [
          { $group: { _id: null, count: { $sum: 1 } } },
          { $project: { _id: 0 } },
        ],
      })
      // prevents out-of-memory for large search results (max 100MB).
      .allowDiskUse(true)
      .then((result: MetadataAggregateResult[]) => {
        const [{ pageResults, allResults }] = result
        const [numResults] = allResults
        const count = numResults?.count ?? 0

        let currentNumber = count - numToSkip

        const metadata = pageResults.map((data) => {
          const metadataEntry: SubmissionMetadata = {
            number: currentNumber,
            refNo: data._id,
            submissionTime: moment(data.created)
              .tz('Asia/Singapore')
              .format('Do MMM YYYY, h:mm:ss a'),
          }

          currentNumber--
          return metadataEntry
        })

        return {
          metadata,
          count,
        }
      })
  )
}

EncryptSubmissionSchema.statics.getSubmissionCursorByFormId = function (
  formId: string,
  dateRange: {
    startDate?: string
    endDate?: string
  } = {},
): QueryCursor<SubmissionCursorData> {
  const streamQuery = {
    form: formId,
    ...createQueryWithDateParam(dateRange?.startDate, dateRange?.endDate),
  }
  return (
    this.find(streamQuery)
      .select({
        encryptedContent: 1,
        verifiedContent: 1,
        attachmentMetadata: 1,
        created: 1,
        version: 1,
        id: 1,
      })
      .batchSize(2000)
      .read('secondary')
      .lean()
      // Override typing as Map is converted to Object once passed through `lean()`.
      .cursor() as QueryCursor<SubmissionCursorData>
  )
}

EncryptSubmissionSchema.statics.findEncryptedSubmissionById = function (
  formId: string,
  submissionId: string,
): Promise<SubmissionData | null> {
  return this.findOne({
    _id: submissionId,
    form: formId,
    submissionType: SubmissionType.Encrypt,
  })
    .select({
      encryptedContent: 1,
      verifiedContent: 1,
      attachmentMetadata: 1,
      created: 1,
      version: 1,
    })
    .exec()
}

const compileSubmissionModel = (db: Mongoose): ISubmissionModel => {
  const Submission = db.model('Submission', SubmissionSchema)
  Submission.discriminator(SubmissionType.Email, EmailSubmissionSchema)
  Submission.discriminator(SubmissionType.Encrypt, EncryptSubmissionSchema)
  return db.model<ISubmissionSchema, ISubmissionModel>(
    SUBMISSION_SCHEMA_ID,
    SubmissionSchema,
  )
}

const getSubmissionModel = (db: Mongoose): ISubmissionModel => {
  try {
    return db.model<ISubmissionSchema, ISubmissionModel>(SUBMISSION_SCHEMA_ID)
  } catch {
    return compileSubmissionModel(db)
  }
}

export const getEmailSubmissionModel = (
  db: Mongoose,
): IEmailSubmissionModel => {
  getSubmissionModel(db)
  return db.model(SubmissionType.Email) as IEmailSubmissionModel
}

export const getEncryptSubmissionModel = (
  db: Mongoose,
): IEncryptSubmissionModel => {
  getSubmissionModel(db)
  return db.model(SubmissionType.Encrypt) as IEncryptSubmissionModel
}

export default getSubmissionModel
