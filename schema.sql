CREATE TABLE IF NOT EXISTS members (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS member_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_slug TEXT REFERENCES members(slug),
  code TEXT NOT NULL,
  editor_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  network TEXT,
  network_url TEXT,
  recommended_by TEXT,
  rating TEXT,
  list TEXT NOT NULL,
  notes TEXT,
  movie INTEGER DEFAULT 0,
  full_series INTEGER DEFAULT 0,
  watching_with TEXT,
  next_season_date TEXT,
  season_end_date TEXT,
  archived INTEGER DEFAULT 0,
  member_slug TEXT REFERENCES members(slug),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS actors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER REFERENCES shows(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  member_slug TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_shows_list ON shows(list);
CREATE INDEX IF NOT EXISTS idx_shows_archived ON shows(archived);
CREATE INDEX IF NOT EXISTS idx_shows_member ON shows(member_slug);
CREATE INDEX IF NOT EXISTS idx_actors_show_id ON actors(show_id);
CREATE INDEX IF NOT EXISTS idx_member_codes_code ON member_codes(code);
