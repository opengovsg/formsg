import { Schema } from 'mongoose'

import {
  TextSelectedValidation,
  TextValidationOptions,
} from '../../../../types/field'
import { WithCustomMinMax } from '../../../../types/field/utils/virtuals'

export const TextValidationOptionsSchema = new Schema<
  WithCustomMinMax<TextValidationOptions>
>(
  {
    customVal: {
      type: Number,
    },
    selectedValidation: {
      type: String,
      enum: [...Object.values(TextSelectedValidation), null],
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
TextValidationOptionsSchema.virtual('customMin').get(function (
  this: TextValidationOptions,
) {
  return this.customVal
})

TextValidationOptionsSchema.virtual('customMax').get(function (
  this: TextValidationOptions,
) {
  return this.customVal
})
