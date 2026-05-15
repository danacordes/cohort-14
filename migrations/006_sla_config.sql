-- WO-9: SLA policy configuration and additional breach tracking columns.

CREATE TABLE sla_policy (
  id TEXT PRIMARY KEY,
  priority TEXT NOT NULL CHECK (priority IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  response_time_hours INTEGER NOT NULL CHECK (response_time_hours > 0),
  resolution_time_hours INTEGER NOT NULL CHECK (resolution_time_hours > response_time_hours),
  effective_from TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX ix_sla_policy_priority_effective ON sla_policy (priority, effective_from DESC);

-- Singleton table for global SLA escalation thresholds
CREATE TABLE sla_global_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  escalation_threshold_percent INTEGER NOT NULL DEFAULT 80
    CHECK (escalation_threshold_percent BETWEEN 50 AND 95),
  unassigned_escalation_threshold_hours INTEGER NOT NULL DEFAULT 4
    CHECK (unassigned_escalation_threshold_hours > 0)
);

INSERT INTO sla_global_config (id, escalation_threshold_percent, unassigned_escalation_threshold_hours)
VALUES (1, 80, 4);

-- Seed default SLA policies (created_by = 'system')
INSERT INTO sla_policy (id, priority, response_time_hours, resolution_time_hours, effective_from, created_by)
VALUES
  (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))), 'CRITICAL', 1,  4,  datetime('now'), 'system'),
  (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))), 'HIGH',     4,  8,  datetime('now'), 'system'),
  (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))), 'MEDIUM',   8,  24, datetime('now'), 'system'),
  (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))), 'LOW',      24, 72, datetime('now'), 'system');

-- Additional SLA breach tracking columns on ticket
ALTER TABLE ticket ADD COLUMN sla_responded_at TEXT;
ALTER TABLE ticket ADD COLUMN sla_response_breached_at TEXT;
ALTER TABLE ticket ADD COLUMN sla_resolution_breached_at TEXT;
