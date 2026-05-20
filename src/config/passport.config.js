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

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(makeGithubStrategy(userManager))
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(makeGoogleStrategy(userManager))
  }
}
