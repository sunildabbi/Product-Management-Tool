import { db } from '../db.js';
import { AppError } from '../utils/errors.js';

export function toRowAttr(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    data_type: row.data_type,
    allowed_values: row.allowed_values ? JSON.parse(row.allowed_values) : undefined,
    validation_regex: row.validation_regex || undefined,
    is_active: !!row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function createAttribute(payload) {
  const { name, data_type, allowed_values, validation_regex, is_active = true } = payload;
  try {
    const stmt = db.prepare(`
      INSERT INTO attributes (name, data_type, allowed_values, validation_regex, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(name, data_type, allowed_values ? JSON.stringify(allowed_values) : null, validation_regex || null, is_active ? 1 : 0);
    return getAttributeById(info.lastInsertRowid);
  } catch (e) {
    if (String(e).includes('UNIQUE') && String(e).includes('attributes.name')) {
      throw new AppError(409, `Attribute with name '${name}' already exists`);
    }
    throw e;
  }
}

export function getAttributeById(id) {
  const row = db.prepare('SELECT * FROM attributes WHERE id = ?').get(id);
  return toRowAttr(row);
}

export function getAttributeByName(name) {
  const row = db.prepare('SELECT * FROM attributes WHERE name = ?').get(name);
  return toRowAttr(row);
}

export function listAttributes({ activeOnly = false } = {}) {
  const rows = activeOnly
    ? db.prepare('SELECT * FROM attributes WHERE is_active = 1 ORDER BY name').all()
    : db.prepare('SELECT * FROM attributes ORDER BY name').all();
  return rows.map(toRowAttr);
}

export function updateAttribute(id, payload) {
  const prev = getAttributeById(id);
  if (!prev) throw new AppError(404, 'Attribute not found');
  const merged = { ...prev, ...payload };
  const stmt = db.prepare(`
    UPDATE attributes SET name=?, data_type=?, allowed_values=?, validation_regex=?, is_active=? WHERE id=?
  `);
  try {
    stmt.run(
      merged.name,
      merged.data_type,
      merged.allowed_values ? JSON.stringify(merged.allowed_values) : null,
      merged.validation_regex || null,
      merged.is_active ? 1 : 0,
      id
    );
  } catch (e) {
    if (String(e).includes('UNIQUE') && String(e).includes('attributes.name')) {
      throw new AppError(409, `Attribute with name '${merged.name}' already exists`);
    }
    throw e;
  }
  return getAttributeById(id);
}

export function safeDeleteAttribute(id) {

  const mapping = db.prepare('SELECT 1 FROM category_attributes WHERE attribute_id = ? LIMIT 1').get(id);
  if (mapping) {
    throw new AppError(409, 'Cannot delete attribute that is mapped to a category. Unmap first.');
  }
  const usage = db.prepare('SELECT 1 FROM product_attribute_values WHERE attribute_id = ? LIMIT 1').get(id);
  if (usage) {
    throw new AppError(409, 'Cannot delete attribute that has product values. Remove values first.');
  }
  const res = db.prepare('DELETE FROM attributes WHERE id = ?').run(id);
  if (res.changes === 0) throw new AppError(404, 'Attribute not found');
  return { deleted: true };
}