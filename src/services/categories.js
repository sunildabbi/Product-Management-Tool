import { db } from '../db.js';
import { AppError } from '../utils/errors.js';
import { toRowAttr, getAttributeById, createAttribute } from './attributes.js';

function toRowCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    is_active: !!row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function createCategory(payload) {
  const { name, description = '', is_active = true } = payload;
  try {
    const info = db.prepare('INSERT INTO categories(name, description, is_active) VALUES (?, ?, ?)')
      .run(name, description, is_active ? 1 : 0);
    return getCategoryById(info.lastInsertRowid);
  } catch (e) {
    if (String(e).includes('UNIQUE') && String(e).includes('categories.name')) {
      throw new AppError(409, `Category '${name}' already exists`);
    }
    throw e;
  }
}

export function getCategoryById(id) {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  return toRowCategory(row);
}

export function getCategoryByName(name) {
  const row = db.prepare('SELECT * FROM categories WHERE name = ?').get(name);
  return toRowCategory(row);
}

export function listCategories({ includeAttributes = false } = {}) {
  const rows = db.prepare('SELECT * FROM categories ORDER BY name').all();
  const cats = rows.map(toRowCategory);
  if (!includeAttributes) return cats;
  return cats.map(c => ({ ...c, attributes: listCategoryAttributes(c.id) }));
}

export function updateCategory(id, payload) {
  const prev = getCategoryById(id);
  if (!prev) throw new AppError(404, 'Category not found');
  const merged = { ...prev, ...payload };
  try {
    db.prepare('UPDATE categories SET name=?, description=?, is_active=? WHERE id=?')
      .run(merged.name, merged.description || '', merged.is_active ? 1 : 0, id);
  } catch (e) {
    if (String(e).includes('UNIQUE') && String(e).includes('categories.name')) {
      throw new AppError(409, `Category '${merged.name}' already exists`);
    }
    throw e;
  }
  return getCategoryById(id);
}

export function softDeleteCategory(id) {
  const prev = getCategoryById(id);
  if (!prev) throw new AppError(404, 'Category not found');
  db.prepare('UPDATE categories SET is_active = 0 WHERE id=?').run(id);
  return getCategoryById(id);
}

export function listCategoryAttributes(categoryId) {
  const rows = db.prepare(`
    SELECT ca.*, a.*
    FROM category_attributes ca
    JOIN attributes a ON ca.attribute_id = a.id
    WHERE ca.category_id = ?
    ORDER BY ca.position, a.name
  `).all(categoryId);
  return rows.map(r => ({
    category_id: categoryId,
    attribute: toRowAttr({
      id: r.attribute_id,
      name: r.name,
      data_type: r.data_type,
      allowed_values: r.allowed_values,
      validation_regex: r.validation_regex,
      is_active: r.is_active,
      created_at: r.created_at,
      updated_at: r.updated_at
    }),
    is_required: !!r.is_required,
    is_unique: !!r.is_unique,
    default_value: r.default_value !== null ? r.default_value : undefined,
    position: r.position
  }));
}

export function mapAttributeToCategory(categoryId, payload) {
  const cat = getCategoryById(categoryId);
  if (!cat) throw new AppError(404, 'Category not found');
  let attribute_id = payload.attribute_id;
  if (!attribute_id && payload.attribute) {

    const created = createAttribute(payload.attribute);
    attribute_id = created.id;
  }
  if (!attribute_id) throw new AppError(400, 'attribute_id or attribute required');

  try {
    db.prepare(`
      INSERT INTO category_attributes (category_id, attribute_id, is_required, is_unique, default_value, position)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(categoryId, attribute_id, payload.is_required ? 1 : 0, payload.is_unique ? 1 : 0, payload.default_value ?? null, payload.position ?? 0);
  } catch (e) {
    if (String(e).includes('UNIQUE') || String(e).includes('PRIMARY KEY')) {
      throw new AppError(409, 'Attribute already mapped to this category');
    }
    throw e;
  }
  return listCategoryAttributes(categoryId);
}

export function updateCategoryAttribute(categoryId, attributeId, payload) {
  const res = db.prepare(`
    UPDATE category_attributes SET is_required=?, is_unique=?, default_value=?, position=?
    WHERE category_id=? AND attribute_id=?
  `).run(payload.is_required ? 1 : 0, payload.is_unique ? 1 : 0, payload.default_value ?? null, payload.position ?? 0, categoryId, attributeId);
  if (res.changes === 0) throw new AppError(404, 'Mapping not found');
  return listCategoryAttributes(categoryId);
}

export function unmapAttributeFromCategory(categoryId, attributeId, { force = false } = {}) {

  const exists = db.prepare('SELECT 1 FROM product_attribute_values pav JOIN products p ON pav.product_id=p.id WHERE p.category_id=? AND pav.attribute_id = ? LIMIT 1').get(categoryId, attributeId);
  if (exists && !force) {
    throw new AppError(409, 'Attribute has product values. Use force=true to remove along with values.');
  }
  if (force) {
    const productIds = db.prepare('SELECT id FROM products WHERE category_id=?').all(categoryId).map(r => r.id);
    if (productIds.length) {
      const placeholders = productIds.map(() => '?').join(',');
      db.prepare(f`DELETE FROM product_attribute_values WHERE attribute_id=? AND product_id IN ({placeholders})`);
    }
    db.prepare('DELETE FROM product_attribute_values WHERE attribute_id=? AND product_id IN (SELECT id FROM products WHERE category_id=?)').run(attributeId, categoryId);
  }
  const res = db.prepare('DELETE FROM category_attributes WHERE category_id=? AND attribute_id=?').run(categoryId, attributeId);
  if (res.changes === 0) throw new AppError(404, 'Mapping not found');
  return { unmapped: true };
}