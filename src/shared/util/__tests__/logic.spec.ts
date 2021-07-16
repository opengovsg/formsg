import { ObjectId } from 'bson-ext'

import {
  getApplicableIfFields,
  getApplicableIfStates,
  getLogicUnitPreventingSubmit,
  getVisibleFieldIds,
} from 'src/shared/util/logic'
import {
  BasicField,
  FieldResponse,
  IField,
  IFieldSchema,
  IFormDocument,
  IPreventSubmitLogicSchema,
  IRadioFieldSchema,
  IShortTextFieldSchema,
  IShowFieldsLogicSchema,
  LogicConditionState,
  LogicIfValue,
  LogicType,
} from 'src/types'

describe('Logic validation', () => {
  /** Mock a field's bare essentials */
  const makeField = (fieldId: string) => ({ _id: fieldId } as IFieldSchema)
  /**
   *  Mock a response
   * @param fieldId field id of the field that this response is meant for
   * @param answer
   * @param answerArray array of answers passed in for checkbox and table
   * @param isVisible whether field is visible
   */
  const makeResponse = (
    fieldId: string,
    answer: string | number,
    answerArray: string[] | null = null,
    isVisible = true,
  ): FieldResponse => {
    const response: Record<string, any> = { _id: fieldId, answer, isVisible }
    if (answer !== null) {
      response.answer = answer
    }
    if (answerArray) {
      response.answerArray = answerArray
    }
    return response as FieldResponse
  }

  describe('visibility for different states', () => {
    const CONDITION_FIELD = makeField(new ObjectId().toHexString())
    const LOGIC_FIELD = makeField(new ObjectId().toHexString())
    const LOGIC_RESPONSE = makeResponse(LOGIC_FIELD._id, 'lorem')
    const MOCK_LOGIC_ID = new ObjectId().toHexString()

    let form: IFormDocument

    beforeEach(() => {
      form = {
        _id: new ObjectId(),
        form_fields: [CONDITION_FIELD, LOGIC_FIELD],
      } as IFormDocument
    })

    it('should compute the correct visibility for "is equals to"', () => {
      // Arrange
      const equalsCondition = {
        show: [LOGIC_FIELD._id],
        conditions: [
          {
            ifValueType: LogicIfValue.Number,
            _id: '58169',
            field: CONDITION_FIELD._id,
            state: LogicConditionState.Equal,
            value: 0,
          },
        ],
        _id: MOCK_LOGIC_ID,
        logicType: LogicType.ShowFields,
      } as IShowFieldsLogicSchema

      form.form_logics = [equalsCondition]

      // Act + Assert
      expect(
        getVisibleFieldIds(
          [makeResponse(CONDITION_FIELD._id, 0), LOGIC_RESPONSE],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(true)

      expect(
        getVisibleFieldIds(
          [makeResponse(CONDITION_FIELD._id, 1), LOGIC_RESPONSE],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(false)
    })

    it('should compute the correct visibility for "is less than or equal to"', () => {
      // Arrange
      const lteCondition = {
        show: [LOGIC_FIELD._id],
        conditions: [
          {
            ifValueType: LogicIfValue.Number,
            _id: '58169',
            field: CONDITION_FIELD._id,
            state: LogicConditionState.Lte,
            value: 99,
          },
        ],
        _id: MOCK_LOGIC_ID,
        logicType: LogicType.ShowFields,
      } as IShowFieldsLogicSchema

      form.form_logics = [lteCondition]

      // Act + Assert
      expect(
        getVisibleFieldIds(
          [makeResponse(CONDITION_FIELD._id, 98), LOGIC_RESPONSE],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(true)

      expect(
        getVisibleFieldIds(
          [makeResponse(CONDITION_FIELD._id, 99), LOGIC_RESPONSE],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(true)

      expect(
        getVisibleFieldIds(
          [makeResponse(CONDITION_FIELD._id, 100), LOGIC_RESPONSE],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(false)
    })

    it('should compute the correct visibility for "is more than or equal to"', () => {
      // Arrange
      const gteCondition = {
        show: [LOGIC_FIELD._id],
        conditions: [
          {
            ifValueType: LogicIfValue.Number,
            _id: '58169',
            field: CONDITION_FIELD._id,
            state: LogicConditionState.Gte,
            value: 22,
          },
        ],
        _id: MOCK_LOGIC_ID,
        logicType: LogicType.ShowFields,
      } as IShowFieldsLogicSchema
      form.form_logics = [gteCondition]

      // Act + Assert
      expect(
        getVisibleFieldIds(
          [makeResponse(CONDITION_FIELD._id, 23), LOGIC_RESPONSE],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(true)
      expect(
        getVisibleFieldIds(
          [makeResponse(CONDITION_FIELD._id, 22), LOGIC_RESPONSE],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(true)
      expect(
        getVisibleFieldIds(
          [makeResponse(CONDITION_FIELD._id, 21), LOGIC_RESPONSE],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(false)
    })

    it('should compute the correct visibility for "is either"', () => {
      // Arrange
      const validOptions = ['Option 1', 'Option 2']
      const eitherCondition = {
        show: [LOGIC_FIELD._id],
        conditions: [
          {
            ifValueType: LogicIfValue.MultiSelect,
            _id: '58169',
            field: CONDITION_FIELD._id,
            state: LogicConditionState.Either,
            value: validOptions,
          },
        ],
        _id: MOCK_LOGIC_ID,
        logicType: LogicType.ShowFields,
      } as IShowFieldsLogicSchema

      form.form_logics = [eitherCondition]

      // Act + Assert
      expect(
        getVisibleFieldIds(
          [makeResponse(CONDITION_FIELD._id, validOptions[0]), LOGIC_RESPONSE],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(true)

      expect(
        getVisibleFieldIds(
          [makeResponse(CONDITION_FIELD._id, validOptions[1]), LOGIC_RESPONSE],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(true)

      expect(
        getVisibleFieldIds(
          [makeResponse(CONDITION_FIELD._id, 'invalid option'), LOGIC_RESPONSE],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(false)
    })
  })

  describe('preventing submission for different states', () => {
    const CONDITION_FIELD = makeField(new ObjectId().toHexString())
    const LOGIC_FIELD = makeField(new ObjectId().toHexString())
    const LOGIC_RESPONSE = makeResponse(LOGIC_FIELD._id, 'lorem')
    const MOCK_LOGIC_ID = new ObjectId().toHexString()

    let form: IFormDocument

    beforeEach(() => {
      form = {
        _id: new ObjectId(),
        form_fields: [CONDITION_FIELD, LOGIC_FIELD],
      } as IFormDocument
    })

    it('should compute that submission should be prevented for "is equals to"', () => {
      // Arrange
      const equalCondition = {
        conditions: [
          {
            ifValueType: LogicIfValue.Number,
            _id: '58169',
            field: CONDITION_FIELD._id,
            state: LogicConditionState.Equal,
            value: 0,
          },
        ],
        _id: MOCK_LOGIC_ID,
        logicType: LogicType.PreventSubmit,
        preventSubmitMessage: "oh no you don't",
      } as IPreventSubmitLogicSchema

      form.form_logics = [equalCondition]

      // Act + Assert
      expect(
        getLogicUnitPreventingSubmit(
          [makeResponse(CONDITION_FIELD._id, 0), LOGIC_RESPONSE],
          form,
        ),
      ).toEqual(form.form_logics[0])

      expect(
        getLogicUnitPreventingSubmit(
          [makeResponse(CONDITION_FIELD._id, 1), LOGIC_RESPONSE],
          form,
        ),
      ).toBeUndefined()
    })

    it('should compute that submission should be prevented for "is less than or equal to"', () => {
      // Arrange
      const lteCondition = {
        conditions: [
          {
            ifValueType: LogicIfValue.Number,
            _id: '58169',
            field: CONDITION_FIELD._id,
            state: LogicConditionState.Lte,
            value: 99,
          },
        ],
        _id: MOCK_LOGIC_ID,
        logicType: LogicType.PreventSubmit,
        preventSubmitMessage: "oh no you don't",
      } as IPreventSubmitLogicSchema

      form.form_logics = [lteCondition]

      // Act + Assert
      expect(
        getLogicUnitPreventingSubmit(
          [makeResponse(CONDITION_FIELD._id, 98), LOGIC_RESPONSE],
          form,
        ),
      ).toEqual(form.form_logics[0])
      expect(
        getLogicUnitPreventingSubmit(
          [makeResponse(CONDITION_FIELD._id, 99), LOGIC_RESPONSE],
          form,
        ),
      ).toEqual(form.form_logics[0])
      expect(
        getLogicUnitPreventingSubmit(
          [makeResponse(CONDITION_FIELD._id, 100), LOGIC_RESPONSE],
          form,
        ),
      ).toBeUndefined()
    })

    it('should compute that submission should be prevented for "is more than or equal to"', () => {
      // Arrange
      const gteCondition = {
        conditions: [
          {
            ifValueType: LogicIfValue.Number,
            _id: '58169',
            field: CONDITION_FIELD._id,
            state: LogicConditionState.Gte,
            value: 22,
          },
        ],
        _id: MOCK_LOGIC_ID,
        logicType: LogicType.PreventSubmit,
        preventSubmitMessage: "oh no you don't",
      } as IPreventSubmitLogicSchema

      form.form_logics = [gteCondition]

      // Act + Assert
      expect(
        getLogicUnitPreventingSubmit(
          [makeResponse(CONDITION_FIELD._id, 23), LOGIC_RESPONSE],
          form,
        ),
      ).toEqual(form.form_logics[0])

      expect(
        getLogicUnitPreventingSubmit(
          [makeResponse(CONDITION_FIELD._id, 22), LOGIC_RESPONSE],
          form,
        ),
      ).toEqual(form.form_logics[0])

      expect(
        getLogicUnitPreventingSubmit(
          [makeResponse(CONDITION_FIELD._id, 21), LOGIC_RESPONSE],
          form,
        ),
      ).toBeUndefined()
    })

    it('should compute that submission should be prevented for "is either"', () => {
      // Arrange
      const validOptions = ['Option 1', 'Option 2']
      const eitherCondition = {
        conditions: [
          {
            ifValueType: LogicIfValue.MultiSelect,
            _id: '58169',
            field: CONDITION_FIELD._id,
            state: LogicConditionState.Either,
            value: validOptions,
          },
        ],
        _id: MOCK_LOGIC_ID,
        logicType: LogicType.PreventSubmit,
        preventSubmitMessage: "oh no you don't",
      } as IPreventSubmitLogicSchema

      form.form_logics = [eitherCondition]

      // Act + Assert
      expect(
        getLogicUnitPreventingSubmit(
          [makeResponse(CONDITION_FIELD._id, validOptions[0]), LOGIC_RESPONSE],
          form,
        ),
      ).toEqual(form.form_logics[0])

      expect(
        getLogicUnitPreventingSubmit(
          [makeResponse(CONDITION_FIELD._id, validOptions[1]), LOGIC_RESPONSE],
          form,
        ),
      ).toEqual(form.form_logics[0])

      expect(
        getLogicUnitPreventingSubmit(
          [makeResponse(CONDITION_FIELD._id, 'Option 3'), LOGIC_RESPONSE],
          form,
        ),
      ).toBeUndefined()
    })
  })

  describe('show fields with multiple conditions', () => {
    const CONDITION_FIELD_1 = makeField(new ObjectId().toHexString())
    const CONDITION_FIELD_2 = makeField(new ObjectId().toHexString())
    const LOGIC_FIELD = makeField(new ObjectId().toHexString())
    const LOGIC_RESPONSE = makeResponse(LOGIC_FIELD._id, 'lorem')
    const MOCK_LOGIC_ID_1 = new ObjectId().toHexString()
    const MOCK_LOGIC_ID_2 = new ObjectId().toHexString()

    let form: IFormDocument

    beforeEach(() => {
      form = {
        _id: new ObjectId(),
        form_fields: [CONDITION_FIELD_1, CONDITION_FIELD_2, LOGIC_FIELD],
      } as IFormDocument
    })

    it('should compute the correct visibility for AND conditions', () => {
      // Arrange
      const multipleEqualConditions = {
        show: [LOGIC_FIELD._id],
        _id: MOCK_LOGIC_ID_1,
        conditions: [
          {
            ifValueType: LogicIfValue.SingleSelect,
            _id: '9577',
            field: CONDITION_FIELD_1._id,
            state: LogicConditionState.Equal,
            value: 'Yes',
          },
          {
            ifValueType: LogicIfValue.SingleSelect,
            _id: '45633',
            field: CONDITION_FIELD_2._id,
            state: LogicConditionState.Equal,
            value: 20,
          },
        ],
        logicType: LogicType.ShowFields,
      } as IShowFieldsLogicSchema

      form.form_logics = [multipleEqualConditions]

      // Act
      expect(
        getVisibleFieldIds(
          [
            makeResponse(CONDITION_FIELD_1._id, 'Yes'),
            makeResponse(CONDITION_FIELD_2._id, 20),
            LOGIC_RESPONSE,
          ],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(true)

      expect(
        getVisibleFieldIds(
          [
            makeResponse(CONDITION_FIELD_1._id, 'Yes'),
            makeResponse(CONDITION_FIELD_2._id, 100),
            LOGIC_RESPONSE,
          ],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(false)

      expect(
        getVisibleFieldIds(
          [
            makeResponse(CONDITION_FIELD_1._id, 'No'),
            makeResponse(CONDITION_FIELD_2._id, 20),
            LOGIC_RESPONSE,
          ],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(false)
    })

    it('should compute the correct visibility for OR conditions', () => {
      // Arrange
      const equalCondition = {
        show: [LOGIC_FIELD._id],
        conditions: [
          {
            ifValueType: LogicIfValue.SingleSelect,
            _id: '9577',
            field: CONDITION_FIELD_1._id,
            state: LogicConditionState.Equal,
            value: 'Yes',
          },
        ],
        _id: MOCK_LOGIC_ID_1,
        logicType: LogicType.ShowFields,
      } as IShowFieldsLogicSchema

      const equalCondition2 = {
        show: [LOGIC_FIELD._id],
        conditions: [
          {
            ifValueType: LogicIfValue.SingleSelect,
            _id: '89906',
            field: CONDITION_FIELD_2._id,
            state: LogicConditionState.Equal,
            value: 20,
          },
        ],
        _id: MOCK_LOGIC_ID_2,
        logicType: LogicType.ShowFields,
      } as IShowFieldsLogicSchema

      form.form_logics = [equalCondition, equalCondition2]

      // Act + Assert
      expect(
        getVisibleFieldIds(
          [
            makeResponse(CONDITION_FIELD_1._id, 'Yes'),
            makeResponse(CONDITION_FIELD_2._id, 20),
            LOGIC_RESPONSE,
          ],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(true)

      expect(
        getVisibleFieldIds(
          [
            makeResponse(CONDITION_FIELD_1._id, 'Yes'),
            makeResponse(CONDITION_FIELD_2._id, 100),
            LOGIC_RESPONSE,
          ],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(true)

      expect(
        getVisibleFieldIds(
          [
            makeResponse(CONDITION_FIELD_1._id, 'No'),
            makeResponse(CONDITION_FIELD_2._id, 20),
            LOGIC_RESPONSE,
          ],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(true)

      expect(
        getVisibleFieldIds(
          [
            makeResponse(CONDITION_FIELD_1._id, 'No'),
            makeResponse(CONDITION_FIELD_2._id, 100),
            LOGIC_RESPONSE,
          ],
          form,
        ).has(LOGIC_FIELD._id),
      ).toEqual(false)
    })
  })

  describe('prevent submit with multiple conditions', () => {
    const CONDITION_FIELD_1 = makeField(new ObjectId().toHexString())
    const CONDITION_FIELD_2 = makeField(new ObjectId().toHexString())
    const LOGIC_FIELD = makeField(new ObjectId().toHexString())
    const LOGIC_RESPONSE = makeResponse(LOGIC_FIELD._id, 'lorem')
    const MOCK_LOGIC_ID_1 = new ObjectId().toHexString()
    const MOCK_LOGIC_ID_2 = new ObjectId().toHexString()

    let form: IFormDocument

    beforeEach(() => {
      form = {
        _id: new ObjectId(),
        form_fields: [CONDITION_FIELD_1, CONDITION_FIELD_2, LOGIC_FIELD],
      } as IFormDocument
    })

    it('should correctly prevent submission for AND conditions', () => {
      // Arrange
      const multipleEqualConditions = {
        _id: MOCK_LOGIC_ID_1,
        conditions: [
          {
            ifValueType: LogicIfValue.SingleSelect,
            _id: '9577',
            field: CONDITION_FIELD_1._id,
            state: LogicConditionState.Equal,
            value: 'Yes',
          },
          {
            ifValueType: LogicIfValue.SingleSelect,
            _id: '45633',
            field: CONDITION_FIELD_2._id,
            state: LogicConditionState.Equal,
            value: 20,
          },
        ],
        logicType: LogicType.PreventSubmit,
        preventSubmitMessage: 'orh hor i tell teacher',
      } as IPreventSubmitLogicSchema
      form.form_logics = [multipleEqualConditions]

      // Act + Assert
      expect(
        getLogicUnitPreventingSubmit(
          [
            makeResponse(CONDITION_FIELD_1._id, 'Yes'),
            makeResponse(CONDITION_FIELD_2._id, 20),
            LOGIC_RESPONSE,
          ],
          form,
        ),
      ).toEqual(form.form_logics[0])

      expect(
        getLogicUnitPreventingSubmit(
          [
            makeResponse(CONDITION_FIELD_1._id, 'Yes'),
            makeResponse(CONDITION_FIELD_2._id, 100),
            LOGIC_RESPONSE,
          ],
          form,
        ),
      ).toBeUndefined()

      expect(
        getLogicUnitPreventingSubmit(
          [
            makeResponse(CONDITION_FIELD_1._id, 'No'),
            makeResponse(CONDITION_FIELD_2._id, 20),
            LOGIC_RESPONSE,
          ],
          form,
        ),
      ).toBeUndefined()
    })

    it('should correctly prevent submission for OR conditions', () => {
      // Arrange
      const equalCondition = {
        conditions: [
          {
            ifValueType: LogicIfValue.SingleSelect,
            _id: '9577',
            field: CONDITION_FIELD_1._id,
            state: LogicConditionState.Equal,
            value: 'Yes',
          },
        ],
        _id: MOCK_LOGIC_ID_1,
        logicType: LogicType.PreventSubmit,
        preventSubmitMessage: 'this one cannot',
      } as IPreventSubmitLogicSchema

      const equalCondition2 = {
        conditions: [
          {
            ifValueType: LogicIfValue.SingleSelect,
            _id: '89906',
            field: CONDITION_FIELD_2._id,
            state: LogicConditionState.Equal,
            value: 20,
          },
        ],
        _id: MOCK_LOGIC_ID_2,
        logicType: LogicType.PreventSubmit,
        preventSubmitMessage: 'this one also cannot',
      } as IPreventSubmitLogicSchema

      form.form_logics = [equalCondition, equalCondition2]

      // Act + Assert
      expect(
        getLogicUnitPreventingSubmit(
          [
            makeResponse(CONDITION_FIELD_1._id, 'Yes'),
            makeResponse(CONDITION_FIELD_2._id, 20),
            LOGIC_RESPONSE,
          ],
          form,
        ),
      ).toEqual(form.form_logics[0])

      expect(
        getLogicUnitPreventingSubmit(
          [
            makeResponse(CONDITION_FIELD_1._id, 'Yes'),
            makeResponse(CONDITION_FIELD_2._id, 100),
            LOGIC_RESPONSE,
          ],
          form,
        ),
      ).toEqual(form.form_logics[0])

      expect(
        getLogicUnitPreventingSubmit(
          [
            makeResponse(CONDITION_FIELD_1._id, 'No'),
            makeResponse(CONDITION_FIELD_2._id, 20),
            LOGIC_RESPONSE,
          ],
          form,
        ),
      ).toEqual(form.form_logics[1])

      expect(
        getLogicUnitPreventingSubmit(
          [
            makeResponse(CONDITION_FIELD_1._id, 'No'),
            makeResponse(CONDITION_FIELD_2._id, 100),
            LOGIC_RESPONSE,
          ],
          form,
        ),
      ).toBeUndefined()
    })
  })

  describe('visibility for others value', () => {
    const MOCK_LOGIC_ID = new ObjectId().toHexString()

    const MOCK_RADIO_FIELD = {
      _id: new ObjectId().toHexString(),
      fieldType: BasicField.Radio,
      fieldOptions: ['Option 1', 'Option 2'],
      othersRadioButton: true,
    } as IRadioFieldSchema

    const MOCK_TEXT_FIELD = {
      _id: new ObjectId().toHexString(),
      fieldType: BasicField.ShortText,
    } as IShortTextFieldSchema

    const fillInRadioButton = (fieldValue: string) =>
      Object.assign({}, MOCK_RADIO_FIELD, { fieldValue, isVisible: true })

    let form: IFormDocument

    beforeEach(() => {
      form = {
        _id: new ObjectId(),
      } as IFormDocument
    })

    it('should compute the correct visibility for radiobutton Others on clientside', () => {
      // Arrange
      const equalCondition = {
        show: [MOCK_TEXT_FIELD._id],
        conditions: [
          {
            ifValueType: LogicIfValue.SingleSelect,
            _id: '58169',
            field: MOCK_RADIO_FIELD._id,
            state: LogicConditionState.Equal,
            value: 'Others',
          },
        ],
        _id: MOCK_LOGIC_ID,
        logicType: LogicType.ShowFields,
      } as IShowFieldsLogicSchema

      const textFieldResponse = Object.assign({}, MOCK_TEXT_FIELD, {
        fieldValue: 'lorem',
      })
      form.form_fields = [MOCK_RADIO_FIELD, MOCK_TEXT_FIELD]
      form.form_logics = [equalCondition]
      // Act + Assert
      expect(
        getVisibleFieldIds(
          [fillInRadioButton('radioButtonOthers'), textFieldResponse],
          form,
        ).has(MOCK_TEXT_FIELD._id),
      ).toEqual(true)

      expect(
        getVisibleFieldIds(
          [fillInRadioButton('Option 1'), textFieldResponse],
          form,
        ).has(MOCK_TEXT_FIELD._id),
      ).toEqual(false)
    })

    it('should compute the correct visibility for radiobutton Others on serverside', () => {
      // Arrange
      const equalCondition = {
        show: [MOCK_TEXT_FIELD._id],
        conditions: [
          {
            ifValueType: LogicIfValue.SingleSelect,
            _id: '58169',
            field: MOCK_RADIO_FIELD._id,
            state: LogicConditionState.Equal,
            value: 'Others',
          },
        ],
        _id: MOCK_LOGIC_ID,
        logicType: LogicType.ShowFields,
      } as IShowFieldsLogicSchema

      const textFieldResponse = makeResponse(
        new ObjectId().toHexString(),
        'lorem',
      )
      form.form_fields = [MOCK_RADIO_FIELD, MOCK_TEXT_FIELD]
      form.form_logics = [equalCondition]

      // Act + Assert
      expect(
        getVisibleFieldIds(
          [
            makeResponse(MOCK_RADIO_FIELD._id, 'Others: School'),
            textFieldResponse,
          ],
          form,
        ).has(MOCK_TEXT_FIELD._id),
      ).toEqual(true)

      expect(
        getVisibleFieldIds(
          [makeResponse(MOCK_RADIO_FIELD._id, 'Option 1'), textFieldResponse],
          form,
        ).has(MOCK_TEXT_FIELD._id),
      ).toEqual(false)
    })
  })

  describe('visibility for circular logic', () => {
    const FIELD_1 = makeField(new ObjectId().toHexString())
    const FIELD_2 = makeField(new ObjectId().toHexString())
    const VISIBLE_FIELD = makeField(new ObjectId().toHexString())
    const MOCK_LOGIC_ID_1 = new ObjectId()
    const MOCK_LOGIC_ID_2 = new ObjectId()

    let form: IFormDocument

    beforeEach(() => {
      form = {
        _id: new ObjectId(),
        form_logics: [
          {
            show: [FIELD_2._id],
            conditions: [
              {
                ifValueType: LogicIfValue.SingleSelect,
                _id: '9577',
                field: FIELD_1._id,
                state: LogicConditionState.Equal,
                value: 'Yes',
              },
            ],
            _id: MOCK_LOGIC_ID_1,
            logicType: LogicType.ShowFields,
          } as IShowFieldsLogicSchema,
          {
            show: [FIELD_1._id],
            conditions: [
              {
                ifValueType: LogicIfValue.SingleSelect,
                _id: '89906',
                field: FIELD_2._id,
                state: LogicConditionState.Equal,
                value: 'Yes',
              },
            ],
            _id: MOCK_LOGIC_ID_2,
            logicType: LogicType.ShowFields,
          } as IShowFieldsLogicSchema,
        ],
      } as unknown as IFormDocument
    })

    it('should compute the correct visibility for circular logic where all fields are hidden', () => {
      form.form_fields = [FIELD_1, FIELD_2]
      for (const field1Response of ['Yes', 'No']) {
        for (const field2Response of ['Yes', 'No']) {
          const visibleFieldIds = getVisibleFieldIds(
            [
              makeResponse(FIELD_1._id, field1Response),
              makeResponse(FIELD_2._id, field2Response),
            ],
            form,
          )
          expect(visibleFieldIds.has(FIELD_1._id)).toEqual(false)
          expect(visibleFieldIds.has(FIELD_2._id)).toEqual(false)
        }
      }
    })

    it('should compute the correct visibility for circular logic with a mix of shown and hidden fields', () => {
      form.form_fields = [FIELD_1, FIELD_2, VISIBLE_FIELD]
      for (const field1Response of ['Yes', 'No']) {
        for (const field2Response of ['Yes', 'No']) {
          const visibleFieldIds = getVisibleFieldIds(
            [
              makeResponse(FIELD_1._id, field1Response),
              makeResponse(FIELD_2._id, field2Response),
              makeResponse(VISIBLE_FIELD._id, 'Yes'),
            ],
            form,
          )
          expect(visibleFieldIds.has(FIELD_1._id)).toEqual(false)
          expect(visibleFieldIds.has(FIELD_2._id)).toEqual(false)
          expect(visibleFieldIds.has(VISIBLE_FIELD._id)).toEqual(true)
        }
      }
    })
  })

  describe('prevent submit for others value', () => {
    const MOCK_LOGIC_ID = new ObjectId()
    const MOCK_RADIO_FIELD = {
      _id: new ObjectId(),
      fieldType: BasicField.Radio,
      fieldOptions: ['Option 1', 'Option 2'],
      othersRadioButton: true,
    } as IRadioFieldSchema
    const MOCK_TEXT_FIELD = {
      _id: new ObjectId(),
      fieldType: BasicField.ShortText,
    } as IShortTextFieldSchema

    const fillInRadioButton = (fieldValue: string) =>
      Object.assign({}, MOCK_RADIO_FIELD, { fieldValue, isVisible: true })

    let form: IFormDocument

    beforeEach(() => {
      form = { _id: new ObjectId() } as IFormDocument
    })

    it('should correctly prevent submission for radiobutton Others on clientside', () => {
      // Arrange
      const textFieldResponse = Object.assign({}, MOCK_TEXT_FIELD, {
        fieldValue: 'lorem',
      })
      form.form_fields = [MOCK_RADIO_FIELD, MOCK_TEXT_FIELD]
      form.form_logics = [
        {
          conditions: [
            {
              ifValueType: LogicIfValue.SingleSelect,
              _id: '58169',
              field: MOCK_RADIO_FIELD._id,
              state: LogicConditionState.Equal,
              value: 'Others',
            },
          ],
          _id: MOCK_LOGIC_ID,
          logicType: LogicType.PreventSubmit,
        } as IPreventSubmitLogicSchema,
      ]

      // Act + Assert
      expect(
        getLogicUnitPreventingSubmit(
          [fillInRadioButton('radioButtonOthers'), textFieldResponse],
          form,
        ),
      ).toEqual(form.form_logics[0])

      expect(
        getLogicUnitPreventingSubmit(
          [fillInRadioButton('Option 1'), textFieldResponse],
          form,
        ),
      ).toBeUndefined()
    })

    it('should correctly prevent submission for radiobutton Others on serverside', () => {
      // Arrange
      const textFieldResponse = makeResponse(
        new ObjectId().toHexString(),
        'lorem',
      )
      form.form_fields = [MOCK_RADIO_FIELD, MOCK_TEXT_FIELD]
      form.form_logics = [
        {
          conditions: [
            {
              ifValueType: LogicIfValue.SingleSelect,
              _id: '58169',
              field: MOCK_RADIO_FIELD._id,
              state: LogicConditionState.Equal,
              value: 'Others',
            },
          ],
          _id: MOCK_LOGIC_ID,
          logicType: LogicType.PreventSubmit,
        } as IPreventSubmitLogicSchema,
      ]

      // Act + Assert
      expect(
        getLogicUnitPreventingSubmit(
          [
            makeResponse(MOCK_RADIO_FIELD._id, 'Others: School'),
            textFieldResponse,
          ],
          form,
        ),
      ).toEqual(form.form_logics[0])
      expect(
        getLogicUnitPreventingSubmit(
          [makeResponse(MOCK_RADIO_FIELD._id, 'Option 1'), textFieldResponse],
          form,
        ),
      ).toBeUndefined()
    })
  })
})

describe('Logic util', () => {
  const VALID_IF_CONDITION_FIELDS = [
    BasicField.Dropdown,
    BasicField.Number,
    BasicField.Decimal,
    BasicField.Rating,
    BasicField.YesNo,
    BasicField.Radio,
    BasicField.Checkbox,
  ]

  const INVALID_IF_CONDITION_FIELDS = Object.values(BasicField).filter(
    (fieldType) => !VALID_IF_CONDITION_FIELDS.includes(fieldType),
  )

  describe('getApplicableIfFields', () => {
    it('should not filter fields suitable as an if-conditional', () => {
      const validIfFields: IField[] = VALID_IF_CONDITION_FIELDS.map(
        (fieldType) => ({ fieldType } as unknown as IField),
      )
      const fields = getApplicableIfFields(validIfFields)
      validIfFields.forEach((v, i) => expect(v).toStrictEqual(fields[i]))
    })
    it('should filter fields not suitable as an if-conditional', () => {
      const invalidIfFields: IField[] = INVALID_IF_CONDITION_FIELDS.map(
        (x) => x as unknown as IField,
      )
      const fields = getApplicableIfFields(invalidIfFields)
      expect(fields).toStrictEqual([])
    })
  })

  describe('getApplicableIfStates', () => {
    it('should return valid logic states for categorical field types', () => {
      const categoricalFields = [BasicField.Dropdown, BasicField.Radio]
      categoricalFields.forEach((fieldType) => {
        const states = getApplicableIfStates(fieldType)
        expect(states).toIncludeSameMembers([
          LogicConditionState.Equal,
          LogicConditionState.Either,
        ])
        expect(states).toBeArrayOfSize(2)
      })
    })
    it('should return valid logic states for binary field types', () => {
      const states = getApplicableIfStates(BasicField.YesNo)
      expect(states).toIncludeSameMembers([LogicConditionState.Equal])
      expect(states).toBeArrayOfSize(1)
    })
    it('should return valid logic states for numerical field types', () => {
      const numericalFields = [
        BasicField.Number,
        BasicField.Decimal,
        BasicField.Rating,
      ]
      numericalFields.forEach((fieldType) => {
        const states = getApplicableIfStates(fieldType)
        expect(states).toIncludeSameMembers([
          LogicConditionState.Equal,
          LogicConditionState.Lte,
          LogicConditionState.Gte,
        ])
        expect(states).toBeArrayOfSize(3)
      })
    })
    it('should return valid logic states for multi-value field types', () => {
      const multiValueFields = [BasicField.Checkbox]
      multiValueFields.forEach((fieldType) => {
        const states = getApplicableIfStates(fieldType)
        expect(states).toIncludeSameMembers([LogicConditionState.AnyOf])
        expect(states).toBeArrayOfSize(1)
      })
    })
    it('should return empty array for invalid conditional fields', () => {
      INVALID_IF_CONDITION_FIELDS.forEach((fieldType) => {
        const states = getApplicableIfStates(fieldType)
        expect(states).toStrictEqual([])
      })
    })
  })
})
