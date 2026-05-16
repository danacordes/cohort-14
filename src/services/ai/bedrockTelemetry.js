/**
 * CloudWatch/agent-friendly NDJSON-ish log line — never includes prompt bodies.
 *
 * Fields are chosen for WO-36 observability (model id, timings, coarse token usage).
 *
 * @param {Record<string, unknown>} patch
 */
export function logAiInvocation(patch) {
  const line = {
    cohort14_ai_invoke: true,
    ts: new Date().toISOString(),
    ...patch,
  };
  console.info(JSON.stringify(line));
}
