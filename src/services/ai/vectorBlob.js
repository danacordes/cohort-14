/**
 * Serialize embeddings for SQLite BLOB columns (IEEE-754 floats, LE).
 * @param {Float32Array} vector
 * @returns {Buffer}
 */
export function vectorToBlob(vector) {
  if (!(vector instanceof Float32Array)) {
    throw new TypeError('vector must be Float32Array');
  }
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

/**
 * @param {Buffer | Uint8Array} blob
 * @returns {Float32Array}
 */
export function blobToVector(blob) {
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength);
  if (buf.byteLength % 4 !== 0) {
    throw new Error('embedding BLOB length is not aligned to Float32 elements');
  }
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}
