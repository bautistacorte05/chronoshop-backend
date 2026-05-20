import { Router } from 'express'
import passport from 'passport'
import { makeAuthController } from '../../controllers/auth.controller.js'
import { authJWT } from '../../middlewares/authJWT.js'
import { authAdmin } from '../../middlewares/authRole.js'

export const createAuthApiRouter = (userManager) => {
  const router = Router()
  const ctrl = makeAuthController(userManager)

  router.post('/auth/register', ctrl.register)

  router.post(
    '/auth/login',
    passport.authenticate('local', { session: true }),
    ctrl.loginLocal
  )

  router.post('/auth/logout', ctrl.logout)

  router.get('/session', ctrl.getSession)

  router.get('/profile', authJWT, ctrl.getProfile)

  router.get('/admin', authJWT, authAdmin, ctrl.getAdmin)

  return router
}
