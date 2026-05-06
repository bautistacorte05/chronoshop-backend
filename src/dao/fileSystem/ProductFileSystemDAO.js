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
