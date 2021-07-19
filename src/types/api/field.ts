import { EditFieldActions } from '../../shared/constants'
import { FormFieldSchema } from '../field'

export type EditFormFieldParams = {
  field: FormFieldSchema
} & (
  | {
      action: {
        name: Exclude<EditFieldActions, EditFieldActions.Reorder>
      }
    }
  | {
      action: {
        name: EditFieldActions.Reorder
        position: number
      }
    }
)
