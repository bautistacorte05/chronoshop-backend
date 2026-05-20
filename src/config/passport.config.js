import passport from 'passport'
import { makeLocalStrategy }  from '../strategies/local.strategy.js'
import { makeGithubStrategy } from '../strategies/github.strategy.js'
import { makeGoogleStrategy } from '../strategies/google.strategy.js'

export const configurePassport = (userManager) => {
  passport.serializeUser((user, done) => done(null, user._id.toString()))

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await userManager.findById(id)
      done(null, user)
    } catch (err) {
      done(err)
    }
  })

  passport.use(makeLocalStrategy(userManager))
  passport.use(makeGithubStrategy(userManager))
  passport.use(makeGoogleStrategy(userManager))
}
