import express from 'express';
import { productSchema } from '../utils/validators.js';
import { createProduct, getProductById, listProducts, updateProduct, softDeleteProduct } from '../services/products.js';

const router = express.Router();

router.get('/', (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 25);
  const category_id = req.query.category_id ? Number(req.query.category_id) : undefined;
  const status = req.query.status;
  const q = req.query.q;
  const out = listProducts({ category_id, status, q, page, pageSize });
  res.json(out);
});

router.get('/:id', (req, res) => {
  const item = getProductById(Number(req.params.id));
  if (!item) return res.status(404).json({ error: { message: 'Not found' } });
  res.json(item);
});

router.post('/', (req, res, next) => {
  try {
    const parsed = productSchema.parse(req.body);
    const created = createProduct(parsed);
    res.status(201).json(created);
  } catch (e) { next(e); }
});

router.put('/:id', (req, res, next) => {
  try {
    const parsed = productSchema.partial().parse(req.body);
    const updated = updateProduct(Number(req.params.id), parsed);
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/:id', (req, res, next) => {
  try {
    const out = softDeleteProduct(Number(req.params.id));
    res.json(out);
  } catch (e) { next(e); }
});

export default router;