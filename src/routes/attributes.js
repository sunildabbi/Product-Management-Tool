import express from 'express';
import { attributeSchema } from '../utils/validators.js';
import { createAttribute, getAttributeById, listAttributes, updateAttribute, safeDeleteAttribute } from '../services/attributes.js';

const router = express.Router();

router.get('/', (req, res) => {
  const activeOnly = req.query.activeOnly === 'true';
  res.json(listAttributes({ activeOnly }));
});

router.get('/:id', (req, res) => {
  const item = getAttributeById(Number(req.params.id));
  if (!item) return res.status(404).json({ error: { message: 'Not found' } });
  res.json(item);
});

router.post('/', (req, res, next) => {
  try {
    const parsed = attributeSchema.parse(req.body);
    const created = createAttribute(parsed);
    res.status(201).json(created);
  } catch (e) { next(e); }
});

router.put('/:id', (req, res, next) => {
  try {
    const parsed = attributeSchema.partial().parse(req.body);
    const updated = updateAttribute(Number(req.params.id), parsed);
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/:id', (req, res, next) => {
  try {
    const out = safeDeleteAttribute(Number(req.params.id));
    res.json(out);
  } catch (e) { next(e); }
});

export default router;