import { combineWithAllErrors, err, ok, Result } from 'neverthrow'

import {
  FieldIdSet,
  getLogicUnitPreventingSubmit,
  getVisibleFieldIds,
} from '../../../shared/util/logic'
import { formatFieldsForLogic } from '../../../shared/util/logic-utils'
import {
  FieldResponse,
  IFieldSchema,
  IFormDocument,
  IPopulatedForm,
} from '../../../types'
import { validateField } from '../../utils/field-validation'

import { ProcessingError, ValidateFieldError } from './submission.errors'
import {
  FilteredResponse,
  ProcessedFieldResponse,
  ValidatedFieldMap,
  VerifiableResponseIdSet,
  VisibleResponseIdSet,
} from './submission.types'

export abstract class IncomingSubmission {
  private readonly visibleFieldIds: FieldIdSet
  private readonly visibleResponseIds: VisibleResponseIdSet
  private readonly verifiableResponseIds: VerifiableResponseIdSet
  protected constructor(
    public readonly responses: FilteredResponse[],
    public readonly form: IPopulatedForm,
    private fieldMap: ValidatedFieldMap,
  ) {
    this.visibleFieldIds = getVisibleFieldIds(
      formatFieldsForLogic(responses, form.form_fields),
      form,
    )
    this.visibleResponseIds = this.getVisibleResponseIds()
    this.verifiableResponseIds = this.getVerifiableResponseIds()
  }

  /**
   * Generate a look-up table that maps an response ID to form field.
   * Additionally, guarantees that every response's ID can be found.
   * @param form - The form to generate the lookup table for.
   * @param responses - List of responses. Used for validation to achieve
   * said guarantee.
   * @returns neverthrow ok() with look-up table.
   * @returns neverthrow err() if form object does not have `form_fields`,
   * or if there exists a response whose ID is not a key in the lookup
   * table.
   * @protected
   */
  protected static getFieldMap(
    form: IFormDocument,
    responses: FieldResponse[],
  ): Result<ValidatedFieldMap, ProcessingError> {
    if (!form.form_fields) {
      return err(new ProcessingError('Form fields are undefined'))
    }

    const fieldMap = form.form_fields.reduce<{
      [fieldId: string]: IFieldSchema
    }>((acc, field) => {
      acc[field._id] = field
      return acc
    }, {})

    if (!this.isFieldMapValid(fieldMap, responses)) {
      return err(
        new ProcessingError('Response ID does not match form field IDs'),
      )
    }

    return ok(fieldMap)
  }

  private static isFieldMapValid(
    fieldMap: {
      [p: string]: IFieldSchema
    },
    responses: FieldResponse[],
  ): fieldMap is ValidatedFieldMap {
    for (const r of responses) {
      const responseId = r._id
      const formField = fieldMap[responseId]
      if (!formField) {
        return false
      }
    }
    return true
  }

  /**
   * Generates a set of response IDs that are visible.
   * @returns visibleResponseIds - Generated set of response IDs.
   * @protected
   */
  private getVisibleResponseIds(): VisibleResponseIdSet {
    return this.responses.reduce<FieldIdSet>((acc, response) => {
      const responseId = String(response._id)
      if (this.responseVisibilityPredicate(response)) {
        acc.add(responseId)
      }
      return acc
    }, new Set()) as VisibleResponseIdSet
  }

  /**
   * Generates a set of response IDs that are verifiable. A response is
   * said to be verifiable if its corresponding form field has the
   * isVerifiable property set to `true`.
   * @returns verifiableResponseIds - Generated set of response IDs.
   * @protected
   */
  private getVerifiableResponseIds(): VerifiableResponseIdSet {
    return this.responses.reduce<FieldIdSet>((acc, response) => {
      const responseId = String(response._id)
      const formField = this.fieldMap[responseId]
      if (formField.isVerifiable) {
        acc.add(responseId)
      }
      return acc
    }, new Set()) as VerifiableResponseIdSet
  }

  /**
   * Prior to the introduction of IncomingResponse, responses were
   * stored in a ProcessedFieldResponse[]. This method helps to
   * create a ProcessedFieldResponse object that can be used in
   * functions that have not been refactored to take in the new
   * IncomingResponse object.
   *
   * A ProcessedResponse is just a regular FieldResponse with some
   * metadata inserted into them. This function takes in several
   * data sets that help determine what each metadata field should
   * contain.
   * @param response
   * @returns processedFieldResponse - The ProcessedFieldResponse
   * @protected
   */
  protected getLegacyProcessedFieldResponse(
    response: FieldResponse,
  ): ProcessedFieldResponse {
    const responseId = String(response._id)
    const formField = this.fieldMap[responseId]
    return {
      ...response,
      isVisible: this.visibleResponseIds.has(responseId),
      question: formField.getQuestion(),
      isUserVerified: this.verifiableResponseIds.has(responseId)
        ? true
        : undefined,
    }
  }

  protected validate(): Result<true, ProcessingError | ValidateFieldError[]> {
    // Guard against invalid form submissions that should have been prevented by
    // logic.
    if (
      getLogicUnitPreventingSubmit(
        formatFieldsForLogic(this.responses, this.form.form_fields),
        this.form,
        this.visibleFieldIds,
      )
    ) {
      return err(new ProcessingError('Submission prevented by form logic'))
    }

    const validationResultList = this.responses.map((response) => {
      const responseId = String(response._id)
      const formField = this.fieldMap[responseId]
      return validateField(
        this.form._id,
        formField,
        this.getLegacyProcessedFieldResponse(response),
      )
    })

    const validationResultCombined = combineWithAllErrors(validationResultList)
    if (validationResultCombined.isErr()) {
      return err(validationResultCombined.error)
    }

    return ok(true)
  }

  /**
   * Predicate that determines if a response is visible. To be implemented in
   * derived class.
   * @param response
   * @returns boolean
   */
  abstract responseVisibilityPredicate(response: FieldResponse): boolean
}
