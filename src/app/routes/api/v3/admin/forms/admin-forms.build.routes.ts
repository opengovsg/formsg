import { celebrate, Joi, Segments } from 'celebrate'
import { Router } from 'express'

import { BasicField } from '../../../../../../types'
import * as AdminFormController from '../../../../../modules/form/admin-form/admin-form.controller'

export const AdminFormsBuildRouter = Router()
/**
 * Update form field according to given new body.
 * @route PUT /admin/forms/:formId/fields/:fieldId
 *
 * @param body the new field to override current field
 * @returns 200 with updated form field
 * @returns 400 when given body fails Joi validation
 * @returns 401 when current user is not logged in
 * @returns 403 when current user does not have permissions to update form field
 * @returns 404 when form cannot be found
 * @returns 404 when field cannot be found
 * @returns 410 when updating form field for archived form
 * @returns 422 when an invalid form field update is attempted on the form
 * @returns 422 when user in session cannot be retrieved from the database
 * @returns 500 when database error occurs
 */
AdminFormsBuildRouter.put(
  '/:formId([a-fA-F0-9]{24})/fields/:fieldId([a-fA-F0-9]{24})',
  celebrate({
    [Segments.BODY]: Joi.object({
      fieldType: Joi.string()
        .valid(...Object.values(BasicField))
        .required(),
      description: Joi.string().allow('').required(),
      required: Joi.boolean().required(),
      title: Joi.string().required(),
      disabled: Joi.boolean().required(),
      // Allow other field related key-values to be provided and let the model
      // layer handle the validation.
    }).unknown(true),
  }),
  AdminFormController.handleUpdateFormField,
)
