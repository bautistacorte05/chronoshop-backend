import jwt from 'jsonwebtoken'

const generateToken = (user) =>
  jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION || '1h' }
  )

const setAuthCookie = (res, token) =>
  res.cookie('authToken', token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 3600000
  })

export const makeAuthController = (userManager) => ({

  register: async (req, res) => {
    try {
      const { firstName, lastName, email, password } = req.body
      if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son requeridos' })
      if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
      const user = await userManager.register({ firstName, lastName, email, password })
      res.status(201).json({
        message: 'Usuario registrado correctamente',
        user: { _id: user._id, email: user.email, role: user.role }
      })
    } catch (err) {
      if (err.message === 'EMAIL_TAKEN')
        return res.status(409).json({ error: 'El email ya está registrado' })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  },

  loginLocal: (req, res) => {
    const token = generateToken(req.user)
    setAuthCookie(res, token)
    res.json({
      message: 'Login exitoso',
      token,
      user: { _id: req.user._id, email: req.user.email, role: req.user.role }
    })
  },

  oauthCallback: (req, res) => {
    const token = generateToken(req.user)
    setAuthCookie(res, token)
    res.redirect('/products')
  },

  logout: (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ error: 'Error al cerrar sesión' })
      req.session.destroy(() => {
        res.clearCookie('authToken')
        res.clearCookie('connect.sid')
        res.json({ message: 'Logout exitoso' })
      })
    })
  },

  getSession: (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Sin sesión activa' })
    res.json({
      sessionId: req.sessionID,
      user: { _id: req.user._id, email: req.user.email, role: req.user.role }
    })
  },

  getProfile: async (req, res) => {
    try {
      const user = await userManager.findById(req.user.userId)
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
      res.json({
        user: { _id: user._id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }
      })
    } catch {
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  },

  getAdmin: (req, res) => {
    res.json({ message: 'Panel de administración', admin: req.user })
  }
})
