import { left } from 'fp-ts/lib/Either'

import { BasicField, FieldValidationSchema } from '../../../types'
import { ResponseValidator } from '../../../types/field/utils/validation'
import {
  ProcessedAttachmentResponse,
  ProcessedCheckboxResponse,
  ProcessedSingleAnswerResponse,
  ProcessedTableResponse,
} from '../../modules/submission/submission.types'

import { constructAttachmentValidator } from './validators/attachmentValidator'
import { constructCheckboxValidator } from './validators/checkboxValidator'
import { constructDateValidator } from './validators/dateValidator'
import { constructDecimalValidator } from './validators/decimalValidator'
import { constructDropdownValidator } from './validators/dropdownValidator'
import { constructEmailValidator } from './validators/emailValidator'
import { constructHomeNoValidator } from './validators/homeNoValidator'
import { constructMobileNoValidator } from './validators/mobileNoValidator'
import { constructNricValidator } from './validators/nricValidator'
import { constructNumberValidator } from './validators/numberValidator'
import { constructRadioButtonValidator } from './validators/radioButtonValidator'
import { constructRatingValidator } from './validators/ratingValidator'
import { constructSectionValidator } from './validators/sectionValidator'
import { constructTableValidator } from './validators/tableValidator'
import constructTextValidator from './validators/textValidator'
import { constructUenValidator } from './validators/uenValidator'
import { constructYesNoValidator } from './validators/yesNoValidator'

/**
 * Constructs a validation function for a single answer response, using a form field field as a specification.
 * @param formField A form field from a form object
 */
export const constructSingleAnswerValidator = (
  formField: FieldValidationSchema,
): ResponseValidator<ProcessedSingleAnswerResponse> => {
  switch (formField.fieldType) {
    case BasicField.Section:
      return constructSectionValidator()
    case BasicField.ShortText:
    case BasicField.LongText:
      return constructTextValidator(formField)
    case BasicField.Nric:
      return constructNricValidator()
    case BasicField.HomeNo:
      return constructHomeNoValidator(formField)
    case BasicField.Radio:
      return constructRadioButtonValidator(formField)
    case BasicField.Rating:
      return constructRatingValidator(formField)
    case BasicField.Mobile:
      return constructMobileNoValidator(formField)
    case BasicField.Date:
      return constructDateValidator(formField)
    case BasicField.Number:
      return constructNumberValidator(formField)
    case BasicField.Decimal:
      return constructDecimalValidator(formField)
    case BasicField.Dropdown:
      return constructDropdownValidator(formField)
    case BasicField.Email:
      return constructEmailValidator(formField)
    case BasicField.Uen:
      return constructUenValidator()
    case BasicField.YesNo:
      return constructYesNoValidator()
    default:
      return () => left('Unsupported field type')
  }
}

export const constructAttachmentFieldValidator = (
  // Separate from constructSingleAnswerValidator as
  // constructAttachmentValidator returns different type
  formField: FieldValidationSchema,
): ResponseValidator<ProcessedAttachmentResponse> => {
  if (formField.fieldType === BasicField.Attachment) {
    return constructAttachmentValidator(formField)
  }
  return () => left('Unsupported field type')
}

export const constructCheckboxFieldValidator = (
  formField: FieldValidationSchema,
): ResponseValidator<ProcessedCheckboxResponse> => {
  if (formField.fieldType === BasicField.Checkbox) {
    return constructCheckboxValidator(formField)
  }
  return () => left('Unsupported field type')
}

export const constructTableFieldValidator = (
  formField: FieldValidationSchema,
): ResponseValidator<ProcessedTableResponse> => {
  if (formField.fieldType === BasicField.Table) {
    return constructTableValidator(formField)
  }
  return () => left('Unsupported field type')
}
