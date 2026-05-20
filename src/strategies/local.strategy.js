import { Strategy as LocalStrategy } from 'passport-local'
import bcrypt from 'bcrypt'

export const makeLocalStrategy = (userManager) =>
  new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await userManager.findByEmail(email)
        if (!user || user.provider !== 'local') return done(null, false)
        const match = await bcrypt.compare(password, user.password)
        if (!match) return done(null, false)
        done(null, user)
      } catch (err) {
        done(err)
      }
    }
  )
