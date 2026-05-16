/**
 * Human-readable duration for SLA captions (positive ms).
 * @param {number} ms
 */
export function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}

/**
 * Build secondary SLA caption for ticket rows/detail (approximates WO wording).
 * Uses wall-clock comparison at call time — refreshed via Apollo polling on parents.
 *
 * @param {object} t GraphQL Ticket subset
 * @param {number} [nowMs]
 * @returns {string}
 */
export function buildSlaCaption(t, nowMs = Date.now()) {
  if (!t || t.slaStatus === 'UNKNOWN') return '';
  if (t.slaStatus === 'PAUSED') return 'Clock paused';

  const responded = Boolean(t.slaRespondedAt);
  const respDue = t.slaResponseDueAt ? Date.parse(t.slaResponseDueAt) : NaN;
  const resDue = t.slaResolutionDueAt ? Date.parse(t.slaResolutionDueAt) : NaN;

  if (!responded && Number.isFinite(respDue)) {
    const delta = respDue - nowMs;
    if (delta < 0) return `${formatDurationMs(-delta)} overdue (response)`;
    return `${formatDurationMs(delta)} until response due`;
  }

  if (Number.isFinite(resDue)) {
    const delta = resDue - nowMs;
    if (t.slaStatus === 'BREACHED') {
      const breachIso = t.slaResolutionBreachedAt ?? t.slaResponseBreachedAt;
      const breachAt = breachIso ? Date.parse(breachIso) : resDue;
      if (Number.isFinite(breachAt)) {
        return `${formatDurationMs(nowMs - breachAt)} overdue (resolution)`;
      }
      return `${formatDurationMs(-delta)} overdue (resolution)`;
    }
    if (delta >= 0) return `${formatDurationMs(delta)} until resolution due`;
  }

  return '';
}
