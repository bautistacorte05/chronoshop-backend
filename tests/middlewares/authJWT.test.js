// tests/middlewares/authJWT.test.js
import { describe, it, expect, vi } from 'vitest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_jwt'

const { authJWT } = await import('../../src/middlewares/authJWT.js')

describe('authJWT', () => {
  const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() })

  it('devuelve 401 si no hay token (verifica body)', () => {
    const req = { cookies: {}, headers: {} }
    const res = makeRes()
    authJWT(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'No autenticado' })
  })

  it('llama next() y adjunta req.user para token válido en cookie', () => {
    const token = jwt.sign({ userId: 'abc', role: 'user' }, 'test_secret_jwt')
    const req = { cookies: { authToken: token }, headers: {} }
    const res = makeRes()
    const next = vi.fn()
    authJWT(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.user).toMatchObject({ userId: 'abc', role: 'user' })
  })

  it('llama next() para token válido en Authorization header', () => {
    const token = jwt.sign({ userId: 'xyz', role: 'admin' }, 'test_secret_jwt')
    const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } }
    const res = makeRes()
    const next = vi.fn()
    authJWT(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.user.role).toBe('admin')
  })

  it('devuelve 401 para token inválido', () => {
    const req = { cookies: { authToken: 'invalid.token.here' }, headers: {} }
    const res = makeRes()
    authJWT(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido o expirado' })
  })
})
