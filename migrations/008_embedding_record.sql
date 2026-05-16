-- WO-36: Embedding storage for semantic similarity (one row per logical entity).

CREATE TABLE embedding_record (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  vector_blob BLOB NOT NULL,
  model_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX ix_embedding_record_entity_type ON embedding_record (entity_type);
