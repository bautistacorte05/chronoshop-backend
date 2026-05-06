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
