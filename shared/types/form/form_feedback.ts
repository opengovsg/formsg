import { DateString } from '../generic'
import { FormDto } from './form'

export type SubmitFormFeedbackBodyDto = {
  isPreview?: boolean
  rating: number
  comment?: string
}

/**
 * Typing for individual form feedback
 */
export type FormFeedbackBase = {
  rating: number
  comment?: string
  formId: FormDto['_id']
  created?: DateString
  lastModified?: DateString
}
export type FormFeedbackDto = FormFeedbackBase

export type ProcessedFeedbackMeta = {
  index: number
  timestamp: number
  rating: number
  comment: string
  // Note that this date is not a DateString, it is actually "D MMM YYYY"
  // format.
  date: string
  dateShort: string
}

export type FormFeedbackMetaDto = {
  average?: string
  count: number
  feedback: ProcessedFeedbackMeta[]
}
