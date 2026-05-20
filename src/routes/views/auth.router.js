import { Router } from 'express'
import passport from 'passport'
import { makeAuthController } from '../../controllers/auth.controller.js'

export const createAuthViewRouter = (userManager) => {
  const router = Router()
  const ctrl = makeAuthController(userManager)

  router.get('/login', (req, res) => res.render('login'))
  router.get('/register', (req, res) => res.render('register'))

  router.get('/auth/github',
    passport.authenticate('github', { scope: ['user:email'] })
  )

  router.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/login', session: true }),
    ctrl.oauthCallback
  )

  router.get('/auth/google',
    passport.authenticate('google', { scope: ['email', 'profile'] })
  )

  router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login', session: true }),
    ctrl.oauthCallback
  )

  return router
}
