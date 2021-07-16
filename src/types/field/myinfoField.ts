import { LeanDocument } from 'mongoose'

import { FormFieldSchema } from '../field'

export type IPossiblyPrefilledField = LeanDocument<FormFieldSchema> & {
  fieldValue?: string
}
