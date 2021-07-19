import { Schema } from 'mongoose'

import {
  INumberFieldSchema,
  NumberSelectedValidation,
  NumberValidationOptions,
} from '../../../types'
import { WithCustomMinMax } from '../../../types/field/utils/virtuals'

import { MyInfoSchema } from './baseField'

const createNumberFieldSchema = () => {
  const ValidationOptionsSchema = new Schema<
    WithCustomMinMax<NumberValidationOptions>
  >(
    {
      customVal: {
        type: Number,
      },
      rangeMax: {
        type: Number,
        default: null,
      },
      rangeMin: {
        type: Number,
        default: null,
      },
      selectedValidation: {
        type: String,
        enum: [...Object.values(NumberSelectedValidation), null],
      },
    },
    {
      // TODO: Remove virtuals (#2039)
      toJSON: {
        virtuals: true,
      },
    },
  )

  // Virtuals to allow for backwards compatibility after customMin and customMax were removed as part of #408
  // TODO: Remove virtuals (#2039)
  ValidationOptionsSchema.virtual('customMin').get(function (
    this: NumberValidationOptions,
  ) {
    return this.customVal
  })

  ValidationOptionsSchema.virtual('customMax').get(function (
    this: NumberValidationOptions,
  ) {
    return this.customVal
  })

  const NumberFieldSchema = new Schema<INumberFieldSchema>({
    myInfo: MyInfoSchema,
    ValidationOptions: {
      type: ValidationOptionsSchema,
      default: {
        // Defaults are defined here because subdocument paths are undefined by default, and Mongoose does not apply subdocument defaults unless you set the subdocument path to a non-nullish value (see https://mongoosejs.com/docs/subdocs.html)
        customVal: null,
        selectedValidation: null,
      },
    },
  })

  return NumberFieldSchema
}
export default createNumberFieldSchema
