import { Strategy as GitHubStrategy } from 'passport-github2'

export const makeGithubStrategy = (userManager) =>
  new GitHubStrategy(
    {
      clientID:     process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL:  process.env.GITHUB_CALLBACK_URL,
      scope: ['user:email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await userManager.findOrCreateGithub({
          githubId:  profile.id,
          firstName: profile.displayName || profile.username,
          email:     profile.emails?.[0]?.value || null,
          avatar:    profile.photos?.[0]?.value || null
        })
        done(null, user)
      } catch (err) {
        done(err)
      }
    }
  )
