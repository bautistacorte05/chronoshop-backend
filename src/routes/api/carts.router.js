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
