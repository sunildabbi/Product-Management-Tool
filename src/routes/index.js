import express from 'express';
import categories from './categories.js';
import attributes from './attributes.js';
import products from './products.js';

const router = express.Router();

router.use('/categories', categories);
router.use('/attributes', attributes);
router.use('/products', products);

export default router;