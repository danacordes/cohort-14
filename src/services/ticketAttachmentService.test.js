import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { saveAttachments, getAttachments } from './ticketAttachmentService.js';

function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE ticket_attachment (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      storage_key TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

describe('saveAttachments', () => {
  let db;

  before(() => { db = createTestDb(); });
  after(() => { db.close(); });

  it('returns empty array when no attachments provided', () => {
    const result = saveAttachments(db, 'ticket-1', 'user-1', []);
    assert.deepEqual(result, []);
  });

  it('inserts attachment rows and returns them', () => {
    const attachments = [
      { filename: 'report.pdf', mimeType: 'application/pdf', sizeBytes: 1024, storageKey: 'key/report.pdf' },
      { filename: 'screenshot.png', mimeType: 'image/png', sizeBytes: 2048, storageKey: 'key/screenshot.png' },
    ];
    const saved = saveAttachments(db, 'ticket-2', 'user-1', attachments);
    assert.equal(saved.length, 2);
    assert.equal(saved[0].filename, 'report.pdf');
    assert.equal(saved[1].filename, 'screenshot.png');
    assert.match(saved[0].id, /^[0-9a-f-]{36}$/);
  });

  it('throws ValidationError for disallowed mime type', () => {
    assert.throws(
      () => saveAttachments(db, 'ticket-3', 'user-1', [
        { filename: 'virus.exe', mimeType: 'application/x-msdownload', sizeBytes: 100, storageKey: 'key/virus.exe' },
      ]),
      { name: 'ValidationError' }
    );
  });

  it('throws ValidationError when file exceeds 10 MB', () => {
    assert.throws(
      () => saveAttachments(db, 'ticket-3', 'user-1', [
        { filename: 'huge.pdf', mimeType: 'application/pdf', sizeBytes: 11 * 1024 * 1024, storageKey: 'key/huge.pdf' },
      ]),
      { name: 'ValidationError' }
    );
  });
});

describe('getAttachments', () => {
  let db;

  before(() => {
    db = createTestDb();
    saveAttachments(db, 'ticket-10', 'user-1', [
      { filename: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 500, storageKey: 'k/a.pdf' },
      { filename: 'b.png', mimeType: 'image/png', sizeBytes: 300, storageKey: 'k/b.png' },
    ]);
  });
  after(() => { db.close(); });

  it('returns all attachments for a ticket', () => {
    const rows = getAttachments(db, 'ticket-10');
    assert.equal(rows.length, 2);
  });

  it('returns empty array for ticket with no attachments', () => {
    const rows = getAttachments(db, 'ticket-99');
    assert.deepEqual(rows, []);
  });
});
