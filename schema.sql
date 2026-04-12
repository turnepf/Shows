CREATE TABLE IF NOT EXISTS shows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  network TEXT,
  network_url TEXT,
  recommended_by TEXT,
  rating TEXT,
  list TEXT NOT NULL,
  notes TEXT,
  archived INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS actors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER REFERENCES shows(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shows_list ON shows(list);
CREATE INDEX IF NOT EXISTS idx_shows_archived ON shows(archived);
CREATE INDEX IF NOT EXISTS idx_actors_show_id ON actors(show_id);
