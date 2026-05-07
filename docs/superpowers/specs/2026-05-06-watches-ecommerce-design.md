# ChronoShop — E-commerce de Relojes: Diseño Backend

**Fecha:** 2026-05-06  
**Stack:** Node.js + Express + MongoDB + Handlebars + Socket.io  
**Puerto:** 8080  
**Base de datos:** ecommerce (MongoDB)

---

## 1. Contexto

Proyecto final de cursada. E-commerce de relojes accesibles (Casio, Seiko, Fossil, Tissot, $80–$800). Requiere CRUD completo de productos y carritos, persistencia dual (FileSystem + MongoDB intercambiable), vistas server-side con Handlebars, y WebSockets para actualización en tiempo real.

---

## 2. Estructura del proyecto

```
Entrega-backend1/
├── src/
│   ├── dao/
│   │   ├── fileSystem/
│   │   │   ├── ProductFileSystemDAO.js
│   │   │   └── CartFileSystemDAO.js
│   │   └── mongo/
│   │       ├── ProductMongoDAO.js
│   │       └── CartMongoDAO.js
│   ├── models/
│   │   ├── Product.js
│   │   └── Cart.js
│   ├── managers/
│   │   ├── ProductManager.js
│   │   └── CartManager.js
│   ├── routes/
│   │   ├── api/
│   │   │   ├── products.router.js
│   │   │   └── carts.router.js
│   │   └── views/
│   │       ├── products.router.js
│   │       └── carts.router.js
│   ├── views/
│   │   ├── layouts/
│   │   │   └── main.handlebars
│   │   ├── products.handlebars
│   │   ├── productDetail.handlebars
│   │   └── cart.handlebars
│   ├── public/
│   │   ├── images/
│   │   └── css/
│   │       └── style.css
│   └── data/
│       ├── products.json
│       └── carts.json
├── seed.js
├── app.js
├── .env
├── .gitignore
└── package.json
```

---

## 3. Patrón de persistencia (DAO + Manager)

`ProductManager` y `CartManager` reciben un DAO en su constructor. `app.js` lee `process.env.PERSISTENCE` al iniciar y pasa el DAO correcto:

```js
// app.js
const persistence = process.env.PERSISTENCE; // "mongo" | "fs"
const ProductDAO = persistence === "mongo" ? ProductMongoDAO : ProductFileSystemDAO;
const productManager = new ProductManager(new ProductDAO());
```

Cada DAO implementa la misma interfaz:
- `getAll(options)` — lista con filtros y paginación
- `getById(id)`
- `create(data)`
- `update(id, data)`
- `delete(id)`

---

## 4. Modelos de datos

### Product
```js
{
  title:       { type: String, required: true },
  description: { type: String, required: true },
  code:        { type: String, required: true, unique: true },
  price:       { type: Number, required: true },
  status:      { type: Boolean, default: true },
  stock:       { type: Number, required: true },
  category:    { type: String, required: true },  // "Sport"|"Dress"|"Casual"|"Smart"
  thumbnails:  { type: [String], default: [] }
}
```

### Cart
```js
{
  products: [
    {
      product:  { type: ObjectId, ref: "Product" },
      quantity: { type: Number, default: 1 }
    }
  ]
}
```

---

## 5. API Endpoints

### Productos — `/api/products`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/products` | Lista paginada. Query params: `limit` (def. 10), `page` (def. 1), `query` (valor de categoría ej. `Sport`, o `available` para status:true), `sort` (`asc`/`desc` por precio) |
| GET | `/api/products/:pid` | Producto por ID |
| POST | `/api/products` | Crear producto |
| PUT | `/api/products/:pid` | Actualizar producto (ID inmutable) |
| DELETE | `/api/products/:pid` | Eliminar producto |

**Formato de respuesta GET /api/products:**
```json
{
  "status": "success",
  "payload": [],
  "totalPages": 2,
  "prevPage": null,
  "nextPage": 2,
  "page": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevLink": null,
  "nextLink": "http://localhost:8080/api/products?page=2&limit=10&sort=asc"
}
```

### Carritos — `/api/carts`

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/carts` | Crear carrito vacío con ID autogenerado |
| GET | `/api/carts/:cid` | Ver carrito con populate completo de productos |
| POST | `/api/carts/:cid/products/:pid` | Agregar producto (incrementa qty si ya existe) |
| PUT | `/api/carts/:cid` | Reemplazar array completo de productos |
| PUT | `/api/carts/:cid/products/:pid` | Actualizar solo la cantidad de un producto |
| DELETE | `/api/carts/:cid/products/:pid` | Quitar un producto del carrito |
| DELETE | `/api/carts/:cid` | Vaciar carrito (array vacío) |

---

## 6. Vistas (Handlebars)

| Ruta | Template | Descripción |
|------|----------|-------------|
| `GET /products` | `products.handlebars` | Grid de productos con paginación y filtro por categoría |
| `GET /products/:pid` | `productDetail.handlebars` | Detalle: imagen, descripción, precio, botón "Agregar al carrito" |
| `GET /carts/:cid` | `cart.handlebars` | Productos del carrito, cantidad y total |

**Layout** (`main.handlebars`): Navbar con logo "ChronoShop" y link a `/products`. Todas las vistas lo heredan.

**Estilo:** Clean Minimal — fondo blanco `#f8f8f8`, acento azul `#2563eb`, tipografía sans-serif, tarjetas con sombra sutil.

---

## 7. WebSockets (Socket.io)

- `POST /api/products` emite evento `newProduct` con el producto creado
- `DELETE /api/products/:pid` emite evento `deleteProduct` con el ID eliminado
- La vista `/products` conecta al socket y actualiza el grid en tiempo real sin recargar

---

## 8. Dependencias

```json
{
  "express": "^4.x",
  "express-handlebars": "^7.x",
  "mongoose": "^8.x",
  "mongoose-paginate-v2": "^1.x",
  "socket.io": "^4.x",
  "dotenv": "^16.x"
}
```

---

## 9. Variables de entorno (`.env`)

```
PORT=8080
MONGODB_URI=mongodb://localhost:27017/ecommerce
PERSISTENCE=mongo
```

---

## 10. Seed — 10 relojes

| Código | Producto | Precio | Categoría | Stock |
|--------|---------|--------|-----------|-------|
| CASIO-GA2100-BLK | Casio G-Shock GA-2100 | $99 | Sport | 20 |
| CASIO-EFR552-BLK | Casio Edifice EFR-552 | $130 | Dress | 15 |
| CASIO-A168W-SLV | Casio Vintage A168W | $85 | Casual | 25 |
| SEIKO-SNKE49-BRN | Seiko 5 Sports SNKE49 | $180 | Sport | 12 |
| SEIKO-SRPE41-BLU | Seiko Presage SRPE41 | $320 | Dress | 8 |
| SEIKO-SPB051-BLK | Seiko Prospex SPB051 | $650 | Sport | 5 |
| FOSSIL-FS5343-SLV | Fossil Machine FS5343 | $155 | Casual | 18 |
| FOSSIL-FTW4059-BLK | Fossil Gen 6 FTW4059 | $249 | Smart | 10 |
| TISSOT-T063-SLV | Tissot T-Classic T0634 | $350 | Dress | 7 |
| TISSOT-PRX-BLU | Tissot PRX T137 | $550 | Dress | 6 |

Imágenes: archivos `.jpg` en `/public/images/`, una por producto, servidas como estáticos.

---

## 11. Flujo de inicio

```bash
npm install
node seed.js       # poblar MongoDB con los 10 relojes
node app.js        # servidor en http://localhost:8080
```
