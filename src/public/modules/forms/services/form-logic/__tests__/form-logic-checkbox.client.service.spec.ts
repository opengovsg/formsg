import { LogicCheckboxCondition } from '../../../../../../types'
import {
  ClientCheckboxCondition,
  convertArrayCheckboxCondition,
  convertObjectCheckboxCondition,
} from '../form-logic-checkbox.client.service'

describe('convertObjectCheckboxCondition', () => {
  describe('condition value with object representation', () => {
    const OPTIONS = ['Option 1', 'Option 2', 'Option 3']
    it('should correctly convert condition value with others true into array representation', () => {
      // Arrange
      const conditionWithObjectRepresentation = {
        value: [
          {
            options: [OPTIONS[0], OPTIONS[2]],
            others: true,
          },
        ],
      } as unknown as LogicCheckboxCondition // only care about the value portion of the condition
      const expected = {
        value: [
          [
            { value: OPTIONS[0], other: false },
            { value: OPTIONS[2], other: false },
            { value: 'Others', other: true },
          ],
        ],
      }

      // Act
      const transformed = convertObjectCheckboxCondition(
        conditionWithObjectRepresentation,
      )

      // Assert
      expect(transformed.value.length).toEqual(1) // should only have one condition
      expect(new Set(transformed.value[0])).toEqual(new Set(expected.value[0]))
    })
    it('should correctly convert condition value with others false into array representation', () => {
      // Arrange
      const conditionWithObjectRepresentation = {
        value: [
          {
            options: [OPTIONS[0], OPTIONS[2]],
            others: false,
          },
        ],
      } as unknown as LogicCheckboxCondition // only care about the value portion of the condition
      const expected = {
        value: [
          [
            { value: OPTIONS[0], other: false },
            { value: OPTIONS[2], other: false },
          ],
        ],
      }

      // Act
      const transformed = convertObjectCheckboxCondition(
        conditionWithObjectRepresentation,
      )

      // Assert
      expect(transformed.value.length).toEqual(1) // should only have one condition
      expect(new Set(transformed.value[0])).toEqual(new Set(expected.value[0]))
    })
  })
  describe('condition value with array representation', () => {
    const OPTIONS = [
      { value: 'Option 1', others: false },
      { value: 'Option 2', others: false },
      { value: 'Option 3', others: false },
    ]
    const OTHERS = { value: 'Others', other: true }
    it('should correctly convert condition value with others into object representation', () => {
      // Arrange
      const conditionWithArrayRepresentation = {
        value: [[OPTIONS[0], OPTIONS[2], OTHERS]],
      } as unknown as ClientCheckboxCondition // only care about the value portion of the condition

      const expected = {
        value: [
          {
            options: [OPTIONS[0].value, OPTIONS[2].value],
            others: true,
          },
        ],
      }

      // Act
      const transformed = convertArrayCheckboxCondition(
        conditionWithArrayRepresentation,
      )

      // Assert
      expect(transformed).toEqual(expected)
    })
    it('should correctly convert condition value without others into object representation', () => {
      // Arrange
      const conditionWithArrayRepresentation = {
        value: [[OPTIONS[0], OPTIONS[2]]],
      } as unknown as ClientCheckboxCondition // only care about the value portion of the condition

      const expected = {
        value: [
          {
            options: [OPTIONS[0].value, OPTIONS[2].value],
            others: false,
          },
        ],
      }

      // Act
      const transformed = convertArrayCheckboxCondition(
        conditionWithArrayRepresentation,
      )

      // Assert
      expect(transformed).toEqual(expected)
    })
  })
})
