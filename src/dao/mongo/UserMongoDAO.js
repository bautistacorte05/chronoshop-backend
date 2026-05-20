import User from '../../models/User.js'

export class UserMongoDAO {
  async create(data) {
    return User.create(data)
  }

  async findByEmail(email) {
    return User.findOne({ email })
  }

  async findById(id) {
    return User.findById(id)
  }

  async findByGithubId(githubId) {
    return User.findOne({ githubId })
  }

  async findByGoogleId(googleId) {
    return User.findOne({ googleId })
  }
}
