import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { EMBEDDING_MODEL_ID } from '../../constants/bedrockModels.js';
import { EMBEDDING_ENTITY_TICKET } from '../../constants/embeddingEntities.js';
import { runPendingMigrations } from '../../db/migrate-lib.js';
import { ticketEmbeddingText, persistTicketEmbeddingNonFatal } from './ticketEmbedding.js';

describe('ticketEmbedding helpers', () => {
  it('formats title and description consistently', () => {
    assert.match(ticketEmbeddingText(' Wifi ', ' Drops '), /Title:[\s\S]*Wifi[\s\S]*Description:[\s\S]*Drops/);
  });

  it('persistTicketEmbeddingNonFatal skips empty combined text silently', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    /** @type {import('./llmClient.js').LLMClient} */
    const noop = /** @type {any} */ ({
      async embed() {
        throw new Error('must not embed empty');
      },
    });

    await persistTicketEmbeddingNonFatal(db, noop, 't1', '', '');
    const n = db.prepare('SELECT COUNT(*) AS n FROM embedding_record WHERE entity_id = ?').get('t1').n;
    assert.strictEqual(n, 0);
  });

  it('writes embedding blob on successful embed', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    /** @type {import('./llmClient.js').LLMClient} */
    const stub = /** @type {any} */ ({
      async embed() {
        const v = new Float32Array(8);
        v[3] = 1;
        return v;
      },
    });

    await persistTicketEmbeddingNonFatal(db, stub, 't2', 'Title', '');
    const row = db
      .prepare('SELECT entity_type FROM embedding_record WHERE entity_id = ?')
      .get('t2');
    assert.strictEqual(row.entity_type, EMBEDDING_ENTITY_TICKET);
    const model = db
      .prepare('SELECT model_id FROM embedding_record WHERE entity_id = ?')
      .get('t2').model_id;
    assert.strictEqual(model, EMBEDDING_MODEL_ID);
  });
});
