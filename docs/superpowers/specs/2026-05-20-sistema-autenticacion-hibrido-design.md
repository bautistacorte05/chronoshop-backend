# Sistema de Autenticación Híbrido — Especificación de Diseño

**Fecha:** 2026-05-20
**Proyecto:** ChronoShop Backend (extensión de backend1)
**Entrega:** Backend 2 — Proyecto Final

---

## Resumen ejecutivo

Extender ChronoShop con un sistema de autenticación híbrido que combina:
- **Estrategia Local** (email + contraseña, bcrypt)
- **OAuth** (GitHub y Google vía Passport)
- **JWT** emitido en body + cookie `authToken`
- **Sesiones** con express-session + connect-mongo

El término "híbrido" refiere a que JWT y sesiones coexisten: la sesión persiste el contexto de navegación SSR, el JWT habilita acceso stateless a la API. Ambos mecanismos se emiten en el login y se destruyen en el logout.

---

## Arquitectura del Proyecto

### Estructura de carpetas (árbol completo)

```
/Entrega-backend1/
├── app.js                              # Entry point: Express + middlewares globales
├── seed.js                             # Seed de productos
├── package.json
├── .env
├── .env.example
└── src/
    ├── config/
    │   ├── db.config.js                # Conexión Mongoose
    │   └── passport.config.js          # Inicialización y registro de estrategias
    ├── models/
    │   ├── Product.js                  # Existente
    │   ├── Cart.js                     # Existente
    │   └── User.js                     # NUEVO: esquema de usuario
    ├── strategies/
    │   ├── local.strategy.js           # NUEVO: Passport LocalStrategy
    │   ├── github.strategy.js          # NUEVO: Passport GitHubStrategy
    │   └── google.strategy.js          # NUEVO: Passport GoogleStrategy
    ├── controllers/
    │   └── auth.controller.js          # NUEVO: lógica de registro, login, logout, session, profile, admin
    ├── routes/
    │   ├── api/
    │   │   ├── products.router.js      # Existente
    │   │   ├── carts.router.js         # Existente
    │   │   └── auth.router.js          # NUEVO: monta /api/v1/auth/*
    │   └── views/
    │       ├── products.router.js      # Existente
    │       └── carts.router.js         # Existente
    ├── middlewares/
    │   ├── authJWT.js                  # NUEVO: verifica cookie authToken o Bearer header
    │   └── authRole.js                 # NUEVO: verifica req.user.role === 'admin'
    ├── dao/
    │   ├── mongo/
    │   │   ├── ProductMongoDAO.js      # Existente
    │   │   ├── CartMongoDAO.js         # Existente
    │   │   └── UserMongoDAO.js         # NUEVO
    │   └── fileSystem/                 # Existente (sin cambios)
    ├── managers/
    │   ├── ProductManager.js           # Existente
    │   ├── CartManager.js              # Existente
    │   └── UserManager.js             # NUEVO
    ├── data/                           # Existente
    ├── public/                         # Existente
    └── views/
        ├── layouts/main.handlebars     # Existente (actualizar navbar)
        ├── products.handlebars         # Existente
        ├── cart.handlebars             # Existente
        ├── login.handlebars            # NUEVO
        └── register.handlebars         # NUEVO
```

### Explicación de cada capa nueva

**`config/`**
Centraliza la configuración de infraestructura. `passport.config.js` importa las tres estrategias, llama a `passport.use()` para cada una y define `serializeUser`/`deserializeUser`. Se ejecuta una sola vez al iniciar la app.

**`models/`**
Esquemas Mongoose. `User.js` es el único nuevo. Contiene email, password (nullable para OAuth), role, provider, githubId, googleId, avatar.

**`strategies/`**
Una estrategia de Passport por archivo. Cada archivo exporta una instancia de la estrategia con su callback de verificación. Al separar en archivos individuales, cada estrategia puede testearse y mantenerse de forma aislada.

**`controllers/`**
Funciones de manejo de request/response. `auth.controller.js` contiene: `register`, `loginLocal`, `loginOAuth`, `logout`, `getSession`, `getProfile`, `getAdmin`. Los controllers no tocan la base de datos directamente — delegan a `UserManager`.

**`middlewares/`**
Funciones que se encadenan antes del controller. `authJWT.js` extrae el token de la cookie `authToken` (o `Authorization: Bearer` como fallback) y verifica con `jwt.verify`. `authRole.js` verifica el campo `role` en `req.user`.

**`routes/`**
Solo monta controllers y middlewares en URLs. No contiene lógica de negocio.

---

## Diagrama de flujo de autenticación

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENTE                                  │
└───────────────┬──────────────────────────────────────────────────┘
                │
    ┌───────────▼────────────┐    ┌──────────────────────────────┐
    │  POST /api/v1/auth/    │    │  GET /auth/github            │
    │  login                 │    │  GET /auth/google            │
    │  { email, password }   │    │  (OAuth redirect)            │
    └───────────┬────────────┘    └──────────────┬───────────────┘
                │                                 │
    ┌───────────▼────────────┐    ┌──────────────▼───────────────┐
    │  LocalStrategy         │    │  GitHub/GoogleStrategy        │
    │  bcrypt.compare()      │    │  findOrCreate user            │
    └───────────┬────────────┘    └──────────────┬───────────────┘
                │                                 │
                └──────────────┬──────────────────┘
                               │ usuario verificado
                ┌──────────────▼──────────────────┐
                │  jwt.sign({ userId, role }, 1h)  │
                │  req.login(user) → sesión         │
                └──────────────┬──────────────────┘
                               │
                ┌──────────────▼──────────────────┐
                │  Response:                       │
                │  - body: { token, user }         │
                │  - cookie authToken (httpOnly)   │
                │  - Set-Cookie: connect.sid       │
                └──────────────┬──────────────────┘
                               │
    ┌──────────────────────────▼──────────────────────────────────┐
    │              REQUEST A RUTA PROTEGIDA                       │
    │              GET /api/v1/profile o /api/v1/admin            │
    └──────────────────────────┬──────────────────────────────────┘
                               │
                ┌──────────────▼──────────────────┐
                │  authJWT middleware              │
                │  1. Lee cookie authToken         │
                │  2. jwt.verify(token, secret)    │
                │  3. adjunta req.user             │
                └──────────────┬──────────────────┘
                               │
                ┌──────────────▼──────────────────┐
                │  authRole (solo /admin)          │
                │  req.user.role === 'admin' ?     │
                └──────────────┬──────────────────┘
                               │
                ┌──────────────▼──────────────────┐
                │  Controller responde             │
                │  200 / 401 / 403                 │
                └─────────────────────────────────┘
```

---

## Implementación Técnica

### Modelo User.js

```js
import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  firstName: { type: String },
  lastName:  { type: String },
  email:     { type: String, required: true, unique: true },
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

### Endpoints de Auth — `/api/v1/auth/`

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Registro local |
| POST | `/api/v1/auth/login` | Login local (Passport) |
| GET | `/auth/github` | Inicia OAuth GitHub |
| GET | `/auth/github/callback` | Callback OAuth GitHub |
| GET | `/auth/google` | Inicia OAuth Google |
| GET | `/auth/google/callback` | Callback OAuth Google |
| GET | `/api/v1/session` | Info de sesión activa |
| GET | `/api/v1/profile` | Perfil (protegido JWT) |
| GET | `/api/v1/admin` | Ruta admin (protegida JWT + rol) |
| POST | `/api/v1/auth/logout` | Destruye sesión + limpia cookie |

---

### Registro — POST /api/v1/auth/register

**Flujo:**
1. Verificar que `email` no exista en base de datos
2. `bcrypt.hash(password, 10)`
3. `User.create({ email, password: hash, role: 'user', provider: 'local' })`
4. Responder 201

**Request:**
```json
POST /api/v1/auth/register
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "email": "juan@example.com",
  "password": "miPassword123"
}
```

**Response 201:**
```json
{
  "message": "Usuario registrado correctamente",
  "user": {
    "_id": "664f...",
    "email": "juan@example.com",
    "role": "user"
  }
}
```

**Response 409 (duplicado):**
```json
{ "error": "El email ya está registrado" }
```

---

### Login Local — POST /api/v1/auth/login

**Flujo:**
1. Passport LocalStrategy verifica email y compara hash con bcrypt
2. `jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' })`
3. `req.login(user)` → crea sesión en MongoDB
4. Responde con token en **body** y en **cookie** `authToken`

**Cookie `authToken`:**
```js
res.cookie('authToken', token, {
  httpOnly: true,
  sameSite: 'Lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 3600000  // 1h en ms
})
```

**Request:**
```json
POST /api/v1/auth/login
{
  "email": "juan@example.com",
  "password": "miPassword123"
}
```

**Response 200:**
```json
{
  "message": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "664f...",
    "email": "juan@example.com",
    "role": "user"
  }
}
```

**Response 401:**
```json
{ "error": "Credenciales inválidas" }
```

---

### Login OAuth (GitHub y Google)

**Flujo:**
1. Cliente navega a `GET /auth/github` o `GET /auth/google`
2. Passport redirige al proveedor
3. Proveedor redirige al callback con el código de autorización
4. Callback: `findOne({ githubId })` o `findOne({ googleId })`
   - Si no existe: `User.create({ ...profileData, provider })`
5. `req.login(user)` → sesión
6. Emitir JWT y cookie `authToken`
7. Redirect a `/products`

**Configuración GitHubStrategy:**
```js
new GitHubStrategy({
  clientID:     process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL:  process.env.GITHUB_CALLBACK_URL,
  scope: ['user:email']
}, async (accessToken, refreshToken, profile, done) => {
  let user = await UserManager.findByGithubId(profile.id)
  if (!user) {
    user = await UserManager.create({
      githubId:  profile.id,
      firstName: profile.displayName || profile.username,
      email:     profile.emails?.[0]?.value,
      avatar:    profile.photos?.[0]?.value,
      provider:  'github'
    })
  }
  done(null, user)
})
```

**Sesión en OAuth:** Passport llama a `req.login()` en el callback, lo que serializa `user._id` en `req.session`. La sesión persiste en MongoDB. En cada request SSR posterior, `deserializeUser` reconstruye `req.user` con `User.findById(id)`.

---

### Sistema de Sesiones

**Configuración en app.js:**
```js
import session from 'express-session'
import MongoStore from 'connect-mongo'

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
}))
app.use(passport.initialize())
app.use(passport.session())
```

**Documento de sesión en MongoDB (colección `sessions`):**
```json
{
  "_id": "abc123...",
  "expires": "2026-05-20T13:00:00.000Z",
  "session": {
    "cookie": { "httpOnly": true, "secure": false },
    "passport": { "user": "664f..." }
  }
}
```

**GET /api/v1/session:**
```js
// Responde con info de la sesión activa
export const getSession = (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sin sesión activa' })
  res.json({
    sessionId: req.sessionID,
    user: { id: req.user._id, email: req.user.email, role: req.user.role }
  })
}
```

---

### Rutas Protegidas

**GET /api/v1/profile — protegida por JWT:**
```js
// authJWT.js
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

// profile controller
export const getProfile = (req, res) => {
  res.json({ user: req.user })
}
```

**GET /api/v1/admin — protegida por JWT + rol:**
```js
// authRole.js
export const authAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' })
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' })
  next()
}

// auth.router.js
router.get('/admin', authJWT, authAdmin, getAdmin)
```

**Tabla de respuestas de error:**

| Caso | Status | Body |
|------|--------|------|
| Sin token | 401 | `{ "error": "No autenticado" }` |
| Token expirado | 401 | `{ "error": "Token inválido o expirado" }` |
| Token válido, rol insuficiente | 403 | `{ "error": "Acceso denegado" }` |

---

### Logout — POST /api/v1/auth/logout

```js
export const logout = (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie('authToken')
      res.clearCookie('connect.sid')
      res.json({ message: 'Logout exitoso' })
    })
  })
}
```

1. `req.logout()` — Passport limpia `req.user` y la referencia en sesión
2. `req.session.destroy()` — elimina el documento de sesión de MongoDB
3. `res.clearCookie('authToken')` — elimina la cookie JWT del navegador
4. `res.clearCookie('connect.sid')` — elimina la cookie de sesión

El token JWT en localStorage (si el cliente lo guardó) debe ser eliminado por el cliente. El servidor no puede revocar JWTs emitidos antes del logout sin una blacklist, por eso la expiración corta (1h) es importante.

---

## Seguridad y Decisiones Arquitectónicas

### ¿Dónde vive el rol y por qué?

El rol vive en **dos lugares**:
1. **Base de datos** (`User.role`): fuente de verdad persistente
2. **JWT payload** (`{ userId, role }`): copia en el token para requests stateless

El middleware `authJWT` lee el rol desde el payload del token sin consultar la base de datos, lo que hace la autorización O(1). La contrapartida es la pregunta siguiente.

### ¿Qué ocurre si el rol cambia con un token ya emitido?

Si un admin es degradado a `user`, su JWT sigue teniendo `role: 'admin'` hasta que expire (1h). Durante ese período podría acceder a rutas de admin. Las mitigaciones son:
- **Expiración corta (1h)**: limita la ventana de exposición
- **Blacklist de tokens** (no implementada en este proyecto por complejidad): invalidación inmediata post-cambio
- **Verificación en base de datos en rutas críticas**: el middleware podría hacer `User.findById(payload.userId)` para roles sensibles, a costo de una query extra

Se elige la expiración corta como balance entre seguridad y rendimiento para este proyecto académico.

### ¿Por qué cookie + JWT?

- **Solo cookie de sesión** (sin JWT): depende del servidor para cada request; no escala sin sesión compartida (Redis/Mongo)
- **Solo JWT en localStorage**: vulnerable a XSS (cualquier script puede robar el token)
- **JWT en cookie httpOnly**: protege contra XSS porque el script no puede leer la cookie; el navegador la envía automáticamente

La combinación cookie `httpOnly` + sesión en Mongo da lo mejor de ambos: el JWT viaja seguro y la sesión permite invalidación server-side en el logout.

### ¿Cómo se mitiga CSRF?

Con `sameSite: 'Lax'` en la cookie `authToken`:
- `Strict` bloquearía también los links OAuth (GitHub/Google redirigen a nuestro callback), rompiendo el flujo
- `Lax` permite los GET de redirect OAuth pero bloquea cookies en requests cross-site iniciados por `<img>`, `<form>` y `fetch` de terceros
- Para mayor protección en producción se puede agregar `csurf` middleware

### ¿Cómo difiere entorno local vs producción?

| Variable | Local | Producción |
|----------|-------|------------|
| `cookie.secure` | `false` (HTTP local) | `true` (solo HTTPS) |
| `NODE_ENV` | `development` | `production` |
| `MONGODB_URI` | `localhost:27017` | Atlas o instancia cloud |
| OAuth callbacks | `http://localhost:8080/...` | `https://dominio.com/...` |

La condición `secure: process.env.NODE_ENV === 'production'` en la cookie maneja la diferencia automáticamente.

---

## Dependencias a agregar

```json
{
  "passport": "^0.7.0",
  "passport-local": "^1.0.0",
  "passport-github2": "^0.1.12",
  "passport-google-oauth2": "^0.2.0",
  "express-session": "^1.18.0",
  "connect-mongo": "^5.1.0",
  "jsonwebtoken": "^9.0.2",
  "bcrypt": "^5.1.1",
  "cookie-parser": "^1.4.6"
}
```

---

## Variables de entorno (.env.example)

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

# OAuth GitHub
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:8080/auth/github/callback

# OAuth Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback
```

---

## Criterio de evaluación cubierto

| Criterio | Cómo se cumple |
|----------|----------------|
| Múltiples estrategias de auth | Local + GitHub + Google (3 estrategias Passport) |
| Seguridad aplicada | bcrypt, JWT httpOnly cookie, sameSite, SESSION_SECRET, roles |
| Organización por capas | config, models, strategies, controllers, middlewares, routes |
| Claridad en documentación | Secciones obligatorias, ejemplos de request/response, diagrama de flujo |
| Coherencia arquitectónica | Extiende patrón DAO/Manager existente sin romper productos/carritos |
| Evidencia de funcionamiento | Capturas Postman a agregar en la entrega final |
