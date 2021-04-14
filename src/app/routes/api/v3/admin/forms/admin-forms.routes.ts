import { Router } from 'express'

import { withUserAuthentication } from '../../../../../modules/auth/auth.middlewares'

import { AdminFormsFeedbackRouter } from './admin-forms.feedback.routes'
import { AdminFormsSettingsRouter } from './admin-forms.settings.routes'
import { AdminFormsSubmissionRouter } from './admin-forms.submissions.routes'

export const AdminFormsRouter = Router()

// All routes in this handler should be protected by authentication.
AdminFormsRouter.use(withUserAuthentication)

AdminFormsRouter.use(AdminFormsSettingsRouter)
AdminFormsRouter.use(AdminFormsFeedbackRouter)
AdminFormsRouter.use(AdminFormsSubmissionRouter)
