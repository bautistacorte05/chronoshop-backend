# Sistema de Autenticación Híbrido con Node.js
## Documentación Técnica — Backend 2

**Proyecto:** ChronoShop Backend  
**Alumno:** Bautista Cortez Pincha  
**Repositorio:** https://github.com/bautistacorte05/chronoshop-backend  
**Fecha:** 2026-05-20  

---

## 1. Presentación del Proyecto

### 1.1 Descripción general

ChronoShop es un e-commerce de relojes construido con Node.js, Express y MongoDB. A partir del proyecto de Backend 1 (que implementaba gestión de productos y carritos con arquitectura por capas DAO/Manager), en esta entrega se extiende el sistema agregando un **sistema de autenticación híbrido** que combina tres mecanismos:

- **Autenticación Local**: registro y login con email/contraseña usando bcrypt para hashing y Passport.js como middleware.
- **OAuth 2.0**: login social mediante GitHub y Google usando estrategias de Passport.
- **JWT + Sesiones coexistentes**: al autenticarse, el servidor emite simultáneamente un **token JWT** (en body y en cookie `authToken` httpOnly) y crea una **sesión** en MongoDB (via connect-mongo). Ambos mecanismos conviven.

### 1.2 Objetivo arquitectónico

Demostrar que JWT y sesiones no son mutuamente excluyentes. Las rutas de la API REST usan el JWT (stateless, escalable), mientras que las vistas SSR (Handlebars) usan la sesión de Passport (stateful, con persistencia en MongoDB). El resultado es un sistema donde un cliente browser navega con sesión y un cliente API consume con Bearer token.

### 1.3 Estrategias de autenticación implementadas

| Estrategia | Mecanismo | Librería |
|------------|-----------|---------|
| Local | Email + contraseña (bcrypt) | passport-local |
| GitHub OAuth | OAuth 2.0 con código de autorización | passport-github2 |
| Google OAuth | OAuth 2.0 con OpenID Connect | passport-google-oauth2 |

### 1.4 Justificación del enfoque

Se eligió el enfoque híbrido porque ChronoShop ya tenía dos capas diferenciadas desde Backend 1: rutas API (`/api/*`) y rutas de vistas (`/products`, `/carts`). Cada canal se beneficia de un mecanismo distinto. El JWT en cookie httpOnly mitiga XSS (el script no puede leer la cookie), y `sameSite: 'Lax'` mitiga CSRF sin romper los redirects de OAuth.

---

## 2. Arquitectura del Proyecto

### 2.1 Estructura de carpetas completa

```
chronoshop-backend/
├── app.js                              ← Entry point: Express + middlewares globales
├── seed.js                             ← Script de carga inicial de productos
├── package.json
├── .env.example
├── vitest.config.js
│
└── src/
    ├── config/
    │   └── passport.config.js          ← configurePassport(userManager): registra las 3 estrategias
    │
    ├── models/
    │   ├── Product.js                  ← Esquema Mongoose de producto (existente)
    │   ├── Cart.js                     ← Esquema Mongoose de carrito (existente)
    │   └── User.js                     ← NUEVO: email, password, role, provider, githubId, googleId
    │
    ├── dao/
    │   └── mongo/
    │       ├── ProductMongoDAO.js      ← (existente)
    │       ├── CartMongoDAO.js         ← (existente)
    │       └── UserMongoDAO.js         ← NUEVO: create, findByEmail, findById, findByGithubId, findByGoogleId
    │
    ├── managers/
    │   ├── ProductManager.js           ← (existente)
    │   ├── CartManager.js              ← (existente)
    │   └── UserManager.js             ← NUEVO: register (bcrypt), findOrCreateGithub, findOrCreateGoogle
    │
    ├── strategies/
    │   ├── local.strategy.js           ← NUEVO: makeLocalStrategy(userManager)
    │   ├── github.strategy.js          ← NUEVO: makeGithubStrategy(userManager)
    │   └── google.strategy.js          ← NUEVO: makeGoogleStrategy(userManager)
    │
    ├── controllers/
    │   └── auth.controller.js          ← NUEVO: makeAuthController(userManager) con 6 handlers
    │
    ├── middlewares/
    │   ├── authJWT.js                  ← NUEVO: verifica cookie authToken o Bearer header
    │   └── authRole.js                 ← NUEVO: authAdmin — 401 sin user, 403 sin rol
    │
    ├── routes/
    │   ├── api/
    │   │   ├── products.router.js      ← Modificado: POST/PUT/DELETE protegidos con JWT + admin
    │   │   ├── carts.router.js         ← (existente)
    │   │   └── auth.router.js          ← NUEVO: /api/v1/auth/*, /api/v1/session, /profile, /admin
    │   └── views/
    │       ├── products.router.js      ← (existente)
    │       ├── carts.router.js         ← (existente)
    │       └── auth.router.js          ← NUEVO: /login, /register, /auth/github, /auth/google
    │
    ├── views/
    │   ├── layouts/main.handlebars     ← (existente)
    │   ├── products.handlebars         ← (existente)
    │   ├── cart.handlebars             ← (existente)
    │   ├── login.handlebars            ← NUEVO
    │   └── register.handlebars         ← NUEVO
    │
    └── public/                         ← (existente)
```

### 2.2 Explicación de cada capa

**`config/`**  
Centraliza la configuración de Passport. `passport.config.js` exporta `configurePassport(userManager)` que registra `serializeUser`, `deserializeUser` y las tres estrategias. Se ejecuta una única vez al iniciar la app, antes de montar las rutas.

**`models/`**  
Esquemas Mongoose. `User.js` define los campos del usuario con soporte para autenticación local y OAuth. El campo `provider` indica el origen del registro (`local`, `github`, `google`). Los campos `githubId` y `googleId` son nulos para usuarios locales.

**`dao/`**  
Objetos de acceso a datos: operaciones de base de datos atómicas sin lógica de negocio. `UserMongoDAO` ofrece cinco métodos de consulta. No sabe nada de bcrypt ni de validaciones.

**`managers/`**  
Capa de lógica de negocio. `UserManager` orquesta registro (verifica duplicados, hashea contraseña, persiste), búsquedas por distintos identificadores y el patrón `findOrCreate` para OAuth.

**`strategies/`**  
Una estrategia de Passport por archivo, implementadas como factories que reciben `userManager` como dependencia. Esto las hace testeables independientemente de la base de datos.

**`controllers/`**  
Funciones de manejo de request/response. `auth.controller.js` exporta `makeAuthController(userManager)` que retorna un objeto con los seis handlers. No accede a la base de datos directamente — delega a `userManager`.

**`middlewares/`**  
Funciones puras encadenables antes de los controllers. `authJWT` verifica el token JWT (sin DB). `authAdmin` verifica el rol (sin DB). El orden importa: `authJWT` siempre va antes de `authAdmin`.

**`routes/`**  
Solo mapeo de URLs a middleware chains y controllers. No contiene lógica de negocio.

### 2.3 Diagrama del flujo de autenticación

```
CLIENTE (browser o API client)
         │
         ├─── POST /api/v1/auth/login ────────────────────────────────────┐
         │    { email, password }                                          │
         │         │                                                       │
         │    passport.authenticate('local', { session: true })            │
         │         │                                                       │
         │    LocalStrategy ──► bcrypt.compare() ──► done(null, user)     │
         │         │                                                       │
         │    req.login(user) ──► serializeUser ──► SESSION en MongoDB    │
         │         │                                                       │
         │    ctrl.loginLocal:                                             │
         │    ├── jwt.sign({ userId, role }, JWT_SECRET, 1h)              │
         │    ├── res.cookie('authToken', token, { httpOnly, sameSite })  │
         │    └── res.json({ message, token, user })  ◄──────────────────┘
         │
         ├─── GET /auth/github ──► GitHub OAuth consent
         │         │
         │    callback: GitHubStrategy
         │    ├── findByGithubId(profile.id)
         │    ├── si no existe: User.create({ ...profile, provider:'github' })
         │    ├── req.login(user) ──► sesión
         │    └── generar JWT + cookie ──► redirect /products
         │
         └─── GET /api/v1/profile  (ruta protegida)
                   │
              authJWT middleware:
              ├── token = req.cookies.authToken || Bearer header
              ├── jwt.verify(token, JWT_SECRET) ──► payload { userId, role }
              ├── req.user = payload
              └── next()
                   │
              authAdmin middleware (solo /admin):
              ├── req.user.role !== 'admin' ──► 403
              └── next()
                   │
              controller ──► res.json(data)
```

---

## 3. Implementación Técnica

### 3.1 Registro de Usuario

**Endpoint:** `POST /api/v1/auth/register`

#### Modelo User (src/models/User.js)

```js
import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  firstName: { type: String, trim: true },
  lastName:  { type: String, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, default: null },      // null para usuarios OAuth
  role:      { type: String, enum: ['user', 'admin'], default: 'user' },
  provider:  { type: String, enum: ['local', 'github', 'google'], default: 'local' },
  githubId:  { type: String, default: null },
  googleId:  { type: String, default: null },
  avatar:    { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
})

export default mongoose.model('User', userSchema)
```

#### Hash de contraseña con bcrypt (src/managers/UserManager.js)

```js
async register({ firstName, lastName, email, password }) {
  const exists = await this.dao.findByEmail(email)
  if (exists) throw new Error('EMAIL_TAKEN')
  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 10
  const hash = await bcrypt.hash(password, rounds)
  return this.dao.create({ firstName, lastName, email, password: hash, provider: 'local' })
}
```

El texto plano **nunca se almacena**. `bcrypt.hash` genera un hash con 10 salt rounds. El hash resultante tiene el formato `$2b$10$...` y es irreversible.

#### Validación de duplicados (src/controllers/auth.controller.js)

```js
register: async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña son requeridos' })
    if (password.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
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
}
```

#### Request y Response reales

**Request:**
```
POST /api/v1/auth/register
Content-Type: application/json

{
  "firstName": "María",
  "lastName": "García",
  "email": "maria@chronoshop.com",
  "password": "secure123"
}
```

**Response 201 — Registro exitoso:**
```json
{
    "message": "Usuario registrado correctamente",
    "user": {
        "_id": "6a0db79c6cfd596feab7b13d",
        "email": "maria@chronoshop.com",
        "role": "user"
    }
}
```

**Response 409 — Email duplicado:**
```json
{
    "error": "El email ya está registrado"
}
```

---

### 3.2 Login Local (Passport LocalStrategy)

**Endpoint:** `POST /api/v1/auth/login`

#### Configuración de Passport LocalStrategy (src/strategies/local.strategy.js)

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

`usernameField: 'email'` configura que Passport lea `req.body.email` en lugar del campo por defecto `username`. La estrategia rechaza usuarios OAuth (`user.provider !== 'local'`) para evitar que intenten loguear con una contraseña que nunca establecieron.

#### Generación del JWT (src/controllers/auth.controller.js)

```js
const generateToken = (user) =>
  jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION || '1h' }
  )
```

El payload contiene `userId` y `role`. La expiración se configura en `.env` como `JWT_EXPIRATION=1h`.

#### Envío del token: body + cookie (src/controllers/auth.controller.js)

```js
loginLocal: (req, res) => {
  const token = generateToken(req.user)
  // En cookie httpOnly (protegida contra XSS)
  res.cookie('authToken', token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 3600000
  })
  // También en body (para clientes API como Postman)
  res.json({
    message: 'Login exitoso',
    token,
    user: { _id: req.user._id, email: req.user.email, role: req.user.role }
  })
}
```

**El token viaja dos veces:**
1. **En el body JSON**: para clientes API, móviles, Postman.
2. **En la cookie `authToken`**: para el browser, de forma automática en cada request.

#### Request y Response reales

**Request:**
```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "maria@chronoshop.com",
  "password": "secure123"
}
```

**Response 200 — Login exitoso:**
```json
{
    "message": "Login exitoso",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTBkYjc5YzZjZmQ1OTZmZWFiN2IxM2QiLCJyb2xlIjoidXNlciIsImlhdCI6MTc3OTI4Mzg3NiwiZXhwIjoxNzc5Mjg3NDc2fQ.VaaQLMlN2H7LVLif8pXvofE4MGV25OIRXXwNAl2oL7Q",
    "user": {
        "_id": "6a0db79c6cfd596feab7b13d",
        "email": "maria@chronoshop.com",
        "role": "user"
    }
}
```

**Header Set-Cookie generado:**
```
Set-Cookie: authToken=eyJhbGci...; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600
Set-Cookie: connect.sid=s%3AFiVdATBs...; Path=/; HttpOnly; SameSite=Lax
```

**JWT Payload decodificado** (sección central del token, base64):
```json
{
    "userId": "6a0db79c6cfd596feab7b13d",
    "role": "user",
    "iat": 1779283876,
    "exp": 1779287476
}
```

---

### 3.3 Login OAuth (GitHub y Google)

**Endpoints:** `GET /auth/github`, `GET /auth/google`

#### Configuración de la estrategia GitHub (src/strategies/github.strategy.js)

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

#### Creación de usuario si no existe (src/managers/UserManager.js)

```js
async findOrCreateGithub({ githubId, firstName, email, avatar }) {
  let user = await this.dao.findByGithubId(githubId)
  if (!user) {
    user = await this.dao.create({
      githubId, firstName, email, avatar, provider: 'github'
    })
  }
  return user
}
```

La operación es **idempotente**: si el usuario ya existe (login previo con GitHub), se retorna el existente. Si es la primera vez, se crea con `provider: 'github'` y sin password.

#### Cómo se mantiene la sesión en OAuth

```js
// src/routes/views/auth.router.js
router.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login', session: true }),
  ctrl.oauthCallback  // emite JWT + cookie, luego redirect /products
)
```

```js
// src/controllers/auth.controller.js
oauthCallback: (req, res) => {
  const token = generateToken(req.user)  // req.user viene de Passport
  setAuthCookie(res, token)
  res.redirect('/products')
}
```

1. Passport llama `req.login(user)` automáticamente (por `session: true`), creando la sesión en MongoDB.
2. El callback `oauthCallback` emite adicionalmente el JWT en cookie.
3. El browser recibe las dos cookies (`authToken` y `connect.sid`) y es redirigido a `/products`.

#### Fragmentos de configuración en passport.config.js

```js
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
  // Solo registra OAuth si las credenciales están configuradas
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
    passport.use(makeGithubStrategy(userManager))
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    passport.use(makeGoogleStrategy(userManager))
}
```

La comprobación condicional evita que el servidor crashee si las credenciales OAuth no están configuradas (útil en entornos de desarrollo sin app registrada).

---

### 3.4 Sistema de Sesiones

#### Configuración de express-session + connect-mongo (app.js)

```js
import session from 'express-session'
import MongoStore from 'connect-mongo'

app.use(cookieParser())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    maxAge: 3600000,
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production'
  }
}))
app.use(passport.initialize())
app.use(passport.session())
```

`resave: false` y `saveUninitialized: false` evitan escribir sesiones vacías en MongoDB. El store persiste las sesiones en la colección `sessions` de la misma base de datos.

#### Ejemplo de documento de sesión en MongoDB

```json
{
  "_id": "FiVdATBszatnEkVV7Q1-XFNeouGSE8Je",
  "expires": { "$date": "2026-05-20T11:37:56.000Z" },
  "session": {
    "cookie": {
      "originalMaxAge": 3600000,
      "expires": "2026-05-20T11:37:56.141Z",
      "httpOnly": true,
      "sameSite": "Lax",
      "secure": false,
      "path": "/"
    },
    "passport": {
      "user": "6a0db79c6cfd596feab7b13d"
    }
  }
}
```

Solo se persiste el `_id` del usuario (serializado por `passport.serializeUser`). En cada request con session cookie válida, `deserializeUser` reconstruye el objeto completo desde MongoDB.

#### Endpoint GET /api/v1/session

```js
getSession: (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sin sesión activa' })
  res.json({
    sessionId: req.sessionID,
    user: { _id: req.user._id, email: req.user.email, role: req.user.role }
  })
}
```

**Response real — sesión activa:**
```json
{
    "sessionId": "FiVdATBszatnEkVV7Q1-XFNeouGSE8Je",
    "user": {
        "_id": "6a0db79c6cfd596feab7b13d",
        "email": "maria@chronoshop.com",
        "role": "user"
    }
}
```

---

### 3.5 Rutas Protegidas

#### GET /api/v1/profile — protegida por JWT

**Middleware authJWT (src/middlewares/authJWT.js):**
```js
import jwt from 'jsonwebtoken'

export const authJWT = (req, res, next) => {
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : undefined
  const token = req.cookies?.authToken || bearerToken
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload  // { userId, role, iat, exp }
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}
```

**Response real — con token válido (200):**
```json
{
    "user": {
        "_id": "6a0db79c6cfd596feab7b13d",
        "email": "maria@chronoshop.com",
        "role": "user",
        "firstName": "María",
        "lastName": "García"
    }
}
```

**Response real — sin token (401):**
```json
{
    "error": "No autenticado"
}
```

#### GET /api/v1/admin — protegida por JWT + rol

**Middleware authAdmin (src/middlewares/authRole.js):**
```js
export const authAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' })
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' })
  next()
}
```

**Montaje de la ruta:**
```js
router.get('/admin', authJWT, authAdmin, ctrl.getAdmin)
```

**Response real — usuario con role: 'user' (403):**
```json
{
    "error": "Acceso denegado"
}
```

**Tabla de respuestas de error de autenticación:**

| Caso | Status | Body |
|------|--------|------|
| Sin token | 401 | `{ "error": "No autenticado" }` |
| Token expirado o inválido | 401 | `{ "error": "Token inválido o expirado" }` |
| Token válido, rol insuficiente | 403 | `{ "error": "Acceso denegado" }` |

**Rutas y su protección:**

| Ruta | Método | Protección |
|------|--------|------------|
| `GET /api/products` | GET | Pública |
| `POST /api/products` | POST | authJWT + authAdmin |
| `PUT /api/products/:pid` | PUT | authJWT + authAdmin |
| `DELETE /api/products/:pid` | DELETE | authJWT + authAdmin |
| `GET /api/v1/session` | GET | Session (Passport) |
| `GET /api/v1/profile` | GET | authJWT |
| `GET /api/v1/admin` | GET | authJWT + authAdmin |

**Response real — POST /api/products sin token (401):**
```json
{
    "error": "No autenticado"
}
```

---

### 3.6 Logout

**Endpoint:** `POST /api/v1/auth/logout`

```js
logout: (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Error al cerrar sesión' })
    req.session.destroy((destroyErr) => {
      res.clearCookie('authToken')
      res.clearCookie('connect.sid')
      res.json({ message: 'Logout exitoso' })
    })
  })
}
```

**Secuencia de destrucción:**
1. `req.logout()` — Passport limpia `req.user` y elimina la referencia de la sesión.
2. `req.session.destroy()` — Elimina el documento de sesión de la colección `sessions` en MongoDB.
3. `res.clearCookie('authToken')` — El browser elimina la cookie JWT.
4. `res.clearCookie('connect.sid')` — El browser elimina la cookie de sesión.

> **Nota sobre el JWT:** Al ser stateless, el servidor no puede revocar un JWT ya emitido. El cliente browser lo pierde al eliminarse la cookie. Clientes que guardaron el token en memoria deben descartarlo ellos mismos. La expiración corta (1h) limita la ventana de exposición post-logout.

**Response real — Logout exitoso:**
```json
{
    "message": "Logout exitoso"
}
```

**Response real — GET /api/v1/session después del logout (401):**
```json
{
    "error": "Sin sesión activa"
}
```

---

## 4. Seguridad y Decisiones Arquitectónicas

### ¿Dónde vive el rol y por qué?

El rol vive en **dos lugares simultáneamente**:

1. **Base de datos** (`User.role`): fuente de verdad persistente, se actualiza cuando cambia.
2. **JWT payload** (`{ userId, role }`): copia inmutable hasta la expiración del token.

El middleware `authJWT` lee el rol desde el payload del JWT **sin consultar la base de datos**, haciendo la autorización O(1). La contrapartida es el siguiente punto.

### ¿Qué ocurre si el rol cambia con un token ya emitido?

Si se degrada un admin a usuario común, su JWT sigue teniendo `role: 'admin'` hasta expirar (máximo 1h). Durante ese período podría acceder a rutas de admin. Las mitigaciones aplicadas:

- **Expiración corta (1h)**: limita la ventana de riesgo sin infraestructura adicional.
- **Solución completa** (no implementada por complejidad): mantener una blacklist de tokens invalidados en Redis/MongoDB.

La expiración de 1h es el balance elegido para este proyecto entre seguridad y rendimiento.

### ¿Por qué cookie + JWT y no solo uno?

| Solo cookie de sesión | Solo JWT en localStorage | JWT en cookie httpOnly |
|----------------------|--------------------------|----------------------|
| Depende del servidor para cada request | Vulnerable a XSS (scripts pueden robarlo) | **Protegido contra XSS** (scripts no pueden leer cookies httpOnly) |
| No escala sin session store compartido | Escala bien | Escala bien con expiración |
| Logout inmediato | Logout requiere blacklist | Logout limpia cookie |

La combinación elegida da lo mejor de ambos mundos: el JWT viaja en una cookie que el browser gestiona automáticamente y el script nunca puede leer.

### ¿Cómo se mitigó CSRF?

Con `sameSite: 'Lax'` en la cookie `authToken`:
- `Strict` bloquearía los redirects de OAuth (GitHub/Google redirigen a nuestro callback), rompiendo el flujo de login social.
- `Lax` permite GET cross-site (necesario para OAuth callbacks) pero bloquea cookies en requests cross-site iniciados por `<form>`, `fetch` de terceros o `XMLHttpRequest`.
- Para mayor protección en producción se puede agregar `csurf` middleware.

### ¿Cómo difiere entorno local vs. producción?

| Configuración | Local | Producción |
|---------------|-------|------------|
| `cookie.secure` | `false` (HTTP) | `true` (solo HTTPS) |
| `NODE_ENV` | `development` | `production` |
| `MONGODB_URI` | `localhost:27017` | Atlas o instancia cloud |
| OAuth callbacks | `http://localhost:8080/...` | `https://dominio.com/...` |

La condición `secure: process.env.NODE_ENV === 'production'` en ambas cookies maneja la diferencia sin cambios de código.

---

## 5. Evidencia Real de Funcionamiento

Todas las capturas siguientes son peticiones reales contra el servidor corriendo en `http://localhost:8080` con MongoDB local, capturadas el **2026-06-04**. Se muestran los encabezados HTTP completos tal como los retorna el servidor (equivalente a la vista "Headers" de Postman).

---

### 5.1 Registro de usuario — `POST /api/v1/auth/register` → **201 Created**

**Request**
```
POST http://localhost:8080/api/v1/auth/register
Content-Type: application/json

{
  "firstName": "Carlos",
  "lastName": "Mendoza",
  "email": "carlos@chronoshop.com",
  "password": "segura123"
}
```

**Response — Headers**
```
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Content-Length: 134
Date: Thu, 04 Jun 2026 13:09:29 GMT
```

**Response — Body**
```json
{
    "message": "Usuario registrado correctamente",
    "user": {
        "_id": "6a2179098c01d00ef336e93c",
        "email": "carlos@chronoshop.com",
        "role": "user"
    }
}
```

---

### 5.2 Registro duplicado — `POST /api/v1/auth/register` → **409 Conflict**

**Request**
```
POST http://localhost:8080/api/v1/auth/register
Content-Type: application/json

{
  "email": "carlos@chronoshop.com",
  "password": "segura123"
}
```

**Response — Headers**
```
HTTP/1.1 409 Conflict
Content-Type: application/json; charset=utf-8
Content-Length: 40
Date: Thu, 04 Jun 2026 13:09:32 GMT
```

**Response — Body**
```json
{
    "error": "El email ya está registrado"
}
```

---

### 5.3 Login local (usuario) — `POST /api/v1/auth/login` → **200 OK**

**Request**
```
POST http://localhost:8080/api/v1/auth/login
Content-Type: application/json

{
  "email": "carlos@chronoshop.com",
  "password": "segura123"
}
```

**Response — Headers**
```
HTTP/1.1 200 OK
Set-Cookie: authToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTIxNzkwOThjMDFkMDBlZjMzNmU5M2MiLCJyb2xlIjoidXNlciIsImlhdCI6MTc4MDU3ODU4OCwiZXhwIjoxNzgwNTgyMTg4fQ.7Pr6TjwSdbkwqYbuonu3YYl6LebFXf9qMv66fe4zmJE; Max-Age=3600; Path=/; Expires=Thu, 04 Jun 2026 14:09:48 GMT; HttpOnly; SameSite=Lax
Set-Cookie: connect.sid=s%3Ah_m0VqysxOT-D4nkZIlbOVugcUhMEno_.dZ2EBPnvj0UaG9QlGcmS4FJ90sDeZ96LkDcO17FWmSg; Path=/; Expires=Thu, 04 Jun 2026 14:09:48 GMT; HttpOnly; SameSite=Lax
Content-Type: application/json; charset=utf-8
Date: Thu, 04 Jun 2026 13:09:48 GMT
```

> Las dos cookies se setean en el mismo response: `authToken` (JWT) y `connect.sid` (sesión). Ambas con `HttpOnly` y `SameSite=Lax`.

**Response — Body**
```json
{
    "message": "Login exitoso",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTIxNzkwOThjMDFkMDBlZjMzNmU5M2MiLCJyb2xlIjoidXNlciIsImlhdCI6MTc4MDU3ODU4OCwiZXhwIjoxNzgwNTgyMTg4fQ.7Pr6TjwSdbkwqYbuonu3YYl6LebFXf9qMv66fe4zmJE",
    "user": {
        "_id": "6a2179098c01d00ef336e93c",
        "email": "carlos@chronoshop.com",
        "role": "user"
    }
}
```

**JWT — Payload decodificado** (sección central en base64url):
```json
{
    "userId": "6a2179098c01d00ef336e93c",
    "role": "user",
    "iat": 1780578588,
    "exp": 1780582188
}
```
- `iat` → 2026-06-04 13:09:48 UTC (momento de emisión)
- `exp` → 2026-06-04 14:09:48 UTC (exactamente 1 hora después)

---

### 5.4 Login local (admin) — `POST /api/v1/auth/login` → **200 OK**

**Request**
```
POST http://localhost:8080/api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@chronoshop.com",
  "password": "admin123"
}
```

**Response — Headers**
```
HTTP/1.1 200 OK
Set-Cookie: authToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTBkYjc5ZDZjZmQ1OTZmZWFiN2IxNDEiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODA1Nzg3NzYsImV4cCI6MTc4MDU4MjM3Nn0.yqS2vc-G2-ePpXM08tfB7C7zLuFJBdvTKiyNRbhLZ1E; Max-Age=3600; Path=/; Expires=Thu, 04 Jun 2026 14:12:56 GMT; HttpOnly; SameSite=Lax
Set-Cookie: connect.sid=s%3ANtgUCnDMbD8NdK5wFvDheXP26PDTM7az.6hXXA6R8OVQM1EU3BC9SD6cMZrXCZ%2BC%2BZKR9mbPqjA0; Path=/; Expires=Thu, 04 Jun 2026 14:12:56 GMT; HttpOnly; SameSite=Lax
Content-Type: application/json; charset=utf-8
Date: Thu, 04 Jun 2026 13:12:56 GMT
```

**Response — Body**
```json
{
    "message": "Login exitoso",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTBkYjc5ZDZjZmQ1OTZmZWFiN2IxNDEiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODA1Nzg3NzYsImV4cCI6MTc4MDU4MjM3Nn0.yqS2vc-G2-ePpXM08tfB7C7zLuFJBdvTKiyNRbhLZ1E",
    "user": {
        "_id": "6a0db79d6cfd596feab7b141",
        "email": "admin@chronoshop.com",
        "role": "admin"
    }
}
```

**JWT Admin — Payload decodificado:**
```json
{
    "userId": "6a0db79d6cfd596feab7b141",
    "role": "admin",
    "iat": 1780578776,
    "exp": 1780582376
}
```

---

### 5.5 Ruta protegida — `GET /api/v1/profile` → **200 OK** (con Bearer token)

**Request**
```
GET http://localhost:8080/api/v1/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTIxNzkwOThjMDFkMDBlZjMzNmU5M2MiLCJyb2xlIjoidXNlciIsImlhdCI6MTc4MDU3ODU4OCwiZXhwIjoxNzgwNTgyMTg4fQ.7Pr6TjwSdbkwqYbuonu3YYl6LebFXf9qMv66fe4zmJE
```

**Response — Headers**
```
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 131
Date: Thu, 04 Jun 2026 13:09:56 GMT
```

**Response — Body**
```json
{
    "user": {
        "_id": "6a2179098c01d00ef336e93c",
        "email": "carlos@chronoshop.com",
        "role": "user",
        "firstName": "Carlos",
        "lastName": "Mendoza"
    }
}
```

---

### 5.6 Ruta protegida sin token — `GET /api/v1/profile` → **401 Unauthorized**

**Request**
```
GET http://localhost:8080/api/v1/profile
(sin Authorization header ni cookie authToken)
```

**Response — Headers**
```
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8
Content-Length: 26
Date: Thu, 04 Jun 2026 13:09:56 GMT
```

**Response — Body**
```json
{
    "error": "No autenticado"
}
```

---

### 5.7 Ruta admin (usuario sin rol) — `GET /api/v1/admin` → **403 Forbidden**

**Request**
```
GET http://localhost:8080/api/v1/admin
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTIxNzkwOThjMDFkMDBlZjMzNmU5M2MiLCJyb2xlIjoidXNlciIsImlhdCI6MTc4MDU3ODU4OCwiZXhwIjoxNzgwNTgyMTg4fQ.7Pr6TjwSdbkwqYbuonu3YYl6LebFXf9qMv66fe4zmJE
```

> Token válido, pero `role: "user"` → rechazado por `authAdmin` con 403.

**Response — Headers**
```
HTTP/1.1 403 Forbidden
Content-Type: application/json; charset=utf-8
Content-Length: 27
Date: Thu, 04 Jun 2026 13:10:01 GMT
```

**Response — Body**
```json
{
    "error": "Acceso denegado"
}
```

---

### 5.8 Ruta admin (token admin) — `GET /api/v1/admin` → **200 OK**

**Request**
```
GET http://localhost:8080/api/v1/admin
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTBkYjc5ZDZjZmQ1OTZmZWFiN2IxNDEiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODA1Nzg3NzYsImV4cCI6MTc4MDU4MjM3Nn0.yqS2vc-G2-ePpXM08tfB7C7zLuFJBdvTKiyNRbhLZ1E
```

**Response — Headers**
```
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 133
Date: Thu, 04 Jun 2026 13:13:02 GMT
```

**Response — Body**
```json
{
    "message": "Panel de administración",
    "admin": {
        "userId": "6a0db79d6cfd596feab7b141",
        "role": "admin",
        "iat": 1780578776,
        "exp": 1780582376
    }
}
```

---

### 5.9 Ruta admin sin token — `GET /api/v1/admin` → **401 Unauthorized**

**Request**
```
GET http://localhost:8080/api/v1/admin
(sin Authorization header)
```

**Response — Headers**
```
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8
Content-Length: 26
Date: Thu, 04 Jun 2026 13:13:02 GMT
```

**Response — Body**
```json
{
    "error": "No autenticado"
}
```

---

### 5.10 Sesión activa — `GET /api/v1/session` → **200 OK**

**Request**
```
GET http://localhost:8080/api/v1/session
Cookie: connect.sid=s%3Ah_m0VqysxOT-D4nkZIlbOVugcUhMEno_.dZ2EBPnvj0UaG9QlGcmS4FJ90sDeZ96LkDcO17FWmSg
```

**Response — Headers**
```
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 136
Date: Thu, 04 Jun 2026 13:10:01 GMT
```

**Response — Body**
```json
{
    "sessionId": "wL8FoIP8OUj-cEFnVUBuRNqdcjs0brI3",
    "user": {
        "_id": "6a2179098c01d00ef336e93c",
        "email": "carlos@chronoshop.com",
        "role": "user"
    }
}
```

---

### 5.11 Logout — `POST /api/v1/auth/logout` → **200 OK**

**Request**
```
POST http://localhost:8080/api/v1/auth/logout
Cookie: connect.sid=s%3Ah_m0VqysxOT-D4nkZIlbOVugcUhMEno_...
```

**Response — Headers**
```
HTTP/1.1 200 OK
Set-Cookie: authToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
Set-Cookie: connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
Content-Type: application/json; charset=utf-8
Date: Thu, 04 Jun 2026 13:10:05 GMT
```

> El servidor retorna las dos cookies con `Expires=Thu, 01 Jan 1970` (epoch 0), instruyendo al browser a eliminarlas inmediatamente.

**Response — Body**
```json
{
    "message": "Logout exitoso"
}
```

---

### 5.12 Sesión después del logout — `GET /api/v1/session` → **401 Unauthorized**

**Request**
```
GET http://localhost:8080/api/v1/session
Cookie: connect.sid=s%3Ah_m0VqysxOT-D4nkZIlbOVugcUhMEno_...  (sesión destruida)
```

**Response — Headers**
```
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8
Content-Length: 30
Date: Thu, 04 Jun 2026 13:10:05 GMT
```

**Response — Body**
```json
{
    "error": "Sin sesión activa"
}
```

---

### 5.13 Resumen de casos probados

| # | Método | Endpoint | Credencial enviada | Status | Resultado |
|---|--------|----------|-------------------|--------|-----------|
| 1 | POST | `/api/v1/auth/register` | — | **201** | Usuario creado |
| 2 | POST | `/api/v1/auth/register` | — (email duplicado) | **409** | Error validado |
| 3 | POST | `/api/v1/auth/login` | email + password (user) | **200** | Token + 2 cookies |
| 4 | POST | `/api/v1/auth/login` | email + password (admin) | **200** | Token con role:admin |
| 5 | GET | `/api/v1/profile` | Bearer token válido | **200** | Perfil completo |
| 6 | GET | `/api/v1/profile` | Sin token | **401** | No autenticado |
| 7 | GET | `/api/v1/admin` | Bearer token role:user | **403** | Acceso denegado |
| 8 | GET | `/api/v1/admin` | Bearer token role:admin | **200** | Panel admin |
| 9 | GET | `/api/v1/admin` | Sin token | **401** | No autenticado |
| 10 | GET | `/api/v1/session` | Cookie connect.sid válida | **200** | Sesión activa |
| 11 | POST | `/api/v1/auth/logout` | Cookie de sesión | **200** | Cookies eliminadas |
| 12 | GET | `/api/v1/session` | Cookie ya destruida | **401** | Sin sesión activa |

### 5.14 Suite de tests — 14/14 pasando

```
 RUN  v4.1.7

 Test Files  3 passed (3)
      Tests  14 passed (14)
   Start at  10:20:58
   Duration  748ms

Detalle:
  tests/managers/UserManager.test.js  (7 tests)
  ✓ register → lanza EMAIL_TAKEN si el email ya existe
  ✓ register → hashea la contraseña antes de guardar
  ✓ register → devuelve el usuario creado
  ✓ findOrCreateGithub → retorna usuario existente si githubId ya está registrado
  ✓ findOrCreateGithub → crea usuario nuevo si githubId no existe
  ✓ findOrCreateGoogle → retorna usuario existente si googleId ya está registrado
  ✓ findOrCreateGoogle → crea usuario nuevo si googleId no existe

  tests/middlewares/authJWT.test.js   (4 tests)
  ✓ devuelve 401 si no hay token
  ✓ llama next() y adjunta req.user para token válido en cookie
  ✓ llama next() para token válido en Authorization header
  ✓ devuelve 401 para token inválido

  tests/middlewares/authRole.test.js  (3 tests)
  ✓ devuelve 401 si req.user no existe
  ✓ devuelve 403 si role es user
  ✓ llama next() si role es admin
```

---

## 6. Instrucciones de Instalación Local

### 6.1 Requisitos previos

- **Node.js** >= 20.8.0
- **MongoDB** corriendo en `localhost:27017` (o URI de Atlas en `.env`)
- **Git**
- Cuenta en **GitHub** y/o **Google Cloud** para configurar OAuth (opcional)

### 6.2 Dependencias del proyecto

```json
{
  "dependencies": {
    "bcrypt": "^6.0.0",
    "connect-mongo": "^6.0.0",
    "cookie-parser": "^1.4.7",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-handlebars": "^7.1.3",
    "express-session": "^1.19.0",
    "jsonwebtoken": "^9.0.3",
    "mongoose": "^8.4.0",
    "mongoose-paginate-v2": "^1.8.3",
    "passport": "^0.7.0",
    "passport-github2": "^0.1.12",
    "passport-google-oauth2": "^0.2.0",
    "passport-local": "^1.0.0",
    "socket.io": "^4.7.5"
  }
}
```

### 6.3 Pasos para ejecutar localmente

```bash
# 1. Clonar el repositorio
git clone https://github.com/bautistacorte05/chronoshop-backend.git
cd chronoshop-backend

# 2. Instalar dependencias
npm install

# 3. Crear archivo de variables de entorno
cp .env.example .env
# Editar .env con tus valores (ver sección 6.4)

# 4. (Opcional) Cargar datos iniciales de productos
npm run seed

# 5. Iniciar el servidor
npm run dev     # desarrollo (hot reload)
# o
npm start       # producción

# 6. Ejecutar tests
npm test
```

El servidor queda disponible en `http://localhost:8080`.

### 6.4 Archivo .env.example comentado

```env
# ── Servidor ────────────────────────────────────────────────────────────────
PORT=8080
NODE_ENV=development          # Cambiar a 'production' en producción

# ── Base de datos ────────────────────────────────────────────────────────────
MONGODB_URI=mongodb://localhost:27017/ecommerce
PERSISTENCE=mongo             # 'mongo' usa MongoDB, cualquier otro valor usa FileSystem

# ── Sesiones ─────────────────────────────────────────────────────────────────
# String largo y aleatorio. Se usa para firmar la cookie connect.sid.
SESSION_SECRET=reemplazar_con_string_aleatorio_largo_y_seguro

# ── JWT ──────────────────────────────────────────────────────────────────────
# String largo y aleatorio. Se usa para firmar y verificar los tokens JWT.
JWT_SECRET=reemplazar_con_string_aleatorio_largo_y_seguro
JWT_EXPIRATION=1h             # Expiración del JWT (1h = 1 hora)
BCRYPT_ROUNDS=10              # Salt rounds para bcrypt (10 es el estándar)

# ── OAuth GitHub ──────────────────────────────────────────────────────────────
# Crear en: https://github.com/settings/developers → OAuth Apps → New OAuth App
# Homepage URL: http://localhost:8080
# Callback URL: http://localhost:8080/auth/github/callback
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:8080/auth/github/callback

# ── OAuth Google ──────────────────────────────────────────────────────────────
# Crear en: https://console.cloud.google.com → APIs & Services → Credentials
# Authorized redirect URI: http://localhost:8080/auth/google/callback
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback
```

### 6.5 Configurar OAuth (opcional)

**GitHub:**
1. Ir a `https://github.com/settings/developers` → "OAuth Apps" → "New OAuth App"
2. Completar Homepage URL: `http://localhost:8080`
3. Authorization callback URL: `http://localhost:8080/auth/github/callback`
4. Copiar Client ID y Client Secret al `.env`

**Google:**
1. Ir a `https://console.cloud.google.com` → APIs & Services → Credentials
2. Crear "OAuth 2.0 Client ID" tipo "Web application"
3. Authorized redirect URI: `http://localhost:8080/auth/google/callback`
4. Copiar Client ID y Client Secret al `.env`

> Si los campos de OAuth quedan vacíos en `.env`, el sistema funciona con autenticación local únicamente. Las estrategias OAuth no se registran si falta la configuración.

### 6.6 Endpoints disponibles

| Método | URL | Auth | Descripción |
|--------|-----|------|-------------|
| `POST` | `/api/v1/auth/register` | — | Registro local |
| `POST` | `/api/v1/auth/login` | — | Login local |
| `POST` | `/api/v1/auth/logout` | Sesión | Logout |
| `GET` | `/api/v1/session` | Sesión | Info sesión activa |
| `GET` | `/api/v1/profile` | JWT | Perfil del usuario |
| `GET` | `/api/v1/admin` | JWT + Admin | Panel de administración |
| `GET` | `/auth/github` | — | Inicio OAuth GitHub |
| `GET` | `/auth/google` | — | Inicio OAuth Google |
| `GET` | `/api/products` | — | Lista de productos (pública) |
| `POST` | `/api/products` | JWT + Admin | Crear producto |
| `PUT` | `/api/products/:pid` | JWT + Admin | Actualizar producto |
| `DELETE` | `/api/products/:pid` | JWT + Admin | Eliminar producto |
| `GET` | `/login` | — | Vista de login (SSR) |
| `GET` | `/register` | — | Vista de registro (SSR) |
