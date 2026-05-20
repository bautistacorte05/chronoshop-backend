import { Router } from 'express';
import { authJWT }   from '../../middlewares/authJWT.js'
import { authAdmin } from '../../middlewares/authRole.js'

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

  router.post('/', authJWT, authAdmin, async (req, res) => {
    try {
      const product = await productManager.create(req.body);
      io.emit('newProduct', product);
      res.status(201).json({ status: 'success', payload: product });
    } catch (err) {
      res.status(400).json({ status: 'error', message: err.message });
    }
  });

  router.put('/:pid', authJWT, authAdmin, async (req, res) => {
    try {
      const product = await productManager.update(req.params.pid, req.body);
      res.json({ status: 'success', payload: product });
    } catch (err) {
      res.status(404).json({ status: 'error', message: err.message });
    }
  });

  router.delete('/:pid', authJWT, authAdmin, async (req, res) => {
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
