import { Router } from 'express'

import { AdminRouter } from './admin'
import { UserRouter } from './user'
import { AuthRouter } from './auth'

export const V3Router = Router()

V3Router.use('/admin', AdminRouter)
V3Router.use('/user', UserRouter)
V3Router.use('/auth', AuthRouter)
