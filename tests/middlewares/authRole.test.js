// tests/middlewares/authRole.test.js
import { describe, it, expect, vi } from 'vitest'
import { authAdmin } from '../../src/middlewares/authRole.js'

describe('authAdmin', () => {
  const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() })

  it('devuelve 401 si req.user no existe', () => {
    const res = makeRes()
    authAdmin({}, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'No autenticado' })
  })

  it('devuelve 403 si role es user', () => {
    const res = makeRes()
    authAdmin({ user: { role: 'user' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Acceso denegado' })
  })

  it('llama next() si role es admin', () => {
    const next = vi.fn()
    authAdmin({ user: { role: 'admin' } }, makeRes(), next)
    expect(next).toHaveBeenCalled()
  })
})
