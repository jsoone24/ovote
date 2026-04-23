import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type DB = Database.Database;

export function openDatabase(path: string): DB {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS voters (
      id           TEXT PRIMARY KEY,
      email        TEXT NOT NULL UNIQUE,
      role         TEXT NOT NULL DEFAULT 'voter',
      created_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otps (
      email        TEXT PRIMARY KEY,
      code_hash    TEXT NOT NULL,
      expires_at   TEXT NOT NULL,
      attempts     INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash   TEXT PRIMARY KEY,
      voter_id     TEXT NOT NULL REFERENCES voters(id),
      expires_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS eligibility (
      voter_id     TEXT NOT NULL REFERENCES voters(id),
      agenda_id    TEXT NOT NULL,
      PRIMARY KEY (voter_id, agenda_id)
    );

    CREATE TABLE IF NOT EXISTS credentials_issued (
      voter_id     TEXT NOT NULL REFERENCES voters(id),
      agenda_id    TEXT NOT NULL,
      issued_at    TEXT NOT NULL,
      PRIMARY KEY (voter_id, agenda_id)
    );

    CREATE TABLE IF NOT EXISTS blind_signer_keys (
      agenda_id    TEXT PRIMARY KEY,
      public_spki  TEXT NOT NULL,
      private_pkcs8 TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );
  `);
}
