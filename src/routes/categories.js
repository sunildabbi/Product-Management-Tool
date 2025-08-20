import express from 'express';
import { categorySchema, categoryAttributeMapSchema } from '../utils/validators.js';
import { createCategory, listCategories, getCategoryById, updateCategory, softDeleteCategory, listCategoryAttributes, mapAttributeToCategory, updateCategoryAttribute, unmapAttributeFromCategory } from '../services/categories.js';

const router = express.Router();

router.get('/', (req, res) => {
  const includeAttributes = req.query.includeAttributes === 'true';
  res.json(listCategories({ includeAttributes }));
});

router.get('/:id', (req, res) => {
  const item = getCategoryById(Number(req.params.id));
  if (!item) return res.status(404).json({ error: { message: 'Not found' } });
  res.json(item);
});

router.post('/', (req, res, next) => {
  try {
    const parsed = categorySchema.parse(req.body);
    const created = createCategory(parsed);
    res.status(201).json(created);
  } catch (e) { next(e); }
});

router.put('/:id', (req, res, next) => {
  try {
    const parsed = categorySchema.partial().parse(req.body);
    const updated = updateCategory(Number(req.params.id), parsed);
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/:id', (req, res, next) => {
  try {
    const out = softDeleteCategory(Number(req.params.id));
    res.json(out);
  } catch (e) { next(e); }
});


router.get('/:id/attributes', (req, res) => {
  const out = listCategoryAttributes(Number(req.params.id));
  res.json(out);
});

router.post('/:id/attributes', (req, res, next) => {
  try {
    const parsed = categoryAttributeMapSchema.parse(req.body);
    const mapped = mapAttributeToCategory(Number(req.params.id), parsed);
    res.status(201).json(mapped);
  } catch (e) { next(e); }
});

router.put('/:id/attributes/:attrId', (req, res, next) => {
  try {
    const parsed = categoryAttributeMapSchema.partial().parse(req.body);
    const out = updateCategoryAttribute(Number(req.params.id), Number(req.params.attrId), parsed);
    res.json(out);
  } catch (e) { next(e); }
});

router.delete('/:id/attributes/:attrId', (req, res, next) => {
  try {
    const force = req.query.force === 'true';
    const out = unmapAttributeFromCategory(Number(req.params.id), Number(req.params.attrId), { force });
    res.json(out);
  } catch (e) { next(e); }
});

export default router;