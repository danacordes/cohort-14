import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cosineSimilarity } from './cosineSimilarity.js';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    assert.ok(Math.abs(cosineSimilarity(a, a) - 1) < 1e-6);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    assert.ok(Math.abs(cosineSimilarity(a, b)) < 1e-6);
  });

  it('throws on dimension mismatch', () => {
    assert.throws(() => cosineSimilarity(new Float32Array([1]), new Float32Array([1, 2])), /mismatch/i);
  });
});
