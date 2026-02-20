import { Database } from 'bun:sqlite'
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema.ts'
import { getLogger } from '../utils/logger.ts'

export type AppDb = BunSQLiteDatabase<typeof schema>

let _db: AppDb | null = null

export function getDb(): AppDb {
  if (_db !== null) return _db
  throw new Error('Database not initialized. Call initDb() first.')
}

export function initDb(dbPath: string): AppDb {
  const logger = getLogger()

  try {
    const sqlite = new Database(dbPath, { create: true })
    sqlite.exec('PRAGMA journal_mode=WAL;')
    sqlite.exec('PRAGMA foreign_keys=ON;')

    _db = drizzle(sqlite, { schema })
    logger.info('Database initialized', { path: dbPath })
    return _db
  } catch (error) {
    throw new Error(
      `Failed to initialize database at ${dbPath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export function runMigrations(db: AppDb): void {
  const logger = getLogger()
  // Access the underlying sqlite instance via the internal session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sqlite: Database = (db as any).session.client

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tmux_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('claude', 'shell', 'monitor')),
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      is_alive INTEGER NOT NULL DEFAULT 1,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS command_history (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES tmux_sessions(id),
      command TEXT NOT NULL,
      output TEXT,
      exit_code INTEGER,
      executed_at INTEGER NOT NULL,
      duration_ms INTEGER,
      discord_user_id TEXT NOT NULL,
      discord_channel_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS active_streams (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES tmux_sessions(id),
      discord_message_id TEXT NOT NULL,
      discord_channel_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      last_edited_at INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS browser_sessions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'closed')),
      url TEXT,
      created_at INTEGER NOT NULL,
      last_active_at INTEGER
    );
  `)

  logger.info('Database migrations applied')
}
