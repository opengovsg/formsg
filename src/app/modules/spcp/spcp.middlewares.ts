import { celebrate, Joi, Segments } from 'celebrate'

import { AuthType } from '../../../types'

export const redirectParamsMiddleware = celebrate({
  [Segments.QUERY]: Joi.object({
    target: Joi.string().required(),
    authType: Joi.string().required().valid(AuthType.SP, AuthType.CP),
    esrvcId: Joi.string().required(),
  }),
})
