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
