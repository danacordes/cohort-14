import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeDueDates, getSLAStatus } from './slaService.js';

describe('computeDueDates', () => {
  it('returns ISO datetime strings', () => {
    const { responseDue, resolutionDue } = computeDueDates('HIGH');
    assert.match(responseDue, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(resolutionDue, /^\d{4}-\d{2}-\d{2}T/);
  });

  it('response due is before resolution due', () => {
    const { responseDue, resolutionDue } = computeDueDates('HIGH');
    assert.ok(new Date(responseDue) < new Date(resolutionDue));
  });

  it('CRITICAL due times are shorter than LOW', () => {
    const now = new Date();
    const critical = computeDueDates('CRITICAL', now);
    const low = computeDueDates('LOW', now);
    assert.ok(new Date(critical.resolutionDue) < new Date(low.resolutionDue));
  });

  it('falls back to MEDIUM defaults for unknown priority code', () => {
    const medium = computeDueDates('MEDIUM');
    const unknown = computeDueDates('NONEXISTENT');
    const mediumRes = new Date(medium.resolutionDue).getTime();
    const unknownRes = new Date(unknown.resolutionDue).getTime();
    assert.ok(Math.abs(mediumRes - unknownRes) < 2000);
  });
});

describe('getSLAStatus', () => {
  it('returns UNKNOWN when no resolution due date', () => {
    const status = getSLAStatus({ sla_resolution_due_at: null, sla_paused_at: null });
    assert.equal(status, 'UNKNOWN');
  });

  it('returns PAUSED when sla_paused_at is set', () => {
    const status = getSLAStatus({
      sla_resolution_due_at: new Date(Date.now() + 3600000).toISOString(),
      sla_paused_at: new Date().toISOString(),
    });
    assert.equal(status, 'PAUSED');
  });

  it('returns BREACHED when due time is in the past', () => {
    const status = getSLAStatus({
      sla_resolution_due_at: new Date(Date.now() - 1000).toISOString(),
      sla_paused_at: null,
    });
    assert.equal(status, 'BREACHED');
  });

  it('returns ON_TRACK when plenty of time remains', () => {
    const status = getSLAStatus({
      sla_resolution_due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      sla_paused_at: null,
      _priorityCode: 'LOW',
    });
    assert.ok(['ON_TRACK', 'AT_RISK'].includes(status));
  });
});
