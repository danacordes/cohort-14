import { describe, it, expect } from 'vitest';
import { formatDurationMs, buildSlaCaption } from './slaDisplay.js';

describe('slaDisplay', () => {
  it('formats durations', () => {
    expect(formatDurationMs(30 * 60 * 1000)).toBe('30m');
    expect(formatDurationMs(3 * 60 * 60 * 1000)).toBe('3h');
    expect(formatDurationMs(50 * 60 * 60 * 1000)).toBe('2d');
  });

  it('builds response countdown before first response', () => {
    const future = new Date(Date.now() + 7200000).toISOString();
    const caption = buildSlaCaption(
      {
        slaStatus: 'ON_TRACK',
        slaRespondedAt: null,
        slaResponseDueAt: future,
        slaResolutionDueAt: future,
      },
      Date.now()
    );
    expect(caption).toMatch(/until response due/i);
  });

  it('shows paused caption', () => {
    expect(buildSlaCaption({ slaStatus: 'PAUSED' })).toMatch(/paused/i);
  });
});
