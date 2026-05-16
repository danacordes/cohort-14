-- WO-13: KB article lifecycle, ticket links, configurable feedback flagging.

CREATE TABLE kb_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  feedback_not_helpful_flag_threshold INTEGER NOT NULL DEFAULT 4
    CHECK (feedback_not_helpful_flag_threshold >= 1 AND feedback_not_helpful_flag_threshold <= 999),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO kb_config (id, feedback_not_helpful_flag_threshold)
VALUES (1, 4);

ALTER TABLE kb_article ADD COLUMN last_review_comment TEXT;

CREATE TABLE ticket_kb_article (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  linked_at TEXT NOT NULL DEFAULT (datetime('now')),
  linked_by_user_id TEXT NOT NULL,
  UNIQUE (ticket_id, article_id),
  FOREIGN KEY (ticket_id) REFERENCES ticket (id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES kb_article (id) ON DELETE CASCADE,
  FOREIGN KEY (linked_by_user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX ix_ticket_kb_ticket ON ticket_kb_article (ticket_id);
CREATE INDEX ix_ticket_kb_article ON ticket_kb_article (article_id);
