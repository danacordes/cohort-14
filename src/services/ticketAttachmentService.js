import { randomUUID } from 'crypto';
import { ValidationError } from '../errors/index.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Persist attachment metadata rows for a ticket.
 * Binary data is not stored in SQLite — storageKey is an opaque reference
 * for a future file storage backend (S3, local disk, etc.).
 *
 * @param {object} db           write connection
 * @param {string} ticketId
 * @param {string} uploadedBy   user id
 * @param {Array}  attachments  [{ filename, mimeType, sizeBytes, storageKey }]
 * @returns {Array} saved attachment rows
 */
export function saveAttachments(db, ticketId, uploadedBy, attachments) {
  if (!attachments || attachments.length === 0) return [];

  const stmt = db.prepare(
    `INSERT INTO ticket_attachment
       (id, ticket_id, filename, mime_type, size_bytes, storage_key, uploaded_by, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );

  const saved = [];
  for (const att of attachments) {
    const { filename, mimeType, sizeBytes, storageKey } = att;

    if (!filename || !filename.trim()) throw new ValidationError('Attachment filename is required');
    if (!storageKey) throw new ValidationError('Attachment storageKey is required');
    if (sizeBytes > MAX_SIZE_BYTES) {
      throw new ValidationError(`Attachment '${filename}' exceeds the 10 MB size limit`);
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new ValidationError(`Attachment type '${mimeType}' is not permitted`);
    }

    const id = randomUUID();
    stmt.run(id, ticketId, filename.trim(), mimeType, sizeBytes ?? 0, storageKey, uploadedBy);
    saved.push({ id, ticketId, filename: filename.trim(), mimeType, sizeBytes: sizeBytes ?? 0, storageKey, uploadedBy });
  }
  return saved;
}

/**
 * Retrieve all attachments for a ticket.
 */
export function getAttachments(db, ticketId) {
  return db.prepare(
    `SELECT id, ticket_id, filename, mime_type, size_bytes, storage_key, uploaded_by, uploaded_at
     FROM ticket_attachment WHERE ticket_id = ? ORDER BY uploaded_at ASC`
  ).all(ticketId);
}
