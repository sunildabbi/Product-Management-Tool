import dotenv from 'dotenv'; dotenv.config();
import { runMigrations, db } from '../src/db.js';
import { createCategory, mapAttributeToCategory } from '../src/services/categories.js';
import { createAttribute, getAttributeByName } from '../src/services/attributes.js';
import { createProduct } from '../src/services/products.js';

runMigrations();

function ensureAttribute(payload) {
  const existing = getAttributeByName(payload.name);
  if (existing) return existing;
  return createAttribute(payload);
}

function ensureCategory(name, description) {
  const row = db.prepare('SELECT * FROM categories WHERE name=?').get(name);
  if (row) return { id: row.id, name: row.name, description: row.description, is_active: !!row.is_active };
  return createCategory({ name, description });
}

function mapIfNotMapped(categoryId, attrId, props) {
  const row = db.prepare('SELECT 1 FROM category_attributes WHERE category_id=? AND attribute_id=?').get(categoryId, attrId);
  if (!row) mapAttributeToCategory(categoryId, { attribute_id: attrId, ...props });
}

const dresses = ensureCategory('Dresses', 'Women dresses');
const shoes = ensureCategory('Shoes', 'Footwear');

const sizeEnum = ensureAttribute({ name: 'Size', data_type: 'ENUM', allowed_values: ['XS','S','M','L','XL'] });
const color = ensureAttribute({ name: 'Color', data_type: 'TEXT' });
const fabric = ensureAttribute({ name: 'Fabric', data_type: 'TEXT' });

mapIfNotMapped(dresses.id, sizeEnum.id, { is_required: true, is_unique: false, position: 1 });
mapIfNotMapped(dresses.id, color.id, { is_required: true, position: 2 });
mapIfNotMapped(dresses.id, fabric.id, { is_required: false, position: 3 });

const shoeSize = ensureAttribute({ name: 'Shoe Size', data_type: 'NUMBER' });
const material = ensureAttribute({ name: 'Material', data_type: 'TEXT' });
const gender = ensureAttribute({ name: 'Gender', data_type: 'ENUM', allowed_values: ['Men','Women','Unisex'] });

mapIfNotMapped(shoes.id, shoeSize.id, { is_required: true, position: 1 });
mapIfNotMapped(shoes.id, material.id, { is_required: false, position: 2 });
mapIfNotMapped(shoes.id, gender.id, { is_required: true, position: 3 });


try {
  createProduct({
    category_id: dresses.id,
    sku: 'DRS-1001',
    name: 'Red Summer Dress',
    price: 1299,
    currency: 'INR',
    attributes: { 'Size': 'M', 'Color': 'Red', 'Fabric': 'Cotton' }
  });
} catch {}
try {
  createProduct({
    category_id: shoes.id,
    sku: 'SHO-2001',
    name: 'Running Shoe',
    price: 2499,
    currency: 'INR',
    attributes: { 'Shoe Size': 9, 'Material': 'Mesh', 'Gender': 'Men' }
  });
} catch {}

console.log('Seed complete.');