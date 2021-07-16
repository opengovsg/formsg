import { ObjectId } from 'bson-ext'

import {
  BasicField,
  FieldSchemaOrResponse,
  ICheckboxFieldSchema,
} from '../../../../types'
import { transformCheckboxForLogic } from '../checkbox/checkbox-response-value-transformer'

describe('transformCheckboxForLogic', () => {
  describe('Frontend Checkbox value with others option', () => {
    const OPTIONS = ['Option 1', 'Option 2', 'Option 3']
    const CHECKBOX_FIELD = {
      _id: new ObjectId(),
      fieldOptions: OPTIONS,
      othersRadioButton: true,
      fieldType: BasicField.Checkbox,
    } as ICheckboxFieldSchema
    it('should correctly convert frontend checkbox response without others selected to its logic representation', () => {
      // Arrange
      const frontendCheckbox = {
        _id: String(CHECKBOX_FIELD._id),
        fieldValue: [true, false, true, false],
        fieldType: BasicField.Checkbox,
      } as FieldSchemaOrResponse
      const formFields = [CHECKBOX_FIELD]

      const expected = {
        ...frontendCheckbox,
        fieldValue: {
          options: [OPTIONS[0], OPTIONS[2]],
          others: false,
        },
      }

      // Act
      const transformedCheckbox = transformCheckboxForLogic(
        frontendCheckbox,
        formFields,
      )

      // Assert
      expect(transformedCheckbox).toEqual(expected)
    })
    it('should correctly convert frontend checkbox response with others selected to its logic representation', () => {
      // Arrange
      const frontendCheckbox = {
        _id: String(CHECKBOX_FIELD._id),
        fieldValue: [true, false, true, true],
        fieldType: BasicField.Checkbox,
      } as FieldSchemaOrResponse
      const formFields = [CHECKBOX_FIELD]

      const expected = {
        ...frontendCheckbox,
        fieldValue: {
          options: [OPTIONS[0], OPTIONS[2]],
          others: true,
        },
      }

      // Act
      const transformedCheckbox = transformCheckboxForLogic(
        frontendCheckbox,
        formFields,
      )

      // Assert
      expect(transformedCheckbox).toEqual(expected)
    })
  })
  describe('Frontend Checkbox value without others option', () => {
    const OPTIONS = ['Option 1', 'Option 2', 'Option 3']
    const CHECKBOX_FIELD = {
      _id: new ObjectId(),
      fieldOptions: OPTIONS,
      othersRadioButton: false,
      fieldType: BasicField.Checkbox,
    } as ICheckboxFieldSchema
    it('should correctly convert frontend checkbox response without others selected to its logic representation', () => {
      // Arrange
      const frontendCheckbox = {
        _id: String(CHECKBOX_FIELD._id),
        fieldValue: [true, false, true, false],
        fieldType: BasicField.Checkbox,
      } as FieldSchemaOrResponse
      const formFields = [CHECKBOX_FIELD]

      const expected = {
        ...frontendCheckbox,
        fieldValue: {
          options: [OPTIONS[0], OPTIONS[2]],
          others: false,
        },
      }

      // Act
      const transformedCheckbox = transformCheckboxForLogic(
        frontendCheckbox,
        formFields,
      )

      // Assert
      expect(transformedCheckbox).toEqual(expected)
    })
  })
  describe('Backend Checkbox value with others option', () => {
    const OPTIONS = ['Option 1', 'Others: this is a user-defined option']
    const OTHERS_RESPONSE = 'Others: this is a user input'
    const CHECKBOX_FIELD = {
      _id: new ObjectId(),
      fieldOptions: OPTIONS,
      othersRadioButton: true,
      fieldType: BasicField.Checkbox,
    } as ICheckboxFieldSchema
    it('should correctly convert backend checkbox response without others selected to its logic representation', () => {
      // Arrange
      const backendCheckbox = {
        _id: String(CHECKBOX_FIELD._id),
        answerArray: [OPTIONS[0], OPTIONS[1]],
        fieldType: BasicField.Checkbox,
      } as FieldSchemaOrResponse
      const formFields = [CHECKBOX_FIELD]

      const expected = {
        ...backendCheckbox,
        answerArray: {
          options: [OPTIONS[0], OPTIONS[1]],
          others: false,
        },
      }

      // Act
      const transformedCheckbox = transformCheckboxForLogic(
        backendCheckbox,
        formFields,
      )

      // Assert
      expect(transformedCheckbox).toEqual(expected)
    })
    it('should correctly convert backend checkbox response with others selected to its logic representation', () => {
      // Arrange
      const backendCheckbox = {
        _id: String(CHECKBOX_FIELD._id),
        answerArray: [OPTIONS[0], OPTIONS[1], OTHERS_RESPONSE],
        fieldType: BasicField.Checkbox,
      } as FieldSchemaOrResponse
      const formFields = [CHECKBOX_FIELD]

      const expected = {
        ...backendCheckbox,
        answerArray: {
          options: [OPTIONS[0], OPTIONS[1]],
          others: true,
        },
      }

      // Act
      const transformedCheckbox = transformCheckboxForLogic(
        backendCheckbox,
        formFields,
      )

      // Assert
      expect(transformedCheckbox).toEqual(expected)
    })
  })
  describe('Backend Checkbox value without others option', () => {
    const OPTIONS = ['Option 1', 'Others: this is a user-defined option']
    const CHECKBOX_FIELD = {
      _id: new ObjectId(),
      fieldOptions: OPTIONS,
      othersRadioButton: false,
      fieldType: BasicField.Checkbox,
    } as ICheckboxFieldSchema
    it('should correctly convert backend checkbox response without others selected to its logic representation', () => {
      // Arrange
      const backendCheckbox = {
        _id: String(CHECKBOX_FIELD._id),
        answerArray: [OPTIONS[0], OPTIONS[1]],
        fieldType: BasicField.Checkbox,
      } as FieldSchemaOrResponse
      const formFields = [CHECKBOX_FIELD]

      const expected = {
        ...backendCheckbox,
        answerArray: {
          options: [OPTIONS[0], OPTIONS[1]],
          others: false,
        },
      }

      // Act
      const transformedCheckbox = transformCheckboxForLogic(
        backendCheckbox,
        formFields,
      )

      // Assert
      expect(transformedCheckbox).toEqual(expected)
    })
  })
})
