import { z } from 'zod';
import Database from 'better-sqlite3';
import { AppError } from './errors.js';

export const DataTypes = ['TEXT','NUMBER','BOOLEAN','ENUM','DATE','DATETIME'];

export const attributeSchema = z.object({
  name: z.string().min(1),
  data_type: z.enum(['TEXT','NUMBER','BOOLEAN','ENUM','DATE','DATETIME']),
  allowed_values: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
  validation_regex: z.string().optional(),
  is_active: z.boolean().optional().default(true),
});

export const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(''),
  is_active: z.boolean().optional().default(true),
});

export const categoryAttributeMapSchema = z.object({
  attribute_id: z.number().int().positive().optional(),

  attribute: attributeSchema.optional(),
  is_required: z.boolean().optional().default(false),
  is_unique: z.boolean().optional().default(false),
  default_value: z.any().optional(),
  position: z.number().int().min(0).optional().default(0),
});

export const productSchema = z.object({
  category_id: z.number().int().positive(),
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  price: z.number().nonnegative().optional().default(0),
  currency: z.string().length(3).optional().default('INR'),
  status: z.enum(['ACTIVE','INACTIVE','DRAFT']).optional().default('ACTIVE'),

  attributes: z.union([
    z.record(z.any()),
    z.array(z.object({
      attribute_id: z.number().int().positive().optional(),
      name: z.string().optional(),
      value: z.any()
    }))
  ]).optional().default({})
});

export function coerceBoolean(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const v = val.toLowerCase();
    if (['true','1','yes','y'].includes(v)) return true;
    if (['false','0','no','n'].includes(v)) return false;
  }
  throw new AppError(400, `Invalid boolean value: ${val}`);
}

export function isISODate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}
export function isISODateTime(str) {

  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+\-]\d{2}:?\d{2})?$/.test(str);
}

export function validateAttributeValue(attr, value) {
  const type = attr.data_type;
  if (value === undefined || value === null) {
    throw new AppError(400, `Value for attribute '${attr.name}' cannot be null/undefined`);
  }
  switch (type) {
    case 'TEXT':
      if (typeof value !== 'string') value = String(value);
      break;
    case 'NUMBER':
      if (typeof value === 'string' && value.trim() !== '') value = Number(value);
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new AppError(400, `Attribute '${attr.name}' must be a number`);
      }
      break;
    case 'BOOLEAN':
      value = coerceBoolean(value);
      break;
    case 'ENUM':
      if (!Array.isArray(attr.allowed_values)) {
        throw new AppError(400, `Attribute '${attr.name}' is ENUM but has no allowed_values`);
      }
      if (!attr.allowed_values.map(String).includes(String(value))) {
        throw new AppError(400, `Attribute '${attr.name}' must be one of: ${attr.allowed_values.join(', ')}`);
      }
      value = String(value);
      break;
    case 'DATE':
      if (typeof value !== 'string' || !isISODate(value)) {
        throw new AppError(400, `Attribute '${attr.name}' must be an ISO date (YYYY-MM-DD)`);
      }
      break;
    case 'DATETIME':
      if (typeof value !== 'string' || !isISODateTime(value)) {
        throw new AppError(400, `Attribute '${attr.name}' must be an ISO datetime`);
      }
      break;
    default:
      throw new AppError(400, `Unknown data type '${type}'`);
  }
  if (attr.validation_regex) {
    const re = new RegExp(attr.validation_regex);
    if (!re.test(String(value))) {
      throw new AppError(400, `Attribute '${attr.name}' failed validation_regex`);
    }
  }
  return value;
}