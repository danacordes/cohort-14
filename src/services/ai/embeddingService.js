import { EMBEDDING_MODEL_ID } from '../../constants/bedrockModels.js';
import { ValidationError } from '../../errors/index.js';
import { cosineSimilarity } from './cosineSimilarity.js';
import { blobToVector, vectorToBlob } from './vectorBlob.js';

/**
 * @param {import('./llmClient.js').LLMClient} llmClient
 * @param {string} text
 * @returns {Promise<Float32Array>}
 */
export async function embedWithoutPersist(llmClient, text) {
  const t = (text ?? '').trim();
  if (!t) throw new ValidationError('Embedding text cannot be empty');
  return llmClient.embed(t);
}

/**
 * Persist or overwrite the embedding row for one logical entity.
 *
 * @param {import('node:sqlite').DatabaseSync} db - write DB
 * @param {{ entityType: string; entityId: string; vector: Float32Array; modelId?: string }} row
 */
export function storeEmbedding(db, { entityType, entityId, vector, modelId = EMBEDDING_MODEL_ID }) {
  const et = entityType?.trim();
  const eid = entityId?.trim();
  if (!et || !eid) throw new ValidationError('entityType and entityId are required');

  db.prepare(
    `INSERT INTO embedding_record (entity_type, entity_id, vector_blob, model_id, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(entity_type, entity_id) DO UPDATE SET
       vector_blob = excluded.vector_blob,
       model_id = excluded.model_id,
       created_at = datetime('now')`
  ).run(et, eid, vectorToBlob(vector), modelId);
}

/**
 * @typedef {{ entityId: string; score: number; modelId: string }} SimilarityHit
 */

/**
 * Cosine top-N retrieval for one `entityType` slice.
 *
 * @param {import('node:sqlite').DatabaseSync} db - read DB
 * @param {import('./llmClient.js').LLMClient} llmClient
 * @param {string} queryText
 * @param {string} entityType
 * @param {number} [topN]
 * @returns {Promise<SimilarityHit[]>}
 */
export async function findSimilar(db, llmClient, queryText, entityType, topN = 10) {
  const t = (queryText ?? '').trim();
  const et = entityType?.trim();
  if (!t) throw new ValidationError('queryText cannot be empty');
  if (!et) throw new ValidationError('entityType cannot be empty');

  const n = Math.min(Math.max(topN | 0, 1), 500);
  const queryVec = await llmClient.embed(t);

  const rows = db
    .prepare(
      `SELECT entity_id, vector_blob, model_id FROM embedding_record WHERE entity_type = ?`
    )
    .all(et);

  /** @type {SimilarityHit[]} */
  const scored = [];

  for (const row of rows) {
    const v = blobToVector(row.vector_blob);
    if (v.length !== queryVec.length) {
      throw new ValidationError(
        `embedding dimension mismatch for ${row.entity_id}: stored=${v.length} query=${queryVec.length}`
      );
    }
    const score = cosineSimilarity(queryVec, v);
    scored.push({ entityId: row.entity_id, score, modelId: row.model_id });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n);
}
