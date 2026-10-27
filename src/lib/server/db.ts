import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const dataDir = resolve(process.env.DATA_DIR || 'data');
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
export const db = new Database(resolve(dataDir, 'hub.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

if ((db.pragma('user_version', { simple: true }) as number) < 1) {
	db.transaction(() => {
		db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        display_name TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE identities (
        user_id TEXT NOT NULL REFERENCES users(id), provider TEXT NOT NULL,
        subject TEXT NOT NULL, password_hash TEXT,
        PRIMARY KEY(provider, subject), UNIQUE(user_id, provider)
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
      );
      CREATE INDEX sessions_user ON sessions(user_id);
      CREATE TABLE rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE skills (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
        name TEXT NOT NULL, description TEXT NOT NULL, categories TEXT NOT NULL,
        tags TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', license TEXT NOT NULL DEFAULT '',
        compatibility TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1,
        downloads INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL, UNIQUE(owner_id, name)
      );
      CREATE INDEX skills_owner ON skills(owner_id);
      CREATE INDEX skills_updated ON skills(updated_at DESC);
      CREATE TABLE revisions (
        id TEXT PRIMARY KEY, skill_id TEXT NOT NULL REFERENCES skills(id), number INTEGER NOT NULL,
        created_at TEXT NOT NULL, checksum TEXT NOT NULL, version TEXT NOT NULL,
        name TEXT NOT NULL, description TEXT NOT NULL, license TEXT NOT NULL,
        compatibility TEXT NOT NULL, files TEXT NOT NULL, UNIQUE(skill_id, number)
      );
      CREATE VIRTUAL TABLE skill_search USING fts5(skill_id UNINDEXED, name, description, tags, content, tokenize='unicode61');
      PRAGMA user_version = 1;
    `);
	})();
}

if ((db.pragma('user_version', { simple: true }) as number) < 2) {
	db.transaction(() => {
		db.exec(`
			ALTER TABLE revisions ADD COLUMN source TEXT;
			ALTER TABLE skills ADD COLUMN example TEXT NOT NULL DEFAULT '';
			PRAGMA user_version = 2;
		`);
	})();
}

if ((db.pragma('user_version', { simple: true }) as number) < 3) {
	db.transaction(() => {
		db.exec(`
			ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;
			ALTER TABLE users ADD COLUMN default_maintainer INTEGER NOT NULL DEFAULT 0;
			CREATE UNIQUE INDEX default_maintainer ON users(default_maintainer) WHERE default_maintainer = 1;
			ALTER TABLE skills ADD COLUMN maintainer_id TEXT REFERENCES users(id);
			ALTER TABLE skills ADD COLUMN details TEXT NOT NULL DEFAULT '{}';
			ALTER TABLE revisions ADD COLUMN details TEXT NOT NULL DEFAULT '{}';
			UPDATE skills SET maintainer_id = owner_id;
			PRAGMA user_version = 3;
		`);
	})();
}
