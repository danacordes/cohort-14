import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runPendingMigrations } from '../../db/migrate-lib.js';
import { suggestTicketCategoryFromText } from './ticketClassificationService.js';

function mockLlm(generateContent) {
  return {
    async embed() {
      return new Float32Array(1024);
    },
    async generate() {
      return {
        content:
          generateContent ?? '{"categoryId":"c-soft","categoryName":"Software","confidence":0.9}',
      };
    },
  };
}

describe('TicketClassificationService', () => {
  it('returns canonical DB category from model JSON suggestion', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    db.prepare(`INSERT INTO ticket_category (id, name, slug) VALUES ('c-hw','Hardware','hw')`).run();
    db.prepare(`INSERT INTO ticket_category (id, name, slug) VALUES ('c-soft','Software','sw')`).run();

    /** @type {import('./llmClient.js').LLMClient} */
    const llm = /** @type {any} */ (mockLlm());

    const r = await suggestTicketCategoryFromText(llm, db, 'Install Outlook', '');
    assert.strictEqual(r.categoryId, 'c-soft');
    assert.strictEqual(r.categoryName, 'Software');
    assert.ok(r.confidence >= 0 && r.confidence <= 1);
  });

  it('rejects suggestions that reference inactive or unknown IDs', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    db.prepare(`INSERT INTO ticket_category (id, name, slug) VALUES ('c-hw','Hardware','hw')`).run();

    const llmBad = mockLlm('{"categoryId":"c-missing","categoryName":"Ghost","confidence":1}');

    await assert.rejects(
      async () =>
        suggestTicketCategoryFromText(/** @type {any} */ (llmBad), db, 'broken keyboard', ''),
      /unknown category/i
    );
  });
});
