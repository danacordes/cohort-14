import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { EMBEDDING_MODEL_ID } from '../../constants/bedrockModels.js';
import { runPendingMigrations } from '../../db/migrate-lib.js';
import { LLMClient } from './llmClient.js';
import { storeEmbedding, findSimilar } from './embeddingService.js';

function fixedUnit(dim, axis) {
  const v = new Float32Array(dim);
  v[axis] = 1;
  return v;
}

function mockClientForEmbedAxis(dim, axis) {
  return {
    /**
     * @param {InvokeModelCommand} command
     */
    send(command) {
      const inp = /** @type {any} */ (command).input;
      assert.strictEqual(inp.modelId, EMBEDDING_MODEL_ID);
      const emb = fixedUnit(dim, axis);
      const payload = Uint8Array.from(Buffer.from(JSON.stringify({ embedding: [...emb] }), 'utf8'));
      return Promise.resolve({ body: payload, $metadata: { httpStatusCode: 200 } });
    },
  };
}

describe('EmbeddingService', () => {
  it('UPSERT and cosine ranking', async () => {
    const dim = 16;
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    const llm = new LLMClient({
      client: /** @type {any} */ (mockClientForEmbedAxis(dim, 2)),
      disabled: false,
      region: 'us-east-1',
    });

    const vFar = fixedUnit(dim, 0);
    const vClose = fixedUnit(dim, 2);
    storeEmbedding(db, {
      entityType: 'Ticket',
      entityId: 't-far',
      vector: vFar,
    });
    storeEmbedding(db, {
      entityType: 'Ticket',
      entityId: 't-close',
      vector: vClose,
    });

    const scores = await findSimilar(db, llm, 'needle-like', 'Ticket', 10);
    assert.equal(scores.length, 2);
    const best = scores[0];
    const far = scores.find((s) => s.entityId === 't-far');
    assert.ok(far);
    assert.strictEqual(best.entityId, 't-close');
    assert.ok(far.score < best.score);
    assert.ok(Math.abs(best.score - 1) < 1e-5);
  });

  it('rejects embedding dimension mismatches across rows', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);
    db.prepare(`INSERT INTO embedding_record (entity_type, entity_id, vector_blob, model_id)
               VALUES ('Ticket','bad-one', ?, ?)`).run(
      Buffer.alloc(24),
      EMBEDDING_MODEL_ID,
    ); // wrong length floats

    const llm = new LLMClient({
      client: /** @type {any} */ ({
        async send(command) {
          const emb = new Float32Array(8);
          emb[0] = 1;
          return {
            body: Uint8Array.from(
              Buffer.from(JSON.stringify({ embedding: [...emb] }), 'utf8')
            ),
            $metadata: { httpStatusCode: 200 },
          };
        },
      }),
      disabled: false,
      region: 'us-east-1',
    });

    await assert.rejects(findSimilar(db, llm, 'q', 'Ticket', 10), /dimension mismatch/i);
  });
});
