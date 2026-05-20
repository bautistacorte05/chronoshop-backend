// src/middlewares/authJWT.js
import jwt from 'jsonwebtoken'

export const authJWT = (req, res, next) => {
  const token = req.cookies?.authToken || req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}
