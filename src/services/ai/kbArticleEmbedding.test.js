import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { EMBEDDING_MODEL_ID } from '../../constants/bedrockModels.js';
import { EMBEDDING_ENTITY_KB_ARTICLE } from '../../constants/embeddingEntities.js';
import { runPendingMigrations } from '../../db/migrate-lib.js';
import { kbArticleEmbeddingText, persistKbArticleEmbeddingNonFatal } from './kbArticleEmbedding.js';

describe('kbArticleEmbedding helpers', () => {
  it('formats title and body consistently', () => {
    assert.match(kbArticleEmbeddingText(' VPN ', ' Reset '), /Title:[\s\S]*VPN[\s\S]*Body:[\s\S]*Reset/);
  });

  it('persistKbArticleEmbeddingNonFatal skips empty combined text silently', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    /** @type {import('./llmClient.js').LLMClient} */
    const noop = /** @type {any} */ ({
      async embed() {
        throw new Error('must not embed empty');
      },
    });

    await persistKbArticleEmbeddingNonFatal(db, noop, 'a1', '', '');
    const n = db.prepare('SELECT COUNT(*) AS n FROM embedding_record WHERE entity_id = ?').get('a1').n;
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

    await persistKbArticleEmbeddingNonFatal(db, stub, 'kb-1', 'Title', 'Body text');
    const row = db
      .prepare('SELECT entity_type FROM embedding_record WHERE entity_id = ?')
      .get('kb-1');
    assert.strictEqual(row.entity_type, EMBEDDING_ENTITY_KB_ARTICLE);
    const model = db
      .prepare('SELECT model_id FROM embedding_record WHERE entity_id = ?')
      .get('kb-1').model_id;
    assert.strictEqual(model, EMBEDDING_MODEL_ID);
  });
});
