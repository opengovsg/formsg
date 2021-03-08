import { isEmpty } from 'lodash'
import { Schema } from 'mongoose'

import { validateEmailDomains } from '../../../shared/util/email-domain-validation'
import { IEmailFieldSchema, ResponseMode } from '../../../types'

const validateAllowDomainsToBeSet = (
  emailDomains: string[],
  hasAllowedEmailDomains: boolean,
): boolean => {
  // Case 1: hasAllowedEmailDomains is false and emailDomains must be empty.
  const case1 = !hasAllowedEmailDomains && isEmpty(emailDomains)
  // Case 2: hasAllowedEmailDomains is true and email domains must not be empty.
  const case2 = hasAllowedEmailDomains && !isEmpty(emailDomains)

  return case1 || case2
}

const createEmailFieldSchema = (): Schema<IEmailFieldSchema> => {
  const EmailFieldSchema = new Schema<IEmailFieldSchema>({
    autoReplyOptions: {
      hasAutoReply: {
        type: Boolean,
        default: false,
      },
      autoReplySubject: {
        type: String,
        trim: true,
        default: '',
      },
      autoReplySender: {
        type: String,
        trim: true,
        default: '',
        match: [/^[^:]+$/, 'Please do not include : in sender name'],
      },
      autoReplyMessage: {
        type: String,
        trim: true,
        default: '',
      },
      includeFormSummary: {
        type: Boolean,
        default: false,
        set: function (this: IEmailFieldSchema, v: boolean) {
          // PDF response not allowed for encrypt forms
          return this.parent().responseMode === ResponseMode.Encrypt ? false : v
        },
      },
    },

    isVerifiable: {
      type: Boolean,
      default: false,
    },
    hasAllowedEmailDomains: {
      type: Boolean,
      default: false,
    },
    allowedEmailDomains: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      // If allowedEmailDomains is empty, then all email domains should be allowed.
      default: [],
      validate: [
        {
          validator: function (emailDomains: string[]) {
            return validateEmailDomains(emailDomains)
          },
          message: 'There are one or more duplicate or invalid email domains.',
        },
        {
          validator: function (
            this: IEmailFieldSchema,
            emailDomains: string[],
          ) {
            return validateAllowDomainsToBeSet(
              emailDomains,
              this.hasAllowedEmailDomains,
            )
          },
          message:
            'Given email domains should not be empty when allowed email domains option is toggled on',
        },
      ],
    },
  })

  // PDF response not allowed if autoreply is set in encrypted forms. If
  // autoreply is not set, then we don't care whether the pdf is set.
  EmailFieldSchema.pre<IEmailFieldSchema>('validate', function (next) {
    if (this.parent().responseMode === ResponseMode.Encrypt) {
      const { hasAutoReply, includeFormSummary } = this.autoReplyOptions || {}
      if (hasAutoReply && includeFormSummary) {
        return next(
          Error('Autoreply PDF is not allowed for storage mode forms'),
        )
      }
    }

    return next()
  })

  // If hasAllowedEmailDomains is false, then clear allowedEmailDomains
  EmailFieldSchema.pre<IEmailFieldSchema>('validate', function (next) {
    if (!this.hasAllowedEmailDomains) {
      this.allowedEmailDomains = []
    }

    return next()
  })

  return EmailFieldSchema
}

export default createEmailFieldSchema
