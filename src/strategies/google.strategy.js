import { Strategy as GoogleStrategy } from 'passport-google-oauth2'

export const makeGoogleStrategy = (userManager) =>
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await userManager.findOrCreateGoogle({
          googleId:  profile.id,
          firstName: profile.displayName || profile.given_name,
          email:     profile.emails?.[0]?.value || null,
          avatar:    profile.photos?.[0]?.value || null
        })
        done(null, user)
      } catch (err) {
        done(err)
      }
    }
  )
