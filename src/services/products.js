import { db } from '../db.js';
import { AppError } from '../utils/errors.js';
import { validateAttributeValue } from '../utils/validators.js';
import { getCategoryById, listCategoryAttributes } from './categories.js';
import { getAttributeById, getAttributeByName } from './attributes.js';

function toRowProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    category_id: row.category_id,
    sku: row.sku,
    name: row.name,
    description: row.description || '',
    price: row.price,
    currency: row.currency,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function getProductById(id) {
  const row = db.prepare('SELECT * FROM products WHERE id=?').get(id);
  const prod = toRowProduct(row);
  if (!prod) return null;
  prod.attributes = getProductAttributesMap(id);
  return prod;
}

export function listProducts({ category_id, status, q, page = 1, pageSize = 25 }) {
  const where = [];
  const params = [];
  if (category_id) { where.push('category_id = ?'); params.push(category_id); }
  if (status) { where.push('status = ?'); params.push(status); }
  if (q) { where.push('(name LIKE ? OR sku LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`SELECT * FROM products ${clause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
  const items = rows.map(toRowProduct);

  for (const it of items) {
    it.attributes = getProductAttributesMap(it.id);
  }
  const total = db.prepare(`SELECT COUNT(*) as c FROM products ${clause}`).get(...params).c;
  return { page, pageSize, total, items };
}

function getProductAttributesMap(productId) {
  const rows = db.prepare(`
    SELECT a.name, a.id as attribute_id, pav.value_text
    FROM product_attribute_values pav
    JOIN attributes a ON a.id = pav.attribute_id
    WHERE pav.product_id = ?
  `).all(productId);
  const map = {};
  for (const r of rows) map[r.name] = coerceValueFromStorage(r.attribute_id, r.value_text);
  return map;
}

function coerceValueFromStorage(attributeId, valueText) {
  const attr = getAttributeById(attributeId);
  if (!attr) return valueText;
  switch (attr.data_type) {
    case 'TEXT': return String(valueText);
    case 'NUMBER': return Number(valueText);
    case 'BOOLEAN': return valueText === 'true' || valueText === '1';
    case 'ENUM': return String(valueText);
    case 'DATE': return String(valueText);
    case 'DATETIME': return String(valueText);
    default: return valueText;
  }
}

function getCategoryAttributeMeta(categoryId) {
  const mappings = listCategoryAttributes(categoryId);
  const metaByName = new Map();
  const metaById = new Map();
  for (const m of mappings) {
    metaByName.set(m.attribute.name, m);
    metaById.set(m.attribute.id, m);
  }
  return { mappings, metaByName, metaById };
}

function normalizeIncomingAttributes(categoryId, attrs) {
  const { metaByName, metaById } = getCategoryAttributeMeta(categoryId);
  const normalized = new Map();
  if (Array.isArray(attrs)) {
    for (const item of attrs) {
      let attribute_id = item.attribute_id;
      if (!attribute_id && item.name) {
        const meta = metaByName.get(item.name);
        if (!meta) throw new AppError(400, `Unknown attribute '${item.name}' for this category`);
        attribute_id = meta.attribute.id;
      }
      if (!attribute_id) throw new AppError(400, 'Each attribute item needs attribute_id or name');
      if (!metaById.get(attribute_id)) throw new AppError(400, `Attribute id ${attribute_id} not mapped to this category`);
      normalized.set(attribute_id, item.value);
    }
  } else if (attrs && typeof attrs === 'object') {
    for (const [name, value] of Object.entries(attrs)) {
      const meta = metaByName.get(name);
      if (!meta) throw new AppError(400, `Unknown attribute '${name}' for this category`);
      normalized.set(meta.attribute.id, value);
    }
  }
  return normalized;
}

function storeValueForAttribute(attributeId, value) {

  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function enforceRequiredAndUnique(categoryId, productId, normalizedMap) {
  const { mappings } = getCategoryAttributeMeta(categoryId);

  for (const m of mappings) {
    if (m.is_required) {
      if (!normalizedMap.has(m.attribute.id)) {
        if (m.default_value !== undefined && m.default_value !== null) {
          normalizedMap.set(m.attribute.id, m.default_value);
        } else {
          throw new AppError(400, `Missing required attribute '${m.attribute.name}'`);
        }
      }
    }
  }

  for (const m of mappings) {
    if (m.is_unique && normalizedMap.has(m.attribute.id)) {
      const value = storeValueForAttribute(m.attribute.id, normalizedMap.get(m.attribute.id));
      const row = db.prepare(`
        SELECT pav.product_id FROM product_attribute_values pav
        JOIN products p ON pav.product_id = p.id
        WHERE p.category_id = ? AND pav.attribute_id = ? AND pav.value_text = ? AND pav.product_id != ?
        LIMIT 1
      `).get(categoryId, m.attribute.id, value, productId || 0);
      if (row) {
        throw new AppError(409, `Value for unique attribute '${m.attribute.name}' already exists on another product`);
      }
    }
  }
}

export function createProduct(payload) {
  const category = getCategoryById(payload.category_id);
  if (!category || !category.is_active) throw new AppError(400, 'Invalid or inactive category');

  const incoming = payload.attributes || {};
  const normalized = normalizeIncomingAttributes(payload.category_id, incoming);


  for (const [attributeId, value] of normalized.entries()) {
    const attr = getAttributeById(attributeId);
    const valid = validateAttributeValue(attr, value);
    normalized.set(attributeId, valid);
  }


  enforceRequiredAndUnique(payload.category_id, null, normalized);


  let productId;
  try {
    const info = db.prepare(`
      INSERT INTO products (category_id, sku, name, description, price, currency, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(payload.category_id, payload.sku, payload.name, payload.description || '', payload.price || 0, payload.currency || 'INR', payload.status || 'ACTIVE');
    productId = info.lastInsertRowid;
  } catch (e) {
    if (String(e).includes('UNIQUE') && String(e).includes('products.sku')) {
      throw new AppError(409, `SKU '${payload.sku}' already exists`);
    }
    throw e;
  }


  const stmt = db.prepare('INSERT INTO product_attribute_values (product_id, attribute_id, value_text) VALUES (?, ?, ?)');
  const insertMany = db.transaction((entries) => {
    for (const [aid, val] of entries) {
      stmt.run(productId, aid, storeValueForAttribute(aid, val));
    }
  });
  insertMany([...normalized.entries()]);

  return getProductById(productId);
}

export function updateProduct(id, payload) {
  const prev = getProductById(id);
  if (!prev) throw new AppError(404, 'Product not found');

  const merged = { ...prev, ...payload };

  try {
    db.prepare(`UPDATE products SET category_id=?, sku=?, name=?, description=?, price=?, currency=?, status=? WHERE id=?`)
      .run(merged.category_id, merged.sku, merged.name, merged.description || '', merged.price || 0, merged.currency || 'INR', merged.status || 'ACTIVE', id);
  } catch (e) {
    if (String(e).includes('UNIQUE') && String(e).includes('products.sku')) {
      throw new AppError(409, `SKU '${merged.sku}' already exists`);
    }
    throw e;
  }


  if (payload.attributes !== undefined) {
    const normalized = normalizeIncomingAttributes(merged.category_id, payload.attributes);


    for (const [attributeId, value] of normalized.entries()) {
      const attr = getAttributeById(attributeId);
      const valid = validateAttributeValue(attr, value);
      normalized.set(attributeId, valid);
    }



    const currentRows = db.prepare('SELECT attribute_id, value_text FROM product_attribute_values WHERE product_id=?').all(id);
    const finalMap = new Map(currentRows.map(r => [r.attribute_id, coerceValueFromStorage(r.attribute_id, r.value_text)]));
    for (const [aid, val] of normalized.entries()) finalMap.set(aid, val);

    enforceRequiredAndUnique(merged.category_id, id, finalMap);


    const upsert = db.prepare(`
      INSERT INTO product_attribute_values (product_id, attribute_id, value_text)
      VALUES (?, ?, ?)
      ON CONFLICT(product_id, attribute_id) DO UPDATE SET value_text=excluded.value_text, updated_at=datetime('now')
    `);
    const tx = db.transaction((entries) => {
      for (const [aid, val] of entries) {
        upsert.run(id, aid, storeValueForAttribute(aid, val));
      }
    });
    tx([...normalized.entries()]);
  }

  return getProductById(id);
}

export function softDeleteProduct(id) {
  const res = db.prepare("UPDATE products SET status='INACTIVE' WHERE id=?").run(id);
  if (res.changes === 0) throw new AppError(404, 'Product not found');
  return getProductById(id);
}