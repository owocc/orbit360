CREATE TABLE IF NOT EXISTS orbs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  size INTEGER NOT NULL,
  frame_count INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  r2_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orbs_created_at ON orbs (created_at DESC);
