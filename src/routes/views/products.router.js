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
