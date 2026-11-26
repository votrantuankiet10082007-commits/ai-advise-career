const { mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { databaseDir } = require('./config');

process.umask(0o077);
mkdirSync(databaseDir, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(join(databaseDir, 'accounts.sqlite'));
db.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    password TEXT NOT NULL, premium INTEGER NOT NULL DEFAULT 0,
    university TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '',
    targetSpecialty TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    expires INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);
  CREATE TABLE IF NOT EXISTS payments (
    code TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL, bank_name TEXT NOT NULL, bank_account TEXT NOT NULL,
    bank_holder TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL, confirmed_at TEXT, bank_reference TEXT UNIQUE
  );
  CREATE TABLE IF NOT EXISTS cvs (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS one_pending_payment ON payments(user_id) WHERE status = 'pending';
`);
const transaction = require('./transaction');
const { randomInt } = require('node:crypto');

function nextPublicId() {
  const exists = db.prepare('SELECT 1 FROM users WHERE publicId = ?');
  let id;
  do {
    id = String(randomInt(100000000, 1000000000));
  } while (exists.get(id));
  return id;
}

transaction(db, () => {
  const profileColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map(column => column.name));
  for (const column of ['facebook', 'linkedin', 'github', 'projectUrl']) {
    if (!profileColumns.has(column)) db.exec(`ALTER TABLE users ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
  }
  if (!profileColumns.has('publicId')) db.exec('ALTER TABLE users ADD COLUMN publicId TEXT');
  if (!profileColumns.has('avatar')) db.exec("ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT 'initials'");
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_public_id ON users(publicId)');
  const assign = db.prepare('UPDATE users SET publicId = ? WHERE id = ?');
  for (const user of db.prepare('SELECT id FROM users WHERE publicId IS NULL').all()) {
    assign.run(nextPublicId(), user.id);
  }
  if (!profileColumns.has('premiumTier')) {
    db.exec(`ALTER TABLE users ADD COLUMN premiumTier INTEGER NOT NULL DEFAULT 0 CHECK (premiumTier BETWEEN 0 AND 3);
      UPDATE users SET premiumTier = 1 WHERE premium = 1;`);
  }
  if (!db.prepare('PRAGMA table_info(payments)').all().some(column => column.name === 'tier')) {
    db.exec('ALTER TABLE payments ADD COLUMN tier INTEGER NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 3)');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS premium_profiles (
      userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      student TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS premium_unlocks (
      userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      rankings TEXT NOT NULL, student TEXT NOT NULL, createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS premium_progress (
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      roleId TEXT NOT NULL, lessonId TEXT NOT NULL,
      completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
      PRIMARY KEY (userId, roleId, lessonId)
    );
    CREATE TABLE IF NOT EXISTS premium_ai_usage (
      userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0)
    );
  `);
});
db.nextPublicId = nextPublicId;
module.exports = db;
