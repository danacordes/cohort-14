import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { vectorToBlob, blobToVector } from './vectorBlob.js';

describe('vectorBlob', () => {
  it('round-trips Float32Array', () => {
    const v = new Float32Array([0.25, -1.5, 2]);
    const b = vectorToBlob(v);
    assert.ok(Buffer.isBuffer(b));
    const out = blobToVector(b);
    assert.equal(out.length, 3);
    assert.ok(Math.abs(out[0] - 0.25) < 1e-6);
  });

  it('throws on bad blob alignment', () => {
    assert.throws(() => blobToVector(Buffer.alloc(7)), /aligned/i);
  });
});
