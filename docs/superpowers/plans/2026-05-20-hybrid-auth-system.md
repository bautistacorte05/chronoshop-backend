# Sistema de Autenticación Híbrido — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender ChronoShop con autenticación híbrida: Local + OAuth (GitHub/Google), JWT en cookie httpOnly, y sesiones con connect-mongo, protegiendo rutas por rol (admin/user).

**Architecture:** Se agregan capas `strategies/`, `controllers/`, `middlewares/` y `config/` sobre el patrón DAO/Manager existente. Las rutas `/api/v1/auth/*` emiten JWT; las rutas de vistas `/login`, `/register` y `/auth/*/callback` usan Passport con sesión. Ambos mecanismos coexisten en la misma app.

**Tech Stack:** passport, passport-local, passport-github2, passport-google-oauth2, express-session, connect-mongo, jsonwebtoken, bcrypt, cookie-parser, vitest (tests)

---

## Mapa de archivos

| Acción | Archivo | Responsabilidad |
|--------|---------|-----------------|
| Crear | `src/models/User.js` | Esquema Mongoose de usuario |
| Crear | `src/dao/mongo/UserMongoDAO.js` | CRUD de usuarios en MongoDB |
| Crear | `src/managers/UserManager.js` | Lógica de negocio: registro, búsqueda |
| Crear | `src/strategies/local.strategy.js` | Passport LocalStrategy (factory) |
| Crear | `src/strategies/github.strategy.js` | Passport GitHubStrategy (factory) |
| Crear | `src/strategies/google.strategy.js` | Passport GoogleStrategy (factory) |
| Crear | `src/config/passport.config.js` | Registra estrategias y serialize/deserialize |
| Crear | `src/middlewares/authJWT.js` | Verifica cookie authToken o Bearer header |
| Crear | `src/middlewares/authRole.js` | Verifica role === 'admin' |
| Crear | `src/controllers/auth.controller.js` | Handlers: register, login, logout, session, profile, admin |
| Crear | `src/routes/api/auth.router.js` | Monta /api/v1/auth/* + /api/v1/session/profile/admin |
| Crear | `src/routes/views/auth.router.js` | Monta /login, /register, /auth/github, /auth/google |
| Crear | `src/views/login.handlebars` | Formulario de login + links OAuth |
| Crear | `src/views/register.handlebars` | Formulario de registro |
| Crear | `tests/managers/UserManager.test.js` | Tests unitarios de UserManager |
| Crear | `tests/middlewares/authJWT.test.js` | Tests unitarios de authJWT |
| Crear | `tests/middlewares/authRole.test.js` | Tests unitarios de authRole |
| Crear | `vitest.config.js` | Configuración de Vitest |
| Modificar | `app.js` | Agregar cookieParser, session, passport, auth routes, UserManager |
| Modificar | `package.json` | Agregar deps, script test |
| Modificar | `.env` / `.env.example` | Agregar SESSION_SECRET, JWT_SECRET, OAuth keys |
| Modificar | `src/routes/api/products.router.js` | Proteger POST/PUT/DELETE con authJWT + authAdmin |

---

## Task 1: Instalar dependencias y configurar entorno

**Files:**
- Modify: `package.json`
- Modify: `.env`
- Modify: `.env.example`
- Create: `vitest.config.js`

- [ ] **Paso 1: Instalar dependencias de producción**

```bash
npm install passport passport-local passport-github2 passport-google-oauth2 express-session connect-mongo jsonwebtoken bcrypt cookie-parser
```

Resultado esperado: las 9 dependencias aparecen en `node_modules` sin errores.

- [ ] **Paso 2: Instalar Vitest como devDependency**

```bash
npm install -D vitest
```

- [ ] **Paso 3: Agregar script test en package.json**

Abrir `package.json` y reemplazar el bloque `"scripts"`:
```json
"scripts": {
  "start": "node app.js",
  "dev": "node --watch app.js",
  "seed": "node seed.js",
  "test": "vitest run"
}
```

- [ ] **Paso 4: Crear vitest.config.js**

```js
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'node' }
})
```

- [ ] **Paso 5: Agregar variables en .env**

Añadir al final del archivo `.env` existente:
```
SESSION_SECRET=s3cr3t_session_super_largo_cambiar_en_prod
JWT_SECRET=s3cr3t_jwt_super_largo_cambiar_en_prod
JWT_EXPIRATION=1h
BCRYPT_ROUNDS=10
NODE_ENV=development

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:8080/auth/github/callback

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback
```

- [ ] **Paso 6: Actualizar .env.example**

Reemplazar el contenido completo de `.env.example`:
```env
# Servidor
PORT=8080
NODE_ENV=development

# Base de datos
MONGODB_URI=mongodb://localhost:27017/ecommerce
PERSISTENCE=mongo

# Sesiones
SESSION_SECRET=reemplazar_con_string_aleatorio_largo

# JWT
JWT_SECRET=reemplazar_con_string_aleatorio_largo
JWT_EXPIRATION=1h
BCRYPT_ROUNDS=10

# OAuth GitHub (crear en https://github.com/settings/developers)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:8080/auth/github/callback

# OAuth Google (crear en https://console.cloud.google.com)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback
```

- [ ] **Paso 7: Commit**

```bash
git add package.json package-lock.json vitest.config.js .env.example
git commit -m "chore: add auth dependencies, vitest, and env config"
```

---

## Task 2: Modelo User

**Files:**
- Create: `src/models/User.js`

- [ ] **Paso 1: Crear directorio si no existe**

```bash
ls src/models/
```
El directorio ya existe (tiene `Product.js` y `Cart.js`).

- [ ] **Paso 2: Crear src/models/User.js**

```js
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
```

- [ ] **Paso 3: Commit**

```bash
git add src/models/User.js
git commit -m "feat: add User mongoose model with local and OAuth fields"
```

---

## Task 3: UserMongoDAO

**Files:**
- Create: `src/dao/mongo/UserMongoDAO.js`

- [ ] **Paso 1: Crear src/dao/mongo/UserMongoDAO.js**

```js
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
```

- [ ] **Paso 2: Commit**

```bash
git add src/dao/mongo/UserMongoDAO.js
git commit -m "feat: add UserMongoDAO with email, id, github and google lookups"
```

---

## Task 4: UserManager + tests

**Files:**
- Create: `src/managers/UserManager.js`
- Create: `tests/managers/UserManager.test.js`

- [ ] **Paso 1: Crear tests/managers/UserManager.test.js**

```bash
mkdir -p tests/managers
```

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserManager } from '../../src/managers/UserManager.js'

describe('UserManager', () => {
  let mockDAO, manager

  beforeEach(() => {
    mockDAO = {
      findByEmail:   vi.fn(),
      create:        vi.fn(),
      findById:      vi.fn(),
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
```

- [ ] **Paso 2: Ejecutar test y verificar que falla**

```bash
npm test
```
Resultado esperado: `Cannot find module '../../src/managers/UserManager.js'`

- [ ] **Paso 3: Crear src/managers/UserManager.js**

```js
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
```

- [ ] **Paso 4: Ejecutar tests y verificar que pasan**

```bash
npm test
```
Resultado esperado:
```
✓ tests/managers/UserManager.test.js (6)
  ✓ UserManager > register > lanza EMAIL_TAKEN si el email ya existe
  ✓ UserManager > register > hashea la contraseña antes de guardar
  ✓ UserManager > register > devuelve el usuario creado
  ✓ UserManager > findOrCreateGithub > retorna usuario existente ...
  ✓ UserManager > findOrCreateGithub > crea usuario nuevo ...
  ✓ UserManager > findOrCreateGoogle > ...
```

- [ ] **Paso 5: Commit**

```bash
git add src/managers/UserManager.js tests/managers/UserManager.test.js
git commit -m "feat: add UserManager with register, findOrCreate (GitHub/Google)"
```

---

## Task 5: Middleware authJWT + tests

**Files:**
- Create: `src/middlewares/authJWT.js`
- Create: `tests/middlewares/authJWT.test.js`

- [ ] **Paso 1: Crear tests/middlewares/authJWT.test.js**

```bash
mkdir -p tests/middlewares
```

```js
import { describe, it, expect, vi } from 'vitest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_jwt'

const { authJWT } = await import('../../src/middlewares/authJWT.js')

describe('authJWT', () => {
  const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() })
  const next = vi.fn()

  it('devuelve 401 si no hay token', () => {
    const req = { cookies: {}, headers: {} }
    authJWT(req, makeRes(), next)
    expect(makeRes().status).not.toHaveBeenCalled()
  })

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
```

- [ ] **Paso 2: Ejecutar tests y verificar que fallan**

```bash
npm test tests/middlewares/authJWT.test.js
```
Resultado esperado: `Cannot find module '../../src/middlewares/authJWT.js'`

- [ ] **Paso 3: Crear src/middlewares/authJWT.js**

```js
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
```

- [ ] **Paso 4: Ejecutar tests y verificar que pasan**

```bash
npm test tests/middlewares/authJWT.test.js
```
Resultado esperado: 5 tests pasando.

- [ ] **Paso 5: Commit**

```bash
git add src/middlewares/authJWT.js tests/middlewares/authJWT.test.js
git commit -m "feat: add authJWT middleware with cookie and Bearer header support"
```

---

## Task 6: Middleware authRole + tests

**Files:**
- Create: `src/middlewares/authRole.js`
- Create: `tests/middlewares/authRole.test.js`

- [ ] **Paso 1: Crear tests/middlewares/authRole.test.js**

```js
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
```

- [ ] **Paso 2: Ejecutar test y verificar que falla**

```bash
npm test tests/middlewares/authRole.test.js
```

- [ ] **Paso 3: Crear src/middlewares/authRole.js**

```js
export const authAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' })
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' })
  next()
}
```

- [ ] **Paso 4: Ejecutar tests y verificar que pasan**

```bash
npm test tests/middlewares/authRole.test.js
```
Resultado esperado: 3 tests pasando.

- [ ] **Paso 5: Ejecutar todos los tests**

```bash
npm test
```
Resultado esperado: todos los tests del proyecto pasando (9 en total).

- [ ] **Paso 6: Commit**

```bash
git add src/middlewares/authRole.js tests/middlewares/authRole.test.js
git commit -m "feat: add authAdmin middleware with 401/403 handling"
```

---

## Task 7: Local Passport Strategy

**Files:**
- Create: `src/strategies/local.strategy.js`

- [ ] **Paso 1: Crear directorio**

```bash
mkdir -p src/strategies
```

- [ ] **Paso 2: Crear src/strategies/local.strategy.js**

```js
import { Strategy as LocalStrategy } from 'passport-local'
import bcrypt from 'bcrypt'

export const makeLocalStrategy = (userManager) =>
  new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await userManager.findByEmail(email)
        if (!user || user.provider !== 'local') return done(null, false)
        const match = await bcrypt.compare(password, user.password)
        if (!match) return done(null, false)
        done(null, user)
      } catch (err) {
        done(err)
      }
    }
  )
```

- [ ] **Paso 3: Commit**

```bash
git add src/strategies/local.strategy.js
git commit -m "feat: add Passport LocalStrategy factory with bcrypt verification"
```

---

## Task 8: GitHub Passport Strategy

**Files:**
- Create: `src/strategies/github.strategy.js`

- [ ] **Paso 1: Crear src/strategies/github.strategy.js**

```js
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
```

- [ ] **Paso 2: Commit**

```bash
git add src/strategies/github.strategy.js
git commit -m "feat: add Passport GitHubStrategy with findOrCreate"
```

---

## Task 9: Google Passport Strategy

**Files:**
- Create: `src/strategies/google.strategy.js`

- [ ] **Paso 1: Crear src/strategies/google.strategy.js**

```js
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
```

- [ ] **Paso 2: Commit**

```bash
git add src/strategies/google.strategy.js
git commit -m "feat: add Passport GoogleStrategy with findOrCreate"
```

---

## Task 10: Configuración de Passport

**Files:**
- Create: `src/config/passport.config.js`

- [ ] **Paso 1: Crear directorio**

```bash
mkdir -p src/config
```

- [ ] **Paso 2: Crear src/config/passport.config.js**

```js
import passport from 'passport'
import { makeLocalStrategy }  from '../strategies/local.strategy.js'
import { makeGithubStrategy } from '../strategies/github.strategy.js'
import { makeGoogleStrategy } from '../strategies/google.strategy.js'

export const configurePassport = (userManager) => {
  passport.serializeUser((user, done) => done(null, user._id.toString()))

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await userManager.findById(id)
      done(null, user)
    } catch (err) {
      done(err)
    }
  })

  passport.use(makeLocalStrategy(userManager))
  passport.use(makeGithubStrategy(userManager))
  passport.use(makeGoogleStrategy(userManager))
}
```

- [ ] **Paso 3: Commit**

```bash
git add src/config/passport.config.js
git commit -m "feat: add configurePassport factory registering all 3 strategies"
```

---

## Task 11: Auth Controller

**Files:**
- Create: `src/controllers/auth.controller.js`

- [ ] **Paso 1: Crear directorio**

```bash
mkdir -p src/controllers
```

- [ ] **Paso 2: Crear src/controllers/auth.controller.js**

```js
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
      user: { id: req.user._id, email: req.user.email, role: req.user.role }
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
```

- [ ] **Paso 3: Commit**

```bash
git add src/controllers/auth.controller.js
git commit -m "feat: add makeAuthController with register, login, logout, session, profile, admin"
```

---

## Task 12: API Auth Router

**Files:**
- Create: `src/routes/api/auth.router.js`

- [ ] **Paso 1: Crear src/routes/api/auth.router.js**

```js
import { Router } from 'express'
import passport from 'passport'
import { makeAuthController } from '../../controllers/auth.controller.js'
import { authJWT } from '../../middlewares/authJWT.js'
import { authAdmin } from '../../middlewares/authRole.js'

export const createAuthApiRouter = (userManager) => {
  const router = Router()
  const ctrl = makeAuthController(userManager)

  router.post('/auth/register', ctrl.register)

  router.post(
    '/auth/login',
    passport.authenticate('local', { session: true }),
    ctrl.loginLocal
  )

  router.post('/auth/logout', ctrl.logout)

  router.get('/session', ctrl.getSession)

  router.get('/profile', authJWT, ctrl.getProfile)

  router.get('/admin', authJWT, authAdmin, ctrl.getAdmin)

  return router
}
```

- [ ] **Paso 2: Commit**

```bash
git add src/routes/api/auth.router.js
git commit -m "feat: add API auth router mounting /api/v1/auth/* and protected routes"
```

---

## Task 13: OAuth Router (vistas)

**Files:**
- Create: `src/routes/views/auth.router.js`

- [ ] **Paso 1: Crear src/routes/views/auth.router.js**

```js
import { Router } from 'express'
import passport from 'passport'
import { makeAuthController } from '../../controllers/auth.controller.js'

export const createAuthViewRouter = (userManager) => {
  const router = Router()
  const ctrl = makeAuthController(userManager)

  router.get('/login',    (req, res) => res.render('login'))
  router.get('/register', (req, res) => res.render('register'))

  router.get('/auth/github',
    passport.authenticate('github', { scope: ['user:email'] })
  )

  router.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/login', session: true }),
    ctrl.oauthCallback
  )

  router.get('/auth/google',
    passport.authenticate('google', { scope: ['email', 'profile'] })
  )

  router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login', session: true }),
    ctrl.oauthCallback
  )

  return router
}
```

- [ ] **Paso 2: Commit**

```bash
git add src/routes/views/auth.router.js
git commit -m "feat: add view auth router with OAuth callbacks and login/register views"
```

---

## Task 14: Actualizar app.js

**Files:**
- Modify: `app.js`

- [ ] **Paso 1: Leer el estado actual de app.js**

```bash
cat app.js
```
Confirmar que el archivo tiene las importaciones conocidas (express, mongoose, routers de products y carts).

- [ ] **Paso 2: Agregar las nuevas importaciones al inicio de app.js**

Después de la última línea de imports existente (línea 19 `import { createCartsViewRouter }`), agregar:

```js
import cookieParser from 'cookie-parser'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import passport from 'passport'
import { UserMongoDAO }         from './src/dao/mongo/UserMongoDAO.js'
import { UserManager }          from './src/managers/UserManager.js'
import { configurePassport }    from './src/config/passport.config.js'
import { createAuthApiRouter }  from './src/routes/api/auth.router.js'
import { createAuthViewRouter } from './src/routes/views/auth.router.js'
```

- [ ] **Paso 3: Agregar cookie-parser y session DESPUÉS de express.urlencoded (línea 29), ANTES del engine de Handlebars**

Reemplazar el bloque:
```js
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src/public')));
```

Por:
```js
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src/public')));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    maxAge: 3600000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));
app.use(passport.initialize());
app.use(passport.session());
```

- [ ] **Paso 4: Agregar UserMongoDAO, UserManager y configurePassport después de cartManager (línea 44)**

Después de `const cartManager = new CartManager(cartDAO);`, agregar:
```js
const userDAO     = new UserMongoDAO();
const userManager = new UserManager(userDAO);
configurePassport(userManager);
```

- [ ] **Paso 5: Montar los nuevos routers ANTES del `app.get('/')`**

Después de `app.use('/carts', createCartsViewRouter(cartManager));`, agregar:
```js
app.use('/api/v1', createAuthApiRouter(userManager));
app.use('/',       createAuthViewRouter(userManager));
```

- [ ] **Paso 6: Iniciar el servidor y verificar que arranca sin errores**

```bash
npm run dev
```
Resultado esperado:
```
MongoDB conectado
Servidor corriendo en http://localhost:8080
```
Sin errores de importación ni de módulos faltantes.

- [ ] **Paso 7: Probar el endpoint de registro con curl**

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@test.com","password":"test1234"}' | jq .
```
Resultado esperado:
```json
{
  "message": "Usuario registrado correctamente",
  "user": { "_id": "...", "email": "test@test.com", "role": "user" }
}
```

- [ ] **Paso 8: Probar el endpoint de login**

```bash
curl -s -c cookies.txt -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234"}' | jq .
```
Resultado esperado: `{ "message": "Login exitoso", "token": "eyJ...", "user": {...} }`

- [ ] **Paso 9: Probar /api/v1/profile con el token**

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234"}' | jq -r '.token')
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/profile | jq .
```
Resultado esperado: datos del usuario logueado.

- [ ] **Paso 10: Probar /api/v1/admin con usuario no-admin (debe dar 403)**

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/admin | jq .
```
Resultado esperado: `{ "error": "Acceso denegado" }`

- [ ] **Paso 11: Commit**

```bash
git add app.js
git commit -m "feat: integrate auth middleware, session, passport and auth routes in app.js"
```

---

## Task 15: Vistas Handlebars (login y register)

**Files:**
- Create: `src/views/login.handlebars`
- Create: `src/views/register.handlebars`

- [ ] **Paso 1: Crear src/views/login.handlebars**

```html
<div class="auth-container">
  <h2>Iniciar Sesión</h2>
  <p id="error-msg" class="error-msg"></p>

  <form id="loginForm">
    <label>Email</label>
    <input type="email" name="email" required placeholder="tu@email.com">
    <label>Contraseña</label>
    <input type="password" name="password" required placeholder="Contraseña">
    <button type="submit">Ingresar</button>
  </form>

  <div class="oauth-links">
    <a href="/auth/github" class="btn-oauth btn-github">Continuar con GitHub</a>
    <a href="/auth/google" class="btn-oauth btn-google">Continuar con Google</a>
  </div>

  <p>¿No tenés cuenta? <a href="/register">Registrate</a></p>
</div>

<script>
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.target))
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      window.location.href = '/products'
    } else {
      const { error } = await res.json()
      document.getElementById('error-msg').textContent = error
    }
  })
</script>
```

- [ ] **Paso 2: Crear src/views/register.handlebars**

```html
<div class="auth-container">
  <h2>Crear Cuenta</h2>
  <p id="error-msg" class="error-msg"></p>

  <form id="registerForm">
    <label>Nombre</label>
    <input type="text" name="firstName" placeholder="Nombre">
    <label>Apellido</label>
    <input type="text" name="lastName" placeholder="Apellido">
    <label>Email</label>
    <input type="email" name="email" required placeholder="tu@email.com">
    <label>Contraseña</label>
    <input type="password" name="password" required placeholder="Mínimo 6 caracteres">
    <button type="submit">Registrarse</button>
  </form>

  <p>¿Ya tenés cuenta? <a href="/login">Iniciá sesión</a></p>
</div>

<script>
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.target))
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      window.location.href = '/login'
    } else {
      const { error } = await res.json()
      document.getElementById('error-msg').textContent = error
    }
  })
</script>
```

- [ ] **Paso 3: Verificar que las vistas renderizan en el navegador**

Con el servidor corriendo, abrir `http://localhost:8080/login` y `http://localhost:8080/register`. Deben mostrar los formularios sin errores 500.

- [ ] **Paso 4: Commit**

```bash
git add src/views/login.handlebars src/views/register.handlebars
git commit -m "feat: add login and register Handlebars views with fetch-based form submission"
```

---

## Task 16: Proteger rutas existentes de productos

**Files:**
- Modify: `src/routes/api/products.router.js`

- [ ] **Paso 1: Leer el estado actual de products.router.js**

```bash
cat src/routes/api/products.router.js
```

- [ ] **Paso 2: Agregar importaciones de middlewares al inicio del archivo**

Después de la línea `import { Router } from 'express'` (o de `express`), agregar:
```js
import { authJWT }   from '../../middlewares/authJWT.js'
import { authAdmin } from '../../middlewares/authRole.js'
```

- [ ] **Paso 3: Agregar authJWT + authAdmin a las rutas de escritura**

En las rutas `POST /`, `PUT /:pid` y `DELETE /:pid`, agregar los middlewares antes del handler:

```js
// Antes (ejemplo de POST):
router.post('/', async (req, res) => { ... })

// Después:
router.post('/', authJWT, authAdmin, async (req, res) => { ... })
router.put('/:pid', authJWT, authAdmin, async (req, res) => { ... })
router.delete('/:pid', authJWT, authAdmin, async (req, res) => { ... })
```

Los `GET` no requieren autenticación.

- [ ] **Paso 4: Verificar que GET /api/products sigue funcionando sin token**

```bash
curl -s http://localhost:8080/api/products | jq '.payload | length'
```
Resultado esperado: número de productos (ej. `10`).

- [ ] **Paso 5: Verificar que POST /api/products da 401 sin token**

```bash
curl -s -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"d","code":"T001","price":100,"stock":5,"category":"relojes"}' | jq .
```
Resultado esperado: `{ "error": "No autenticado" }`

- [ ] **Paso 6: Verificar que POST da 403 con token de usuario no-admin**

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234"}' | jq -r '.token')

curl -s -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test","description":"d","code":"T001","price":100,"stock":5,"category":"relojes"}' | jq .
```
Resultado esperado: `{ "error": "Acceso denegado" }`

- [ ] **Paso 7: Ejecutar todos los tests para verificar que nada se rompió**

```bash
npm test
```
Resultado esperado: todos los tests pasando.

- [ ] **Paso 8: Commit**

```bash
git add src/routes/api/products.router.js
git commit -m "feat: protect product write routes with authJWT + authAdmin middleware"
```

---

## Self-Review del Plan

**Cobertura del spec:**

| Requisito | Task |
|-----------|------|
| POST /api/v1/auth/register con bcrypt y 409 | Task 11, 12 |
| POST /api/v1/auth/login con JWT en body + cookie authToken | Task 11, 12 |
| cookie httpOnly, sameSite Lax, secure en prod | Task 11 |
| JWT payload { userId, role }, expiración 1h | Task 11 |
| LocalStrategy con bcrypt.compare | Task 7 |
| GitHubStrategy con findOrCreate | Task 8 |
| GoogleStrategy con findOrCreate | Task 9 |
| passport.serializeUser / deserializeUser | Task 10 |
| express-session + connect-mongo | Task 14 |
| GET /api/v1/session | Task 12 |
| GET /api/v1/profile protegida por JWT | Task 12 |
| GET /api/v1/admin protegida por JWT + rol | Task 12 |
| 401 sin token, 403 sin rol | Task 5, 6, 16 |
| POST /api/v1/auth/logout (session.destroy + clearCookie) | Task 11, 12 |
| Modelo User (email, password, role, provider, ids) | Task 2 |
| DAO y Manager por capas | Task 3, 4 |
| Vistas login.handlebars y register.handlebars | Task 15 |
| Protección rutas productos (POST/PUT/DELETE) | Task 16 |

**Tipos consistentes en todo el plan:**
- `makeAuthController(userManager)` → Tasks 11, 12, 13
- `createAuthApiRouter(userManager)` → Tasks 12, 14
- `createAuthViewRouter(userManager)` → Tasks 13, 14
- `req.user.userId` (JWT payload) en `getProfile` → Task 11
- `req.user._id` (documento Mongoose) en `getSession`, `loginLocal`, `oauthCallback` → Task 11

**Placeholders:** ninguno.
