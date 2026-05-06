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
