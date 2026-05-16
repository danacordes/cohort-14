/**
 * Parse audit JSON payloads stored as strings on `AuditEntry`.
 * @param {string | null | undefined} raw
 * @returns {Record<string, unknown>}
 */
export function parseAuditValues(raw) {
  if (raw == null || raw === '') return {};
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === 'object' && !Array.isArray(v)) return /** @type {Record<string, unknown>} */ (v);
    return { value: v };
  } catch {
    return {};
  }
}

export function formatAuditScalar(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Sorted union of keys from both snapshots (excluding internal `_raw`). */
export function auditFieldKeys(previousValues, newValues) {
  const prev = parseAuditValues(previousValues);
  const next = parseAuditValues(newValues);
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  keys.delete('_raw');
  return [...keys].sort((a, b) => a.localeCompare(b));
}

export function humanizeAuditAction(action) {
  if (!action) return '';
  return action
    .split(/_/g)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}
