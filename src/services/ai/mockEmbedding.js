import { createHash } from 'crypto';

/**
 * Stable L2-normalized mock embedding from text (BEDROCK_DISABLED tests / local dev).
 * @param {string} text
 * @param {number} dimension
 */
export function deterministicMockEmbedding(text, dimension = 1024) {
  const seedBytes = createHash('sha256').update(text || '').digest();
  const out = new Float32Array(dimension);
  for (let i = 0; i < dimension; i++) {
    let q = 0;
    const step = seedBytes[(i % seedBytes.length) + Math.floor(i / dimension) % 3];
    for (let k = 0; k < 4; k++) {
      q += seedBytes[(i + k + step) % seedBytes.length];
    }
    out[i] = (q / (255 * 4)) - 0.5;
  }
  let n = 0;
  for (let i = 0; i < dimension; i++) n += out[i] * out[i];
  n = Math.sqrt(n);
  if (n > 1e-8) {
    for (let i = 0; i < dimension; i++) out[i] /= n;
  }
  return out;
}
