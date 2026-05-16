import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'crypto';
import { EMBEDDING_ENTITY_KB_ARTICLE } from '../../constants/embeddingEntities.js';
import { runPendingMigrations } from '../../db/migrate-lib.js';
import { storeEmbedding } from './embeddingService.js';
import {
  answerVirtualAgentQuery,
  VIRTUAL_AGENT_FALLBACK_ANSWER,
  virtualAgentFallbackResponse,
} from './virtualAgentService.js';

function unitVector(dim, axis) {
  const v = new Float32Array(dim);
  v[axis] = 1;
  return v;
}

function seedKbArticles(db) {
  const authorId = randomUUID();
  const catId = randomUUID();
  const publishedId = randomUUID();
  const draftId = randomUUID();

  db.prepare(`INSERT INTO users (id, email, role, password_hash) VALUES (?, 'agent@', 'agent', NULL)`).run(
    authorId,
  );
  db.prepare(`INSERT INTO kb_category (id, name, slug) VALUES (?, 'Net', 'net')`).run(catId);
  db.prepare(
    `INSERT INTO kb_article (id, number, title, body, article_type, category_id, tags_json, status, author_id)
     VALUES (?, 'KB-0001', 'Reset VPN', 'Steps to reset corporate VPN client.', 'FAQ', ?, '[]', 'Published', ?)`,
  ).run(publishedId, catId, authorId);
  db.prepare(
    `INSERT INTO kb_article (id, number, title, body, article_type, category_id, tags_json, status, author_id)
     VALUES (?, 'KB-0002', 'Draft VPN', 'Should not surface.', 'FAQ', ?, '[]', 'Draft', ?)`,
  ).run(draftId, catId, authorId);

  return { publishedId, draftId };
}

describe('virtualAgentService', () => {
  it('virtualAgentFallbackResponse returns static answer and no sources', () => {
    const r = virtualAgentFallbackResponse();
    assert.strictEqual(r.answer, VIRTUAL_AGENT_FALLBACK_ANSWER);
    assert.deepEqual(r.sourceArticles, []);
  });

  it('returns RAG answer with published sources only', async () => {
    const dim = 16;
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    const { publishedId, draftId } = seedKbArticles(db);
    storeEmbedding(db, {
      entityType: EMBEDDING_ENTITY_KB_ARTICLE,
      entityId: publishedId,
      vector: unitVector(dim, 2),
    });
    storeEmbedding(db, {
      entityType: EMBEDDING_ENTITY_KB_ARTICLE,
      entityId: draftId,
      vector: unitVector(dim, 2),
    });

    /** @type {import('./llmClient.js').LLMClient} */
    const llm = /** @type {any} */ ({
      async embed() {
        return unitVector(dim, 2);
      },
      async generate() {
        return { content: 'Reset the VPN from Settings.', inputTokens: 1, outputTokens: 5 };
      },
    });

    const result = await answerVirtualAgentQuery(llm, db, 'how do I reset VPN?');
    assert.match(result.answer, /Reset the VPN/);
    assert.strictEqual(result.sourceArticles.length, 1);
    assert.strictEqual(result.sourceArticles[0].id, publishedId);
    assert.strictEqual(result.sourceArticles[0].status, 'Published');
  });

  it('returns fallback when no published article meets similarity threshold', async () => {
    const dim = 8;
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    const { publishedId } = seedKbArticles(db);
    storeEmbedding(db, {
      entityType: EMBEDDING_ENTITY_KB_ARTICLE,
      entityId: publishedId,
      vector: unitVector(dim, 0),
    });

    /** @type {import('./llmClient.js').LLMClient} */
    const llm = /** @type {any} */ ({
      async embed() {
        return unitVector(dim, 1);
      },
      async generate() {
        throw new Error('should not generate');
      },
    });

    const result = await answerVirtualAgentQuery(llm, db, 'unrelated payroll question');
    assert.strictEqual(result.answer, VIRTUAL_AGENT_FALLBACK_ANSWER);
    assert.strictEqual(result.sourceArticles.length, 0);
  });
});
