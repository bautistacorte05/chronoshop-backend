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
