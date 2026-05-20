# Sistema de Autenticación Híbrido — Especificación de Diseño

**Fecha:** 2026-05-20  
**Proyecto:** ChronoShop Backend (extensión de backend1)  
**Entrega:** Backend 2 — Proyecto Final  

---

## Contexto

ChronoShop es un e-commerce de relojes construido con Node.js, Express, Mongoose y Handlebars. Tiene arquitectura por capas (DAO → Manager → Router) y dos canales de acceso: vistas SSR (`/products`, `/carts`) y una API REST (`/api/products`, `/api/carts`). No tiene ningún sistema de autenticación.

Este documento especifica la extensión del proyecto para agregar un **sistema de autenticación híbrido** que combine:
- **Estrategia Local** (email + contraseña con bcrypt)
- **OAuth** (GitHub y Google)
- **Sesiones** para el canal SSR
- **JWT** para el canal API REST

---

## Arquitectura

### Estructura de archivos nuevos

```
src/
├── models/
│   └── User.js                      # Esquema Mongoose de usuario
├── dao/
│   └── mongo/
│       └── UserMongoDAO.js          # CRUD de usuarios en MongoDB
├── managers/
│   └── UserManager.js               # Lógica de negocio: registro, búsqueda
├── config/
│   └── passport.config.js           # Configuración de las 3 estrategias Passport
├── middleware/
│   ├── authSession.js               # Protege rutas SSR (verifica req.user)
│   ├── authJWT.js                   # Protege rutas API (verifica Bearer token)
│   └── authAdmin.js                 # Verifica rol admin
└── routes/
    ├── api/
    │   └── auth.router.js           # POST /api/auth/login, /register, GET /me
    └── views/
        └── auth.router.js           # GET /login, /register, POST /login, /register, /logout
```

### Vistas nuevas

```
src/views/
├── login.handlebars
└── register.handlebars
```

### Dependencias a agregar

```json
{
  "passport": "^0.7.0",
  "passport-local": "^1.0.0",
  "passport-github2": "^0.1.12",
  "passport-google-oauth2": "^0.2.0",
  "express-session": "^1.18.0",
  "connect-mongo": "^5.1.0",
  "jsonwebtoken": "^9.0.2",
  "bcrypt": "^5.1.1"
}
```

### Variables de entorno a agregar

```env
SESSION_SECRET=<string aleatorio largo>
JWT_SECRET=<string aleatorio largo>
JWT_EXPIRATION=24h
BCRYPT_ROUNDS=10

GITHUB_CLIENT_ID=<id de OAuth app en GitHub>
GITHUB_CLIENT_SECRET=<secret de OAuth app en GitHub>
GITHUB_CALLBACK_URL=http://localhost:8080/auth/github/callback

GOOGLE_CLIENT_ID=<id de OAuth app en Google Cloud>
GOOGLE_CLIENT_SECRET=<secret de OAuth app en Google Cloud>
GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback
```

---

## Modelo de datos

### User.js (Mongoose)

```js
{
  firstName: { type: String },
  lastName:  { type: String },
  email:     { type: String, required: true, unique: true },
  password:  { type: String, default: null },   // null para usuarios OAuth
  role:      { type: String, enum: ['user', 'admin'], default: 'user' },
  provider:  { type: String, enum: ['local', 'github', 'google'], default: 'local' },
  githubId:  { type: String, default: null },
  googleId:  { type: String, default: null },
  avatar:    { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
}
```

**Decisión de diseño:** Los usuarios OAuth no tienen `password`. Al buscar un usuario OAuth se usa `githubId` o `googleId`, nunca el email (podría coincidir con una cuenta local y causar conflicto de identidad).

---

## Seguridad aplicada

| Capa | Mecanismo | Detalle |
|------|-----------|---------|
| Contraseñas | bcrypt | 10 salt rounds. Nunca se almacena ni transmite el texto plano |
| Tokens API | JWT | Secret en `.env`, expiración 24h, payload `{ id, role }` |
| Sesiones SSR | express-session | Store en MongoDB (connect-mongo), cookie `httpOnly: true`, `secure: true` en producción |
| OAuth | Passport callback | Crea usuario si no existe; vincula por `githubId`/`googleId`, nunca por email |
| Roles | Middleware | `authAdmin` verifica `req.user.role === 'admin'` antes de operaciones de escritura en productos |

---

## Flujos de autenticación

### Registro local

```
POST /register  (SSR: form-data)
POST /api/auth/register  (API: JSON)

1. Validar que email no exista en base de datos
2. bcrypt.hash(password, BCRYPT_ROUNDS)
3. User.create({ email, password: hash, role: 'user', provider: 'local' })
4. SSR: redirect /login
   API: 201 { message: 'Usuario creado' }
```

### Login local — canal SSR

```
POST /login  (form-data: email, password)

1. Passport LocalStrategy: busca User por email
2. bcrypt.compare(password, user.password)
3. req.login(user) → serializa user.id en req.session
4. redirect /products
```

### Login local — canal API

```
POST /api/auth/login  (JSON: { email, password })

1. Passport LocalStrategy: busca User por email
2. bcrypt.compare(password, user.password)
3. jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRATION })
4. 200 { token, user: { id, email, role } }
```

### OAuth GitHub

```
GET /auth/github
  → Redirige a GitHub OAuth consent (scopes: user:email)

GET /auth/github/callback
  → Passport GitHubStrategy callback:
     - findOne({ githubId: profile.id })
     - Si no existe: createUser({ githubId, email, firstName, avatar, provider: 'github' })
  → req.login(user) → sesión
  → redirect /products
```

### OAuth Google

```
GET /auth/google
  → Redirige a Google OAuth consent (scopes: email, profile)

GET /auth/google/callback
  → Passport GoogleStrategy callback:
     - findOne({ googleId: profile.id })
     - Si no existe: createUser({ googleId, email, firstName, avatar, provider: 'google' })
  → req.login(user) → sesión
  → redirect /products
```

### Logout

```
GET /logout  (SSR)
  → req.logout()
  → req.session.destroy()
  → redirect /login

DELETE /api/auth/logout  (API)
  → 200 { message: 'Logout exitoso' }
  → El cliente es responsable de descartar el token JWT
```

---

## Middleware

### authSession.js

Protege rutas SSR. Si `req.user` no existe (sesión inválida o no iniciada), redirige a `/login`.

```js
if (!req.user) return res.redirect('/login')
next()
```

### authJWT.js

Protege rutas API. Lee el header `Authorization: Bearer <token>`, verifica con `jwt.verify`, adjunta el usuario decodificado en `req.user`.

```js
const token = req.headers.authorization?.split(' ')[1]
if (!token) return res.status(401).json({ error: 'No autenticado' })
const payload = jwt.verify(token, JWT_SECRET)
req.user = await UserManager.getById(payload.id)
next()
```

### authAdmin.js

Verifica rol. Se encadena después de `authSession` o `authJWT`.

```js
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' })
next()
```

---

## Protección de rutas existentes

### Rutas SSR (vistas)

| Ruta | Middleware |
|------|------------|
| `GET /products` | `authSession` |
| `GET /products/:pid` | `authSession` |
| `GET /carts/:cid` | `authSession` |

### Rutas API

| Ruta | Middleware |
|------|------------|
| `POST /api/products` | `authJWT`, `authAdmin` |
| `PUT /api/products/:pid` | `authJWT`, `authAdmin` |
| `DELETE /api/products/:pid` | `authJWT`, `authAdmin` |
| `POST /api/carts` | `authJWT` |
| `GET /api/carts/:cid` | `authJWT` |
| `POST /api/carts/:cid/products/:pid` | `authJWT` |
| `DELETE /api/carts/:cid/products/:pid` | `authJWT` |

---

## Passport config — estructura

```js
// passport.config.js

// Serialización (solo guarda el id en la sesión)
passport.serializeUser((user, done) => done(null, user._id))
passport.deserializeUser(async (id, done) => {
  const user = await UserManager.getById(id)
  done(null, user)
})

// LocalStrategy — busca por email, compara hash
// GitHubStrategy — busca/crea por githubId
// GoogleStrategy — busca/crea por googleId
```

---

## Configuración en app.js

```js
// Orden de middleware global (antes de las rutas):
app.use(session({ secret, store: MongoStore.create(...), resave: false, saveUninitialized: false }))
app.use(passport.initialize())
app.use(passport.session())
```

---

## Organización por capas (decisiones arquitectónicas)

El sistema respeta y extiende el patrón existente sin modificar los módulos de productos ni carritos:

1. **DAO** (`UserMongoDAO`): operaciones de base de datos atómicas sin lógica de negocio
2. **Manager** (`UserManager`): orquesta registro, búsqueda por email/id/githubId/googleId
3. **Config** (`passport.config.js`): centraliza todas las estrategias de Passport; se inicializa una vez en `app.js`
4. **Middleware** (`authSession`, `authJWT`, `authAdmin`): funciones puras que protegen rutas sin acoplarse a la lógica de negocio
5. **Routers**: delegan autenticación a Passport y autorización a los middlewares; no contienen lógica de negocio

Esta separación permite cambiar el mecanismo de auth (por ejemplo, migrar de sesiones a JWT en las vistas) sin tocar el resto del sistema.
