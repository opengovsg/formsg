import { parsePhoneNumberFromString } from 'libphonenumber-js/mobile'
import { Model, Mongoose, Schema } from 'mongoose'
import validator from 'validator'

import { IUserSchema } from '../../types'

import getAgencyModel, { AGENCY_SCHEMA_ID } from './agency.server.model'

export const USER_SCHEMA_ID = 'User'

export interface IUserModel extends Model<IUserSchema> {}

const compileUserModel = (db: Mongoose) => {
  const Agency = getAgencyModel(db)

  const UserSchema = new Schema<IUserSchema>({
    email: {
      type: String,
      trim: true,
      unique: true,
      required: 'Please enter your email',
      validate: {
        // Check if email entered exists in the Agency collection
        validator: async (value: string) => {
          if (!validator.isEmail(value)) {
            return false
          }

          const emailDomain = value.split('@').pop()
          try {
            const agency = await Agency.findOne({ emailDomain })
            return !!agency
          } catch {
            return false
          }
        },
        message: 'This email is not a valid agency email',
      },
    },
    agency: {
      type: Schema.Types.ObjectId,
      ref: AGENCY_SCHEMA_ID,
      required: 'Agency is required',
    },
    created: {
      type: Date,
      default: Date.now,
    },
    contact: {
      type: String,
      validate: {
        // Check if phone number is valid.
        validator: function (value: string) {
          const phoneNumber = parsePhoneNumberFromString(value)
          if (!phoneNumber) return false
          return phoneNumber.isValid()
        },
        message: (props) => `${props.value} is not a valid mobile number`,
      },
    },
    betaFlags: {},
  })

  // Hooks
  /**
   * Unique key violation custom error middleware.
   *
   * Used because the `unique` schema option is not a validator, and will not
   * throw a ValidationError. Instead, another error will be thrown, which will
   * have to be caught here to output the expected error message.
   *
   * See: https://masteringjs.io/tutorials/mongoose/e11000-duplicate-key.
   */
  UserSchema.post<IUserSchema>('save', function (err, doc, next) {
    if (err.name === 'MongoError' && err.code === 11000) {
      next(new Error('Account already exists with this email'))
    } else {
      next()
    }
  })

  return db.model<IUserSchema>(USER_SCHEMA_ID, UserSchema)
}

/**
 * Retrieves the User model on the given Mongoose instance. If the model is
 * not registered yet, the model will be registered and returned.
 * @param db The mongoose instance to retrieve the User model from
 * @returns The User model
 */
const getUserModel = (db: Mongoose) => {
  try {
    return db.model(USER_SCHEMA_ID) as IUserModel
  } catch {
    return compileUserModel(db)
  }
}

export default getUserModel
