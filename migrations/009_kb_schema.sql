-- WO-12: Knowledge base data model, FTS index, versioning, attachments, analytics.

CREATE TABLE kb_category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX ix_kb_category_active ON kb_category (is_active, sort_order ASC, name ASC);

CREATE TABLE kb_article_number_seq (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_seq INTEGER NOT NULL DEFAULT 0
);

INSERT INTO kb_article_number_seq (id, next_seq) VALUES (1, 0);

CREATE TABLE kb_article (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  article_type TEXT NOT NULL CHECK (article_type IN ('Solution','How-To Guide','Known Error','FAQ')),
  category_id TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json)),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (
    status IN ('Draft','PendingReview','Published','Retired','Archived','Expired')
  ),
  author_id TEXT NOT NULL,
  reviewer_id TEXT,
  review_due_at TEXT,
  expires_at TEXT,
  current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version >= 1),
  flagged_for_review INTEGER NOT NULL DEFAULT 0 CHECK (flagged_for_review IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES kb_category (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX ix_kb_article_status ON kb_article (status);
CREATE INDEX ix_kb_article_updated ON kb_article (updated_at DESC);
CREATE INDEX ix_kb_article_cat ON kb_article (category_id);
CREATE INDEX ix_kb_article_author ON kb_article (author_id);

CREATE TABLE kb_version (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json)),
  editor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (article_id, version_number),
  FOREIGN KEY (article_id) REFERENCES kb_article (id) ON DELETE CASCADE,
  FOREIGN KEY (editor_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX ix_kb_version_article ON kb_version (article_id, version_number DESC);

CREATE TRIGGER kb_version_no_update BEFORE UPDATE ON kb_version
BEGIN
  SELECT RAISE(ABORT, 'kb_version rows are immutable');
END;

CREATE TRIGGER kb_version_no_delete BEFORE DELETE ON kb_version
BEGIN
  SELECT RAISE(ABORT, 'kb_version rows are append-only');
END;

CREATE TABLE kb_article_attachment (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL DEFAULT '',
  extracted_text TEXT,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES kb_article (id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX ix_kb_attachment_article ON kb_article_attachment (article_id);

CREATE TABLE kb_article_view (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES kb_article (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX ix_kb_view_article_time ON kb_article_view (article_id, viewed_at DESC);
CREATE INDEX ix_kb_view_time ON kb_article_view (viewed_at DESC);

CREATE TABLE kb_article_feedback (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('helpful', 'not_helpful')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES kb_article (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE (article_id, user_id)
);

CREATE INDEX ix_kb_feedback_article ON kb_article_feedback (article_id, created_at DESC);

CREATE VIRTUAL TABLE kb_article_fts USING fts5 (
  article_id UNINDEXED,
  title,
  doc,
  tokenize = 'unicode61 remove_diacritics 1'
);
