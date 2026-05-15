import { randomUUID } from 'crypto';
import { NotFoundError, ValidationError } from '../errors/index.js';

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * List all active ticket categories.
 */
export function listCategories(db) {
  return db.prepare(
    `SELECT id, name, slug, is_active, created_at, updated_at
     FROM ticket_category
     WHERE is_active = 1
     ORDER BY name ASC`
  ).all();
}

/**
 * List all ticket categories (including inactive) — admin view.
 */
export function listAllCategories(db) {
  return db.prepare(
    `SELECT id, name, slug, is_active, created_at, updated_at
     FROM ticket_category
     ORDER BY name ASC`
  ).all();
}

/**
 * Create a new ticket category.
 */
export function createCategory(db, { name }) {
  if (!name || !name.trim()) {
    throw new ValidationError('Category name is required');
  }
  const slug = slugify(name);
  const existing = db.prepare('SELECT id FROM ticket_category WHERE slug = ?').get(slug);
  if (existing) {
    throw new ValidationError(`A category with the name '${name}' already exists`);
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO ticket_category (id, name, slug, is_active, created_at, updated_at)
     VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`
  ).run(id, name.trim(), slug);
  return db.prepare('SELECT * FROM ticket_category WHERE id = ?').get(id);
}

/**
 * Rename an existing ticket category.
 */
export function renameCategory(db, id, name) {
  if (!name || !name.trim()) {
    throw new ValidationError('Category name is required');
  }
  const existing = db.prepare('SELECT * FROM ticket_category WHERE id = ?').get(id);
  if (!existing) throw new NotFoundError(`Category ${id} not found`);

  const slug = slugify(name);
  const conflict = db.prepare(
    'SELECT id FROM ticket_category WHERE slug = ? AND id != ?'
  ).get(slug, id);
  if (conflict) {
    throw new ValidationError(`A category with the name '${name}' already exists`);
  }

  db.prepare(
    `UPDATE ticket_category SET name = ?, slug = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(name.trim(), slug, id);
  return db.prepare('SELECT * FROM ticket_category WHERE id = ?').get(id);
}

/**
 * Deactivate a category (soft-delete). Does not remove existing ticket associations.
 */
export function deactivateCategory(db, id) {
  const existing = db.prepare('SELECT * FROM ticket_category WHERE id = ?').get(id);
  if (!existing) throw new NotFoundError(`Category ${id} not found`);
  db.prepare(
    `UPDATE ticket_category SET is_active = 0, updated_at = datetime('now') WHERE id = ?`
  ).run(id);
  return db.prepare('SELECT * FROM ticket_category WHERE id = ?').get(id);
}
