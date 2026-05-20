import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserManager } from '../../src/managers/UserManager.js'

describe('UserManager', () => {
  let mockDAO, manager

  beforeEach(() => {
    mockDAO = {
      findByEmail:    vi.fn(),
      create:         vi.fn(),
      findById:       vi.fn(),
      findByGithubId: vi.fn(),
      findByGoogleId: vi.fn()
    }
    manager = new UserManager(mockDAO)
  })

  describe('register', () => {
    it('lanza EMAIL_TAKEN si el email ya existe', async () => {
      mockDAO.findByEmail.mockResolvedValue({ email: 'x@x.com' })
      await expect(
        manager.register({ email: 'x@x.com', password: '123' })
      ).rejects.toThrow('EMAIL_TAKEN')
    })

    it('hashea la contraseña antes de guardar', async () => {
      mockDAO.findByEmail.mockResolvedValue(null)
      mockDAO.create.mockResolvedValue({ _id: '1', email: 'a@a.com', role: 'user' })
      await manager.register({ email: 'a@a.com', password: 'plain123' })
      const savedData = mockDAO.create.mock.calls[0][0]
      expect(savedData.password).not.toBe('plain123')
      expect(savedData.password).toMatch(/^\$2b\$/)
    })

    it('devuelve el usuario creado', async () => {
      mockDAO.findByEmail.mockResolvedValue(null)
      mockDAO.create.mockResolvedValue({ _id: '1', email: 'b@b.com', role: 'user' })
      const result = await manager.register({ email: 'b@b.com', password: 'pass' })
      expect(result.email).toBe('b@b.com')
    })
  })

  describe('findOrCreateGithub', () => {
    it('retorna usuario existente si githubId ya está registrado', async () => {
      const existing = { _id: '1', githubId: 'gh123' }
      mockDAO.findByGithubId.mockResolvedValue(existing)
      const result = await manager.findOrCreateGithub({ githubId: 'gh123' })
      expect(mockDAO.create).not.toHaveBeenCalled()
      expect(result).toBe(existing)
    })

    it('crea usuario nuevo si githubId no existe', async () => {
      mockDAO.findByGithubId.mockResolvedValue(null)
      mockDAO.create.mockResolvedValue({ _id: '2', githubId: 'gh456' })
      const result = await manager.findOrCreateGithub({ githubId: 'gh456', email: 'g@g.com' })
      expect(mockDAO.create).toHaveBeenCalledWith(
        expect.objectContaining({ githubId: 'gh456', provider: 'github' })
      )
      expect(result.githubId).toBe('gh456')
    })
  })

  describe('findOrCreateGoogle', () => {
    it('retorna usuario existente si googleId ya está registrado', async () => {
      const existing = { _id: '3', googleId: 'goo123' }
      mockDAO.findByGoogleId.mockResolvedValue(existing)
      const result = await manager.findOrCreateGoogle({ googleId: 'goo123' })
      expect(mockDAO.create).not.toHaveBeenCalled()
      expect(result).toBe(existing)
    })

    it('crea usuario nuevo si googleId no existe', async () => {
      mockDAO.findByGoogleId.mockResolvedValue(null)
      mockDAO.create.mockResolvedValue({ _id: '4', googleId: 'goo789' })
      await manager.findOrCreateGoogle({ googleId: 'goo789', email: 'gg@gg.com' })
      expect(mockDAO.create).toHaveBeenCalledWith(
        expect.objectContaining({ googleId: 'goo789', provider: 'google' })
      )
    })
  })
})
