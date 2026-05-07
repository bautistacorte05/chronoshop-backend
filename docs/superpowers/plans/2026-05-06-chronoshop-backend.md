# ChronoShop — E-commerce de Relojes: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un backend completo de e-commerce de relojes (Node.js + Express + MongoDB) con persistencia dual FileSystem/MongoDB, CRUD de productos y carritos, vistas Handlebars y WebSockets en tiempo real.

**Architecture:** Patrón DAO+Manager: los managers contienen la lógica de negocio y delegan la persistencia a un DAO intercambiable seleccionado por `PERSISTENCE=mongo|fs` en `.env`. Express Router con funciones de fábrica que inyectan dependencias. Socket.io acoplado al HTTP server, no a Express directamente.

**Tech Stack:** Node.js 18+ (ES modules), Express 4, Mongoose 8, mongoose-paginate-v2, express-handlebars 7, Socket.io 4, dotenv 16.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---------|----------------|
| `app.js` | Entry point: Express, HBS, Socket.io, rutas, conexión MongoDB |
| `seed.js` | Script de carga inicial: 10 relojes en MongoDB |
| `package.json` | Dependencias y scripts |
| `.env` | Variables de entorno (no commiteado) |
| `src/models/Product.js` | Schema Mongoose + plugin paginate |
| `src/models/Cart.js` | Schema Mongoose con subdoc products[] |
| `src/dao/fileSystem/ProductFileSystemDAO.js` | CRUD productos en JSON, paginación en memoria |
| `src/dao/fileSystem/CartFileSystemDAO.js` | CRUD carritos en JSON |
| `src/dao/mongo/ProductMongoDAO.js` | CRUD productos con Mongoose + paginate |
| `src/dao/mongo/CartMongoDAO.js` | CRUD carritos con populate |
| `src/managers/ProductManager.js` | Lógica de negocio: validación, delega al DAO |
| `src/managers/CartManager.js` | Lógica de negocio: delega al DAO |
| `src/routes/api/products.router.js` | Router /api/products, emite eventos Socket.io |
| `src/routes/api/carts.router.js` | Router /api/carts |
| `src/routes/views/products.router.js` | Renderiza vistas de listado y detalle |
| `src/routes/views/carts.router.js` | Renderiza vista de carrito |
| `src/views/layouts/main.handlebars` | Layout con navbar |
| `src/views/products.handlebars` | Grid con filtros, paginación y Socket.io cliente |
| `src/views/productDetail.handlebars` | Detalle + botón agregar al carrito |
| `src/views/cart.handlebars` | Carrito con total |
| `src/views/error.handlebars` | Vista de error genérica |
| `src/public/css/style.css` | Estilos Clean Minimal |
| `src/data/products.json` | `[]` inicial para FileSystem DAO |
| `src/data/carts.json` | `[]` inicial para FileSystem DAO |

---

## Task 1: Inicialización del proyecto

**Files:**
- Create: `package.json`
- Create: `.env`
- Create: `.gitignore`
- Create: `src/data/products.json`
- Create: `src/data/carts.json`

- [ ] **Step 1: Crear estructura de carpetas**

```bash
mkdir -p src/dao/fileSystem src/dao/mongo src/models src/managers \
         src/routes/api src/routes/views \
         src/views/layouts src/public/css src/public/images src/data \
         docs/superpowers/plans docs/superpowers/specs
```

- [ ] **Step 2: Crear package.json**

```json
{
  "name": "chronoshop",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node app.js",
    "dev": "node --watch app.js",
    "seed": "node seed.js"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-handlebars": "^7.1.3",
    "mongoose": "^8.4.0",
    "mongoose-paginate-v2": "^1.8.3",
    "socket.io": "^4.7.5"
  }
}
```

- [ ] **Step 3: Crear .env**

```
PORT=8080
MONGODB_URI=mongodb://localhost:27017/ecommerce
PERSISTENCE=mongo
```

- [ ] **Step 4: Crear .gitignore**

```
node_modules/
.env
src/data/*.json
.superpowers/
```

- [ ] **Step 5: Crear archivos JSON iniciales**

`src/data/products.json`:
```json
[]
```

`src/data/carts.json`:
```json
[]
```

- [ ] **Step 6: Instalar dependencias**

```bash
npm install
```

Esperado: carpeta `node_modules/` creada sin errores.

- [ ] **Step 7: Commit**

```bash
git init
git add package.json package-lock.json .gitignore .env.example
git commit -m "chore: initialize project structure"
```

---

## Task 2: Modelos Mongoose

**Files:**
- Create: `src/models/Product.js`
- Create: `src/models/Cart.js`

- [ ] **Step 1: Crear src/models/Product.js**

```js
import { Schema, model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const productSchema = new Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  code:        { type: String, required: true, unique: true },
  price:       { type: Number, required: true },
  status:      { type: Boolean, default: true },
  stock:       { type: Number, required: true },
  category:    { type: String, required: true },
  thumbnails:  { type: [String], default: [] },
});

productSchema.plugin(mongoosePaginate);

export const Product = model('Product', productSchema);
```

- [ ] **Step 2: Crear src/models/Cart.js**

```js
import { Schema, model } from 'mongoose';

const cartSchema = new Schema({
  products: [
    {
      product:  { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, default: 1, min: 1 },
    },
  ],
});

export const Cart = model('Cart', cartSchema);
```

- [ ] **Step 3: Verificar sintaxis**

```bash
node --input-type=module <<'EOF'
import './src/models/Product.js';
import './src/models/Cart.js';
console.log('Models OK');
EOF
```

Esperado: `Models OK`

- [ ] **Step 4: Commit**

```bash
git add src/models/
git commit -m "feat: add Mongoose models for Product and Cart"
```

---

## Task 3: DAO FileSystem

**Files:**
- Create: `src/dao/fileSystem/ProductFileSystemDAO.js`
- Create: `src/dao/fileSystem/CartFileSystemDAO.js`

- [ ] **Step 1: Crear src/dao/fileSystem/ProductFileSystemDAO.js**

```js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../../data/products.json');

export class ProductFileSystemDAO {
  async #read() {
    try {
      return JSON.parse(await fs.readFile(DATA_PATH, 'utf-8'));
    } catch {
      return [];
    }
  }

  async #write(data) {
    await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2));
  }

  async getAll({ limit = 10, page = 1, query, sort } = {}) {
    let products = await this.#read();
    if (query === 'available') products = products.filter(p => p.status === true);
    else if (query) products = products.filter(p => p.category === query);
    if (sort === 'asc') products.sort((a, b) => a.price - b.price);
    if (sort === 'desc') products.sort((a, b) => b.price - a.price);

    const totalDocs = products.length;
    const totalPages = Math.max(1, Math.ceil(totalDocs / limit));
    const currentPage = Math.min(page, totalPages);
    const payload = products.slice((currentPage - 1) * limit, currentPage * limit);

    return {
      payload,
      totalPages,
      page: currentPage,
      hasPrevPage: currentPage > 1,
      hasNextPage: currentPage < totalPages,
      prevPage: currentPage > 1 ? currentPage - 1 : null,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
    };
  }

  async getById(id) {
    const products = await this.#read();
    return products.find(p => p._id === id) || null;
  }

  async create(data) {
    const products = await this.#read();
    const product = { _id: crypto.randomUUID(), ...data };
    products.push(product);
    await this.#write(products);
    return product;
  }

  async update(id, data) {
    const products = await this.#read();
    const idx = products.findIndex(p => p._id === id);
    if (idx === -1) return null;
    const { _id, ...rest } = data;
    products[idx] = { ...products[idx], ...rest };
    await this.#write(products);
    return products[idx];
  }

  async delete(id) {
    const products = await this.#read();
    const idx = products.findIndex(p => p._id === id);
    if (idx === -1) return null;
    const [deleted] = products.splice(idx, 1);
    await this.#write(products);
    return deleted;
  }
}
```

- [ ] **Step 2: Crear src/dao/fileSystem/CartFileSystemDAO.js**

```js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../../data/carts.json');

export class CartFileSystemDAO {
  async #read() {
    try {
      return JSON.parse(await fs.readFile(DATA_PATH, 'utf-8'));
    } catch {
      return [];
    }
  }

  async #write(data) {
    await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2));
  }

  async create() {
    const carts = await this.#read();
    const cart = { _id: crypto.randomUUID(), products: [] };
    carts.push(cart);
    await this.#write(carts);
    return cart;
  }

  async getById(id) {
    const carts = await this.#read();
    return carts.find(c => c._id === id) || null;
  }

  async update(id, products) {
    const carts = await this.#read();
    const cart = carts.find(c => c._id === id);
    if (!cart) return null;
    cart.products = products;
    await this.#write(carts);
    return cart;
  }

  async addProduct(cartId, productId) {
    const carts = await this.#read();
    const cart = carts.find(c => c._id === cartId);
    if (!cart) return null;
    const existing = cart.products.find(p => p.product === productId);
    if (existing) existing.quantity++;
    else cart.products.push({ product: productId, quantity: 1 });
    await this.#write(carts);
    return cart;
  }

  async updateProductQuantity(cartId, productId, quantity) {
    const carts = await this.#read();
    const cart = carts.find(c => c._id === cartId);
    if (!cart) return null;
    const item = cart.products.find(p => p.product === productId);
    if (!item) return null;
    item.quantity = quantity;
    await this.#write(carts);
    return cart;
  }

  async removeProduct(cartId, productId) {
    const carts = await this.#read();
    const cart = carts.find(c => c._id === cartId);
    if (!cart) return null;
    cart.products = cart.products.filter(p => p.product !== productId);
    await this.#write(carts);
    return cart;
  }

  async clear(id) {
    const carts = await this.#read();
    const cart = carts.find(c => c._id === id);
    if (!cart) return null;
    cart.products = [];
    await this.#write(carts);
    return cart;
  }
}
```

- [ ] **Step 3: Verificar DAO FileSystem**

```bash
node --input-type=module <<'EOF'
import { ProductFileSystemDAO } from './src/dao/fileSystem/ProductFileSystemDAO.js';
const dao = new ProductFileSystemDAO();
const p = await dao.create({ title: 'Test', description: 'D', code: 'T1', price: 100, stock: 5, category: 'Sport', status: true, thumbnails: [] });
console.log('Created:', p._id);
const found = await dao.getById(p._id);
console.log('Found:', found.title);
await dao.delete(p._id);
console.log('FileSystem DAO OK');
EOF
```

Esperado: `FileSystem DAO OK`

- [ ] **Step 4: Commit**

```bash
git add src/dao/fileSystem/ src/data/
git commit -m "feat: add FileSystem DAOs for Product and Cart"
```

---

## Task 4: DAO MongoDB

**Files:**
- Create: `src/dao/mongo/ProductMongoDAO.js`
- Create: `src/dao/mongo/CartMongoDAO.js`

- [ ] **Step 1: Crear src/dao/mongo/ProductMongoDAO.js**

```js
import { Product } from '../../models/Product.js';

export class ProductMongoDAO {
  async getAll({ limit = 10, page = 1, query, sort } = {}) {
    const filter = {};
    if (query === 'available') filter.status = true;
    else if (query) filter.category = query;

    const sortObj = sort === 'asc' ? { price: 1 } : sort === 'desc' ? { price: -1 } : {};

    const result = await Product.paginate(filter, { limit: Number(limit), page: Number(page), sort: sortObj, lean: true });

    return {
      payload:     result.docs,
      totalPages:  result.totalPages,
      page:        result.page,
      hasPrevPage: result.hasPrevPage,
      hasNextPage: result.hasNextPage,
      prevPage:    result.prevPage,
      nextPage:    result.nextPage,
    };
  }

  async getById(id) {
    return Product.findById(id).lean();
  }

  async create(data) {
    const product = await Product.create(data);
    return product.toObject();
  }

  async update(id, data) {
    const { _id, ...rest } = data;
    return Product.findByIdAndUpdate(id, rest, { new: true }).lean();
  }

  async delete(id) {
    return Product.findByIdAndDelete(id).lean();
  }
}
```

- [ ] **Step 2: Crear src/dao/mongo/CartMongoDAO.js**

```js
import { Cart } from '../../models/Cart.js';

export class CartMongoDAO {
  async create() {
    const cart = await Cart.create({ products: [] });
    return cart.toObject();
  }

  async getById(id) {
    return Cart.findById(id).populate('products.product').lean();
  }

  async update(id, products) {
    return Cart.findByIdAndUpdate(id, { products }, { new: true }).lean();
  }

  async addProduct(cartId, productId) {
    const cart = await Cart.findById(cartId);
    if (!cart) return null;
    const existing = cart.products.find(p => p.product.toString() === productId);
    if (existing) existing.quantity++;
    else cart.products.push({ product: productId, quantity: 1 });
    return (await cart.save()).toObject();
  }

  async updateProductQuantity(cartId, productId, quantity) {
    const cart = await Cart.findById(cartId);
    if (!cart) return null;
    const item = cart.products.find(p => p.product.toString() === productId);
    if (!item) return null;
    item.quantity = quantity;
    return (await cart.save()).toObject();
  }

  async removeProduct(cartId, productId) {
    return Cart.findByIdAndUpdate(
      cartId,
      { $pull: { products: { product: productId } } },
      { new: true }
    ).lean();
  }

  async clear(id) {
    return Cart.findByIdAndUpdate(id, { products: [] }, { new: true }).lean();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/dao/mongo/
git commit -m "feat: add MongoDB DAOs for Product and Cart"
```

---

## Task 5: Managers

**Files:**
- Create: `src/managers/ProductManager.js`
- Create: `src/managers/CartManager.js`

- [ ] **Step 1: Crear src/managers/ProductManager.js**

```js
export class ProductManager {
  constructor(dao) {
    this.dao = dao;
  }

  async getAll(options) {
    return this.dao.getAll(options);
  }

  async getById(id) {
    const product = await this.dao.getById(id);
    if (!product) throw new Error(`Producto ${id} no encontrado`);
    return product;
  }

  async create(data) {
    for (const field of ['title', 'description', 'code', 'price', 'stock', 'category']) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        throw new Error(`Campo requerido faltante: ${field}`);
      }
    }
    return this.dao.create({
      ...data,
      status:     data.status ?? true,
      thumbnails: data.thumbnails ?? [],
    });
  }

  async update(id, data) {
    const updated = await this.dao.update(id, data);
    if (!updated) throw new Error(`Producto ${id} no encontrado`);
    return updated;
  }

  async delete(id) {
    const deleted = await this.dao.delete(id);
    if (!deleted) throw new Error(`Producto ${id} no encontrado`);
    return deleted;
  }
}
```

- [ ] **Step 2: Crear src/managers/CartManager.js**

```js
export class CartManager {
  constructor(dao) {
    this.dao = dao;
  }

  async create() {
    return this.dao.create();
  }

  async getById(id) {
    const cart = await this.dao.getById(id);
    if (!cart) throw new Error(`Carrito ${id} no encontrado`);
    return cart;
  }

  async addProduct(cartId, productId) {
    const cart = await this.dao.addProduct(cartId, productId);
    if (!cart) throw new Error(`Carrito ${cartId} no encontrado`);
    return cart;
  }

  async update(cartId, products) {
    const cart = await this.dao.update(cartId, products);
    if (!cart) throw new Error(`Carrito ${cartId} no encontrado`);
    return cart;
  }

  async updateProductQuantity(cartId, productId, quantity) {
    const cart = await this.dao.updateProductQuantity(cartId, productId, quantity);
    if (!cart) throw new Error(`Carrito ${cartId} o producto ${productId} no encontrado`);
    return cart;
  }

  async removeProduct(cartId, productId) {
    const cart = await this.dao.removeProduct(cartId, productId);
    if (!cart) throw new Error(`Carrito ${cartId} no encontrado`);
    return cart;
  }

  async clear(cartId) {
    const cart = await this.dao.clear(cartId);
    if (!cart) throw new Error(`Carrito ${cartId} no encontrado`);
    return cart;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/managers/
git commit -m "feat: add ProductManager and CartManager with DAO injection"
```

---

## Task 6: Router API — Productos

**Files:**
- Create: `src/routes/api/products.router.js`

- [ ] **Step 1: Crear src/routes/api/products.router.js**

```js
import { Router } from 'express';

export const createProductsRouter = (productManager, io) => {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const { limit = 10, page = 1, query, sort } = req.query;
      const result = await productManager.getAll({ limit: Number(limit), page: Number(page), query, sort });

      const baseUrl = `${req.protocol}://${req.get('host')}/api/products`;
      const buildLink = (p) => {
        const params = new URLSearchParams({ ...req.query, page: p });
        return `${baseUrl}?${params}`;
      };

      res.json({
        status:      'success',
        payload:     result.payload,
        totalPages:  result.totalPages,
        prevPage:    result.prevPage,
        nextPage:    result.nextPage,
        page:        result.page,
        hasPrevPage: result.hasPrevPage,
        hasNextPage: result.hasNextPage,
        prevLink:    result.hasPrevPage ? buildLink(result.prevPage) : null,
        nextLink:    result.hasNextPage ? buildLink(result.nextPage) : null,
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  router.get('/:pid', async (req, res) => {
    try {
      const product = await productManager.getById(req.params.pid);
      res.json({ status: 'success', payload: product });
    } catch (err) {
      res.status(404).json({ status: 'error', message: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const product = await productManager.create(req.body);
      io.emit('newProduct', product);
      res.status(201).json({ status: 'success', payload: product });
    } catch (err) {
      res.status(400).json({ status: 'error', message: err.message });
    }
  });

  router.put('/:pid', async (req, res) => {
    try {
      const product = await productManager.update(req.params.pid, req.body);
      res.json({ status: 'success', payload: product });
    } catch (err) {
      res.status(404).json({ status: 'error', message: err.message });
    }
  });

  router.delete('/:pid', async (req, res) => {
    try {
      const product = await productManager.delete(req.params.pid);
      io.emit('deleteProduct', req.params.pid);
      res.json({ status: 'success', payload: product });
    } catch (err) {
      res.status(404).json({ status: 'error', message: err.message });
    }
  });

  return router;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/products.router.js
git commit -m "feat: add /api/products router with full CRUD and pagination"
```

---

## Task 7: Router API — Carritos

**Files:**
- Create: `src/routes/api/carts.router.js`

- [ ] **Step 1: Crear src/routes/api/carts.router.js**

```js
import { Router } from 'express';

export const createCartsRouter = (cartManager) => {
  const router = Router();

  router.post('/', async (req, res) => {
    try {
      const cart = await cartManager.create();
      res.status(201).json({ status: 'success', payload: cart });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  router.get('/:cid', async (req, res) => {
    try {
      const cart = await cartManager.getById(req.params.cid);
      res.json({ status: 'success', payload: cart });
    } catch (err) {
      res.status(404).json({ status: 'error', message: err.message });
    }
  });

  router.post('/:cid/products/:pid', async (req, res) => {
    try {
      const cart = await cartManager.addProduct(req.params.cid, req.params.pid);
      res.json({ status: 'success', payload: cart });
    } catch (err) {
      res.status(404).json({ status: 'error', message: err.message });
    }
  });

  router.put('/:cid', async (req, res) => {
    try {
      const cart = await cartManager.update(req.params.cid, req.body.products);
      res.json({ status: 'success', payload: cart });
    } catch (err) {
      res.status(404).json({ status: 'error', message: err.message });
    }
  });

  router.put('/:cid/products/:pid', async (req, res) => {
    try {
      const cart = await cartManager.updateProductQuantity(req.params.cid, req.params.pid, req.body.quantity);
      res.json({ status: 'success', payload: cart });
    } catch (err) {
      res.status(404).json({ status: 'error', message: err.message });
    }
  });

  router.delete('/:cid/products/:pid', async (req, res) => {
    try {
      const cart = await cartManager.removeProduct(req.params.cid, req.params.pid);
      res.json({ status: 'success', payload: cart });
    } catch (err) {
      res.status(404).json({ status: 'error', message: err.message });
    }
  });

  router.delete('/:cid', async (req, res) => {
    try {
      const cart = await cartManager.clear(req.params.cid);
      res.json({ status: 'success', payload: cart });
    } catch (err) {
      res.status(404).json({ status: 'error', message: err.message });
    }
  });

  return router;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/carts.router.js
git commit -m "feat: add /api/carts router with full CRUD and populate"
```

---

## Task 8: Routers de vistas

**Files:**
- Create: `src/routes/views/products.router.js`
- Create: `src/routes/views/carts.router.js`

- [ ] **Step 1: Crear src/routes/views/products.router.js**

```js
import { Router } from 'express';

export const createProductsViewRouter = (productManager) => {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const { limit = 10, page = 1, query, sort } = req.query;
      const result = await productManager.getAll({ limit: Number(limit), page: Number(page), query, sort });

      const buildLink = (p) => {
        const params = new URLSearchParams({ ...req.query, page: p });
        return `/products?${params}`;
      };

      res.render('products', {
        ...result,
        prevLink: result.hasPrevPage ? buildLink(result.prevPage) : null,
        nextLink: result.hasNextPage ? buildLink(result.nextPage) : null,
        query,
        sort,
      });
    } catch (err) {
      res.status(500).render('error', { message: err.message });
    }
  });

  router.get('/:pid', async (req, res) => {
    try {
      const product = await productManager.getById(req.params.pid);
      res.render('productDetail', { product });
    } catch (err) {
      res.status(404).render('error', { message: err.message });
    }
  });

  return router;
};
```

- [ ] **Step 2: Crear src/routes/views/carts.router.js**

```js
import { Router } from 'express';

export const createCartsViewRouter = (cartManager) => {
  const router = Router();

  router.get('/:cid', async (req, res) => {
    try {
      const cart = await cartManager.getById(req.params.cid);
      const total = cart.products.reduce((sum, item) => {
        return sum + (item.product?.price || 0) * item.quantity;
      }, 0);
      res.render('cart', { cart, total: total.toFixed(2) });
    } catch (err) {
      res.status(404).render('error', { message: err.message });
    }
  });

  return router;
};
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/views/
git commit -m "feat: add view routers for products and cart"
```

---

## Task 9: CSS — Estilo Clean Minimal

**Files:**
- Create: `src/public/css/style.css`

- [ ] **Step 1: Crear src/public/css/style.css**

```css
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f8f8f8;
  color: #1a1a1a;
  min-height: 100vh;
}

/* Navbar */
.navbar {
  background: #fff;
  border-bottom: 1px solid #e5e5e5;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.brand { font-size: 22px; font-weight: 700; color: #2563eb; text-decoration: none; letter-spacing: -0.5px; }
.tagline { color: #888; font-size: 13px; }

/* Container */
.container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }

/* Page header */
.page-header { margin-bottom: 24px; }
.page-header h1 { font-size: 28px; font-weight: 700; margin-bottom: 12px; }

/* Filters */
.filters { display: flex; gap: 8px; flex-wrap: wrap; }
.btn-filter {
  padding: 6px 14px; border-radius: 20px; border: 1px solid #e5e5e5;
  background: #fff; color: #555; text-decoration: none; font-size: 13px;
  transition: all 0.15s;
}
.btn-filter:hover, .btn-filter.active { background: #2563eb; color: #fff; border-color: #2563eb; }

/* Products grid */
.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}
.product-card {
  background: #fff; border: 1px solid #e5e5e5; border-radius: 10px;
  overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  transition: transform 0.15s, box-shadow 0.15s;
}
.product-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.product-card a { text-decoration: none; color: inherit; display: block; }
.product-img {
  height: 180px; background: #f0f0f0;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.product-img img { width: 100%; height: 100%; object-fit: cover; }
.img-placeholder { font-size: 48px; }
.product-info { padding: 14px; }
.product-info h3 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.category {
  display: inline-block; font-size: 11px; color: #2563eb;
  background: #eff6ff; padding: 2px 8px; border-radius: 10px; margin-bottom: 6px;
}
.price { font-size: 16px; font-weight: 700; color: #1a1a1a; margin: 4px 0; }
.stock { font-size: 11px; color: #16a34a; }
.stock.out { color: #dc2626; }

/* Pagination */
.pagination {
  display: flex; align-items: center; gap: 12px;
  justify-content: center; margin-top: 8px;
}
.btn-page {
  padding: 8px 18px; background: #2563eb; color: #fff;
  border-radius: 6px; text-decoration: none; font-size: 14px; transition: background 0.15s;
}
.btn-page:hover { background: #1d4ed8; }

/* Product detail */
.product-detail {
  display: grid; grid-template-columns: 1fr 1fr; gap: 40px;
  background: #fff; border-radius: 12px; padding: 32px; border: 1px solid #e5e5e5;
}
@media (max-width: 640px) { .product-detail { grid-template-columns: 1fr; } }
.detail-img {
  border-radius: 8px; overflow: hidden; background: #f0f0f0;
  min-height: 300px; display: flex; align-items: center; justify-content: center;
}
.detail-img img { width: 100%; height: 100%; object-fit: cover; }
.img-placeholder-lg { font-size: 80px; }
.detail-info .category { margin-bottom: 8px; }
.detail-info h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
.description { color: #555; line-height: 1.6; margin-bottom: 16px; }
.price-lg { font-size: 32px; font-weight: 700; color: #2563eb; margin-bottom: 8px; }
.stock-info { color: #16a34a; margin-bottom: 8px; font-size: 14px; }
.code { color: #888; font-size: 12px; margin-bottom: 20px; }
.btn-primary {
  display: inline-block; padding: 12px 24px; background: #2563eb;
  color: #fff; border: none; border-radius: 8px; font-size: 15px;
  cursor: pointer; text-decoration: none; transition: background 0.15s; margin-bottom: 10px;
}
.btn-primary:hover { background: #1d4ed8; }
.btn-back { display: inline-block; color: #2563eb; text-decoration: none; font-size: 14px; margin-top: 8px; }

/* Cart */
.cart-page h1 { font-size: 28px; font-weight: 700; margin-bottom: 24px; }
.cart-items { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
.cart-item {
  display: flex; gap: 16px; background: #fff;
  border: 1px solid #e5e5e5; border-radius: 10px; padding: 16px;
}
.cart-item-img {
  width: 80px; height: 80px; background: #f0f0f0;
  border-radius: 6px; overflow: hidden; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0;
}
.cart-item-img img { width: 100%; height: 100%; object-fit: cover; }
.img-placeholder-sm { font-size: 24px; }
.cart-item-info h3 { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.subtotal { font-weight: 700; color: #2563eb; margin-top: 4px; font-size: 14px; }
.cart-total {
  background: #fff; border: 1px solid #e5e5e5;
  border-radius: 10px; padding: 20px; text-align: right;
}
.cart-total h2 { font-size: 24px; margin-bottom: 12px; }
.empty-cart { text-align: center; padding: 60px; color: #888; }
.empty-cart p { font-size: 18px; margin-bottom: 16px; }

/* Error */
.error-page { text-align: center; padding: 60px; }
.error-page h1 { font-size: 32px; color: #dc2626; margin-bottom: 12px; }

/* Footer */
footer {
  text-align: center; padding: 20px; color: #888;
  font-size: 13px; border-top: 1px solid #e5e5e5; margin-top: 40px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/public/css/style.css
git commit -m "feat: add Clean Minimal CSS stylesheet"
```

---

## Task 10: Vistas Handlebars

**Files:**
- Create: `src/views/layouts/main.handlebars`
- Create: `src/views/products.handlebars`
- Create: `src/views/productDetail.handlebars`
- Create: `src/views/cart.handlebars`
- Create: `src/views/error.handlebars`

- [ ] **Step 1: Crear src/views/layouts/main.handlebars**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ChronoShop</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <nav class="navbar">
    <a href="/products" class="brand">ChronoShop</a>
    <span class="tagline">Relojes de calidad al mejor precio</span>
  </nav>
  <main class="container">
    {{{body}}}
  </main>
  <footer>
    <p>© 2026 ChronoShop — Proyecto Backend CoderHouse</p>
  </footer>
  <script src="/socket.io/socket.io.js"></script>
</body>
</html>
```

- [ ] **Step 2: Crear src/views/products.handlebars**

```html
<div class="page-header">
  <h1>Catálogo de Relojes</h1>
  <div class="filters">
    <a href="/products" class="btn-filter {{#unless query}}active{{/unless}}">Todos</a>
    <a href="/products?query=Sport"  class="btn-filter {{#if (eq query 'Sport')}}active{{/if}}">Sport</a>
    <a href="/products?query=Dress"  class="btn-filter {{#if (eq query 'Dress')}}active{{/if}}">Dress</a>
    <a href="/products?query=Casual" class="btn-filter {{#if (eq query 'Casual')}}active{{/if}}">Casual</a>
    <a href="/products?query=Smart"  class="btn-filter {{#if (eq query 'Smart')}}active{{/if}}">Smart</a>
    <a href="/products?sort=asc"  class="btn-filter {{#if (eq sort 'asc')}}active{{/if}}">Precio ↑</a>
    <a href="/products?sort=desc" class="btn-filter {{#if (eq sort 'desc')}}active{{/if}}">Precio ↓</a>
  </div>
</div>

<div class="products-grid" id="products-grid">
  {{#each payload}}
  <div class="product-card" id="product-{{_id}}">
    <a href="/products/{{_id}}">
      <div class="product-img">
        {{#if thumbnails.[0]}}
          <img src="{{thumbnails.[0]}}" alt="{{title}}">
        {{else}}
          <div class="img-placeholder">⌚</div>
        {{/if}}
      </div>
      <div class="product-info">
        <h3>{{title}}</h3>
        <span class="category">{{category}}</span>
        <p class="price">${{price}}</p>
        <span class="stock {{#unless status}}out{{/unless}}">
          {{#if status}}En stock ({{stock}}){{else}}Sin stock{{/if}}
        </span>
      </div>
    </a>
  </div>
  {{/each}}
</div>

<div class="pagination">
  {{#if hasPrevPage}}<a href="{{prevLink}}" class="btn-page">← Anterior</a>{{/if}}
  <span>Página {{page}} de {{totalPages}}</span>
  {{#if hasNextPage}}<a href="{{nextLink}}" class="btn-page">Siguiente →</a>{{/if}}
</div>

<script>
const socket = io();
socket.on('newProduct', (product) => {
  const grid = document.getElementById('products-grid');
  const card = document.createElement('div');
  card.className = 'product-card';
  card.id = `product-${product._id}`;
  card.innerHTML = `
    <a href="/products/${product._id}">
      <div class="product-img">
        ${product.thumbnails[0]
          ? `<img src="${product.thumbnails[0]}" alt="${product.title}">`
          : '<div class="img-placeholder">⌚</div>'}
      </div>
      <div class="product-info">
        <h3>${product.title}</h3>
        <span class="category">${product.category}</span>
        <p class="price">$${product.price}</p>
        <span class="stock">En stock (${product.stock})</span>
      </div>
    </a>`;
  grid.appendChild(card);
});
socket.on('deleteProduct', (id) => {
  document.getElementById(`product-${id}`)?.remove();
});
</script>
```

- [ ] **Step 3: Crear src/views/productDetail.handlebars**

```html
<div class="product-detail">
  <div class="detail-img">
    {{#if product.thumbnails.[0]}}
      <img src="{{product.thumbnails.[0]}}" alt="{{product.title}}">
    {{else}}
      <div class="img-placeholder-lg">⌚</div>
    {{/if}}
  </div>
  <div class="detail-info">
    <span class="category">{{product.category}}</span>
    <h1>{{product.title}}</h1>
    <p class="description">{{product.description}}</p>
    <p class="price-lg">${{product.price}}</p>
    <p class="stock-info">
      {{#if product.status}}✓ En stock — {{product.stock}} unidades{{else}}✗ Sin stock{{/if}}
    </p>
    <p class="code">Código: {{product.code}}</p>

    {{#if product.status}}
    <button class="btn-primary" id="add-cart-btn">Agregar al carrito</button>
    {{/if}}
    <br>
    <a href="/products" class="btn-back">← Volver al catálogo</a>
  </div>
</div>

<script>
const productId = '{{product._id}}';

document.getElementById('add-cart-btn')?.addEventListener('click', async () => {
  let cartId = localStorage.getItem('cartId');
  if (!cartId) {
    const res = await fetch('/api/carts', { method: 'POST' });
    const data = await res.json();
    cartId = data.payload._id;
    localStorage.setItem('cartId', cartId);
  }
  const res = await fetch(`/api/carts/${cartId}/products/${productId}`, { method: 'POST' });
  if (res.ok) {
    window.location.href = `/carts/${cartId}`;
  } else {
    alert('Error al agregar al carrito');
  }
});
</script>
```

- [ ] **Step 4: Crear src/views/cart.handlebars**

```html
<div class="cart-page">
  <h1>Mi Carrito</h1>

  {{#if cart.products.length}}
  <div class="cart-items">
    {{#each cart.products}}
    <div class="cart-item">
      <div class="cart-item-img">
        {{#if product.thumbnails.[0]}}
          <img src="{{product.thumbnails.[0]}}" alt="{{product.title}}">
        {{else}}
          <div class="img-placeholder-sm">⌚</div>
        {{/if}}
      </div>
      <div class="cart-item-info">
        <h3>{{product.title}}</h3>
        <span class="category">{{product.category}}</span>
        <p class="price">${{product.price}} × {{quantity}}</p>
        <p class="subtotal">Subtotal: ${{multiply product.price quantity}}</p>
      </div>
    </div>
    {{/each}}
  </div>
  <div class="cart-total">
    <h2>Total: ${{total}}</h2>
    <a href="/products" class="btn-primary">Seguir comprando</a>
  </div>
  {{else}}
  <div class="empty-cart">
    <p>Tu carrito está vacío</p>
    <a href="/products" class="btn-primary">Ver catálogo</a>
  </div>
  {{/if}}
</div>
```

- [ ] **Step 5: Crear src/views/error.handlebars**

```html
<div class="error-page">
  <h1>Error</h1>
  <p>{{message}}</p>
  <br>
  <a href="/products" class="btn-primary">Volver al inicio</a>
</div>
```

- [ ] **Step 6: Commit**

```bash
git add src/views/
git commit -m "feat: add Handlebars views with Clean Minimal style and Socket.io client"
```

---

## Task 11: app.js — Servidor principal

**Files:**
- Create: `app.js`

- [ ] **Step 1: Crear app.js**

```js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { engine } from 'express-handlebars';
import { connect } from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';
import 'dotenv/config';

import { ProductMongoDAO }       from './src/dao/mongo/ProductMongoDAO.js';
import { ProductFileSystemDAO }  from './src/dao/fileSystem/ProductFileSystemDAO.js';
import { CartMongoDAO }          from './src/dao/mongo/CartMongoDAO.js';
import { CartFileSystemDAO }     from './src/dao/fileSystem/CartFileSystemDAO.js';
import { ProductManager }        from './src/managers/ProductManager.js';
import { CartManager }           from './src/managers/CartManager.js';
import { createProductsRouter }      from './src/routes/api/products.router.js';
import { createCartsRouter }         from './src/routes/api/carts.router.js';
import { createProductsViewRouter }  from './src/routes/views/products.router.js';
import { createCartsViewRouter }     from './src/routes/views/carts.router.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src/public')));

app.engine('handlebars', engine({
  helpers: {
    eq:       (a, b) => a === b,
    multiply: (a, b) => (Number(a) * Number(b)).toFixed(2),
  },
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'src/views'));

const persistence = process.env.PERSISTENCE || 'mongo';
const productDAO = persistence === 'mongo' ? new ProductMongoDAO() : new ProductFileSystemDAO();
const cartDAO    = persistence === 'mongo' ? new CartMongoDAO()    : new CartFileSystemDAO();
const productManager = new ProductManager(productDAO);
const cartManager    = new CartManager(cartDAO);

app.use('/api/products', createProductsRouter(productManager, io));
app.use('/api/carts',    createCartsRouter(cartManager));
app.use('/products',     createProductsViewRouter(productManager));
app.use('/carts',        createCartsViewRouter(cartManager));
app.get('/', (req, res) => res.redirect('/products'));

if (persistence === 'mongo') {
  await connect(process.env.MONGODB_URI);
  console.log('MongoDB conectado');
}

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
```

- [ ] **Step 2: Verificar que el servidor arranca**

```bash
node app.js
```

Esperado en consola:
```
MongoDB conectado
Servidor corriendo en http://localhost:8080
```

Abrí el navegador en `http://localhost:8080` — debe redirigir a `/products` y mostrar el catálogo (vacío por ahora).

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add main Express server with Socket.io, Handlebars and DAO wiring"
```

---

## Task 12: Script de seed

**Files:**
- Create: `seed.js`

- [ ] **Step 1: Crear seed.js**

```js
import { connect, disconnect } from 'mongoose';
import 'dotenv/config';
import { Product } from './src/models/Product.js';

const products = [
  {
    title: 'Casio G-Shock GA-2100',
    description: 'Reloj deportivo ultrarresistente con caja octogonal inspirada en el carbono. Protección contra golpes y resistencia al agua hasta 200m. El icónico "CasiOak".',
    code: 'CASIO-GA2100-BLK',
    price: 99,
    status: true,
    stock: 20,
    category: 'Sport',
    thumbnails: ['https://picsum.photos/seed/ga2100/400/400'],
  },
  {
    title: 'Casio Edifice EFR-552',
    description: 'Cronógrafo analógico multifunción con bisel negro y acabado en acero inoxidable. Diseño ejecutivo de alto rendimiento.',
    code: 'CASIO-EFR552-BLK',
    price: 130,
    status: true,
    stock: 15,
    category: 'Dress',
    thumbnails: ['https://picsum.photos/seed/efr552/400/400'],
  },
  {
    title: 'Casio Vintage A168W',
    description: 'Icónico reloj digital retro con caja de acero y pantalla LED. Un clásico atemporal que no ha cambiado desde los años 80.',
    code: 'CASIO-A168W-SLV',
    price: 85,
    status: true,
    stock: 25,
    category: 'Casual',
    thumbnails: ['https://picsum.photos/seed/a168w/400/400'],
  },
  {
    title: 'Seiko 5 Sports SNKE49',
    description: 'Automático con movimiento 7S26, esfera marrón con índices dorados y correa de cuero. El clásico accesible del segmento automático.',
    code: 'SEIKO-SNKE49-BRN',
    price: 180,
    status: true,
    stock: 12,
    category: 'Sport',
    thumbnails: ['https://picsum.photos/seed/snke49/400/400'],
  },
  {
    title: 'Seiko Presage SRPE41',
    description: 'Automático con esfera azul "pétalo de sakura" y acabados combinados pulido/cepillado. Movimiento de 45h de reserva de marcha.',
    code: 'SEIKO-SRPE41-BLU',
    price: 320,
    status: true,
    stock: 8,
    category: 'Dress',
    thumbnails: ['https://picsum.photos/seed/srpe41/400/400'],
  },
  {
    title: 'Seiko Prospex SPB051',
    description: 'Automático diver inspirado en el histórico 62MAS. Esfera negra con índices luminosos, resistente hasta 200m de profundidad.',
    code: 'SEIKO-SPB051-BLK',
    price: 650,
    status: true,
    stock: 5,
    category: 'Sport',
    thumbnails: ['https://picsum.photos/seed/spb051/400/400'],
  },
  {
    title: 'Fossil Machine FS5343',
    description: 'Analógico de tres agujas con bisel pulsador y caja de 45mm en acero plateado. Esfera azul con estilo industrial moderno.',
    code: 'FOSSIL-FS5343-SLV',
    price: 155,
    status: true,
    stock: 18,
    category: 'Casual',
    thumbnails: ['https://picsum.photos/seed/fs5343/400/400'],
  },
  {
    title: 'Fossil Gen 6 FTW4059',
    description: 'Smartwatch con Wear OS, chip Snapdragon 4100+, monitoreo de salud avanzado y carga rápida. Caja de 44mm en acero con correa de silicona.',
    code: 'FOSSIL-FTW4059-BLK',
    price: 249,
    status: true,
    stock: 10,
    category: 'Smart',
    thumbnails: ['https://picsum.photos/seed/ftw4059/400/400'],
  },
  {
    title: 'Tissot T-Classic T063',
    description: 'Cuarzo suizo ETA con esfera plateada y brazalete de acero. Cristal de zafiro, diseño clásico y resistencia al agua de 30m.',
    code: 'TISSOT-T063-SLV',
    price: 350,
    status: true,
    stock: 7,
    category: 'Dress',
    thumbnails: ['https://picsum.photos/seed/tissott063/400/400'],
  },
  {
    title: 'Tissot PRX Automatic',
    description: 'Automático con esfera azul y brazalete integrado de acero. Inspirado en el original de 1978, movimiento Powermatic 80 con 80h de autonomía.',
    code: 'TISSOT-PRX-BLU',
    price: 550,
    status: true,
    stock: 6,
    category: 'Dress',
    thumbnails: ['https://picsum.photos/seed/tissotprx/400/400'],
  },
];

await connect(process.env.MONGODB_URI);
await Product.deleteMany({});
const inserted = await Product.insertMany(products);
console.log(`✓ ${inserted.length} relojes insertados en MongoDB`);
await disconnect();
```

- [ ] **Step 2: Ejecutar el seed**

```bash
npm run seed
```

Esperado:
```
✓ 10 relojes insertados en MongoDB
```

- [ ] **Step 3: Verificar que el catálogo muestra productos**

```bash
node app.js
```

Abrí `http://localhost:8080/products` — debe mostrar el grid con los 10 relojes.

- [ ] **Step 4: Commit**

```bash
git add seed.js
git commit -m "feat: add seed script with 10 real watches"
```

---

## Task 13: Verificación integral de endpoints

Con el servidor corriendo (`node app.js`), verificar todos los endpoints.

- [ ] **Step 1: GET /api/products — paginación**

```bash
curl http://localhost:8080/api/products | python3 -m json.tool
```

Esperado: `status: "success"`, `payload` con 10 productos, `totalPages: 1`.

- [ ] **Step 2: GET /api/products con filtros**

```bash
curl "http://localhost:8080/api/products?query=Sport&sort=asc&limit=5" | python3 -m json.tool
```

Esperado: solo productos de categoría Sport, ordenados por precio ascendente.

- [ ] **Step 3: GET /api/products/:pid**

Tomá el `_id` de cualquier producto del paso anterior y:
```bash
curl http://localhost:8080/api/products/<ID_AQUI> | python3 -m json.tool
```

Esperado: `status: "success"`, producto con todos sus campos.

- [ ] **Step 4: POST /api/products**

```bash
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Watch",
    "description": "Reloj de prueba",
    "code": "TEST-001",
    "price": 200,
    "stock": 5,
    "category": "Casual"
  }' | python3 -m json.tool
```

Esperado: producto creado con `_id` autogenerado.

- [ ] **Step 5: POST /api/carts + agregar producto**

```bash
# Crear carrito
curl -X POST http://localhost:8080/api/carts | python3 -m json.tool
# Guardar el _id del carrito como CART_ID
# Guardar el _id de un producto como PROD_ID

# Agregar producto
curl -X POST http://localhost:8080/api/carts/<CART_ID>/products/<PROD_ID> | python3 -m json.tool
```

Esperado: carrito con el producto y `quantity: 1`.

- [ ] **Step 6: GET /api/carts/:cid con populate**

```bash
curl http://localhost:8080/api/carts/<CART_ID> | python3 -m json.tool
```

Esperado: carrito con el objeto producto completo (no solo el ID) dentro de `products[].product`.

- [ ] **Step 7: Verificar WebSockets**

Abrí dos pestañas del navegador en `http://localhost:8080/products`.

En una terminal aparte, creá un producto nuevo con curl (Step 4 sin `TEST-001` para evitar duplicate key, usá `TEST-002`).

Esperado: el producto aparece en ambas pestañas sin recargar la página.

- [ ] **Step 8: Verificar flujo de vistas**

1. Abrí `http://localhost:8080/products` — catálogo visible
2. Hacé click en un producto — detalle visible
3. Hacé click en "Agregar al carrito" — redirige al carrito con el producto
4. Visitá `http://localhost:8080/products?query=Sport` — solo relojes Sport
5. Visitá `http://localhost:8080/products?sort=asc` — ordenados por precio

- [ ] **Step 9: Commit final**

```bash
git add -A
git commit -m "chore: complete ChronoShop backend — all endpoints and views working"
```

---

## Notas finales

**Imágenes:** El seed usa URLs de `picsum.photos` como placeholder. Para reemplazarlas con imágenes generadas por IA, guardar los archivos en `src/public/images/` y actualizar las URLs en `seed.js` a `/images/nombre-archivo.jpg`, luego re-ejecutar `npm run seed`.

**Cambiar a FileSystem:** En `.env`, cambiar `PERSISTENCE=fs` para usar JSONs locales en lugar de MongoDB.

**Cambiar a FileSystem y verificar:**
```bash
# En .env: PERSISTENCE=fs
node app.js
# En otra terminal:
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -d '{"title":"FS Test","description":"D","code":"FS-001","price":99,"stock":5,"category":"Casual"}'
# Verificar src/data/products.json — debe tener el producto
```
