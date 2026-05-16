import { describe, it, expect } from 'vitest';
import {
  parseAuditValues,
  formatAuditScalar,
  auditFieldKeys,
  humanizeAuditAction,
} from './auditDisplay.js';

describe('auditDisplay', () => {
  it('parses JSON strings to objects', () => {
    expect(parseAuditValues('{"a":1}')).toEqual({ a: 1 });
    expect(parseAuditValues('')).toEqual({});
  });

  it('formats scalars', () => {
    expect(formatAuditScalar(null)).toBe('—');
    expect(formatAuditScalar({ x: 1 })).toBe('{"x":1}');
  });

  it('collects sorted field keys', () => {
    expect(auditFieldKeys('{"b":2}', '{"a":1}')).toEqual(['a', 'b']);
  });

  it('humanizes action slugs', () => {
    expect(humanizeAuditAction('resolution_confirmed')).toBe('Resolution Confirmed');
  });
});
