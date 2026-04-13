CREATE TABLE IF NOT EXISTS households (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_slug TEXT REFERENCES households(slug),
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
  archived INTEGER DEFAULT 0,
  household_slug TEXT REFERENCES households(slug),
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
  household_slug TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_shows_list ON shows(list);
CREATE INDEX IF NOT EXISTS idx_shows_archived ON shows(archived);
CREATE INDEX IF NOT EXISTS idx_shows_household ON shows(household_slug);
CREATE INDEX IF NOT EXISTS idx_actors_show_id ON actors(show_id);
CREATE INDEX IF NOT EXISTS idx_household_codes_code ON household_codes(code);
