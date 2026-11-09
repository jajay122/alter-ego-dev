CREATE TABLE IF NOT EXISTS profiles (
  owner TEXT PRIMARY KEY,
  goal INTEGER CHECK(goal IS NULL OR (goal > 0 AND goal <= 20000))
);
CREATE TABLE IF NOT EXISTS entries (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  date TEXT NOT NULL,
  meal TEXT NOT NULL CHECK(meal IN ('breakfast','lunch','dinner','snack')),
  name TEXT NOT NULL,
  tenths INTEGER NOT NULL CHECK(tenths BETWEEN 0 AND 100000),
  nutrition TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  PRIMARY KEY(owner,id)
);
CREATE INDEX IF NOT EXISTS entries_owner_date ON entries(owner,date,created_at);
CREATE TABLE IF NOT EXISTS favorites (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(owner,id)
);
CREATE TABLE IF NOT EXISTS nutrition_sources (
  owner TEXT NOT NULL,
  provider TEXT NOT NULL,
  code TEXT NOT NULL,
  data TEXT NOT NULL,
  fetched INTEGER NOT NULL,
  PRIMARY KEY(owner,provider,code)
);
CREATE TABLE IF NOT EXISTS request_limits (
  owner TEXT NOT NULL,
  bucket TEXT NOT NULL,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY(owner,bucket)
);
CREATE TRIGGER IF NOT EXISTS entries_insert_conflict BEFORE INSERT ON entries
WHEN EXISTS (
  SELECT 1 FROM entries WHERE owner=NEW.owner AND id=NEW.id
  AND (date<>NEW.date OR meal<>NEW.meal OR name<>NEW.name OR tenths<>NEW.tenths OR nutrition IS NOT NEW.nutrition)
)
BEGIN
  SELECT RAISE(ABORT,'ENTRY_CONTENT_CONFLICT');
END;
CREATE TRIGGER IF NOT EXISTS entries_insert_capacity BEFORE INSERT ON entries
WHEN NOT EXISTS (SELECT 1 FROM entries WHERE owner=NEW.owner AND id=NEW.id)
  AND (SELECT count(*) FROM entries WHERE owner=NEW.owner)>=20000
BEGIN
  SELECT RAISE(ABORT,'JOURNAL_FULL');
END;
CREATE TABLE IF NOT EXISTS atelier_projects (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  data TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner,id)
);
CREATE INDEX IF NOT EXISTS atelier_owner_updated ON atelier_projects(owner,updated_at);
CREATE TRIGGER IF NOT EXISTS atelier_insert_capacity BEFORE INSERT ON atelier_projects
WHEN (SELECT count(*) FROM atelier_projects WHERE owner=NEW.owner)>=50
BEGIN
  SELECT RAISE(ABORT,'PROJECT_LIMIT');
END;
