import bcrypt from 'bcrypt'

export class UserManager {
  constructor(dao) {
    this.dao = dao
  }

  async register({ firstName, lastName, email, password }) {
    const exists = await this.dao.findByEmail(email)
    if (exists) throw new Error('EMAIL_TAKEN')
    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 10
    const hash = await bcrypt.hash(password, rounds)
    return this.dao.create({ firstName, lastName, email, password: hash, provider: 'local' })
  }

  async findByEmail(email) {
    return this.dao.findByEmail(email)
  }

  async findById(id) {
    return this.dao.findById(id)
  }

  async findOrCreateGithub({ githubId, firstName, email, avatar }) {
    let user = await this.dao.findByGithubId(githubId)
    if (!user) {
      user = await this.dao.create({ githubId, firstName, email, avatar, provider: 'github' })
    }
    return user
  }

  async findOrCreateGoogle({ googleId, firstName, email, avatar }) {
    let user = await this.dao.findByGoogleId(googleId)
    if (!user) {
      user = await this.dao.create({ googleId, firstName, email, avatar, provider: 'google' })
    }
    return user
  }
}
