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
