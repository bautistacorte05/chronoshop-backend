import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  firstName: { type: String, trim: true },
  lastName:  { type: String, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, default: null },
  role:      { type: String, enum: ['user', 'admin'], default: 'user' },
  provider:  { type: String, enum: ['local', 'github', 'google'], default: 'local' },
  githubId:  { type: String, default: null },
  googleId:  { type: String, default: null },
  avatar:    { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
})

export default mongoose.model('User', userSchema)
