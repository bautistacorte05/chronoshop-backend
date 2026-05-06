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
