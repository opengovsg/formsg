import { celebrate, Joi, Segments } from 'celebrate'
import { Router } from 'express'

import * as FrontendServerController from './frontend.controller'

export const FrontendRouter = Router()

/**
 * Generate the templated Javascript code for the frontend to initialise Google Tag Manager
 * Code depends on whether googleAnalyticsFeature.isEnabled
 * @route GET /frontend/datalayer
 * @return 200 when code generation is successful
 * @return 400 when code generation fails
 */
FrontendRouter.get(
  '/datalayer',
  FrontendServerController.addGoogleAnalyticsData,
)

/**
 * Generate the templated Javascript code with environment variables for the frontend
 * @route GET /frontend/environment
 * @return 200 when code generation is successful
 * @return 400 when code generation fails
 */
FrontendRouter.get('/environment', FrontendServerController.addEnvVarData)

/**
 * Generate a json of current activated features
 * @route GET /frontend/features
 * @return json with featureManager.states
 * @deprecated
 * TODO (#2147): delete this
 */
FrontendRouter.get('/features', FrontendServerController.showFeaturesStates)

/**
 * Generate the javascript code to redirect to the correct url
 * @route GET /frontend/redirect
 * @return 200 when redirect code is  successful
 * @return 400 when redirect code fails
 */
FrontendRouter.get(
  '/redirect',
  celebrate({
    [Segments.QUERY]: {
      redirectPath: Joi.string()
        .regex(/^[a-fA-F0-9]{24}(\/(preview|template|use-template))?/)
        .required(),
    },
  }),
  FrontendServerController.generateRedirectUrl,
)
