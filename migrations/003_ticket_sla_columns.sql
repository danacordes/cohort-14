-- WO-2: Add SLA tracking columns and assignment to ticket table.
ALTER TABLE ticket ADD COLUMN assigned_to TEXT;
ALTER TABLE ticket ADD COLUMN resolution_summary TEXT;
ALTER TABLE ticket ADD COLUMN sla_response_due_at TEXT;
ALTER TABLE ticket ADD COLUMN sla_resolution_due_at TEXT;
ALTER TABLE ticket ADD COLUMN sla_paused_at TEXT;
ALTER TABLE ticket ADD COLUMN resolved_at TEXT;
ALTER TABLE ticket ADD COLUMN auto_close_at TEXT;
ALTER TABLE ticket ADD COLUMN closed_at TEXT;
