-- WO-11: AI governance — audit actor kind / confidence / feature + platform AI principal user.

INSERT OR IGNORE INTO users (id, email, password_hash, role, sso_subject)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'ai-system@platform.internal',
  NULL,
  'user',
  NULL
);

ALTER TABLE audit_entries ADD COLUMN actor_kind TEXT NOT NULL DEFAULT 'human'
  CHECK (actor_kind IN ('human', 'ai_system'));

ALTER TABLE audit_entries ADD COLUMN ai_confidence REAL;

ALTER TABLE audit_entries ADD COLUMN ai_feature TEXT;
