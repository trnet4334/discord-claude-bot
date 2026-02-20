import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const tmuxSessions = sqliteTable('tmux_sessions', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  type: text('type', { enum: ['claude', 'shell', 'monitor'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  isAlive: integer('is_alive', { mode: 'boolean' }).notNull().default(true),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
})

export const commandHistory = sqliteTable('command_history', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => tmuxSessions.id),
  command: text('command').notNull(),
  output: text('output'),
  exitCode: integer('exit_code'),
  executedAt: integer('executed_at', { mode: 'timestamp' }).notNull(),
  durationMs: integer('duration_ms'),
  discordUserId: text('discord_user_id').notNull(),
  discordChannelId: text('discord_channel_id').notNull(),
})

export const activeStreams = sqliteTable('active_streams', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => tmuxSessions.id),
  discordMessageId: text('discord_message_id').notNull(),
  discordChannelId: text('discord_channel_id').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  lastEditedAt: integer('last_edited_at', { mode: 'timestamp' }),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
})

export const browserSessions = sqliteTable('browser_sessions', {
  id: text('id').primaryKey(),
  status: text('status', { enum: ['active', 'closed'] }).notNull().default('active'),
  url: text('url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  lastActiveAt: integer('last_active_at', { mode: 'timestamp' }),
})

export type TmuxSession = typeof tmuxSessions.$inferSelect
export type NewTmuxSession = typeof tmuxSessions.$inferInsert
export type CommandHistory = typeof commandHistory.$inferSelect
export type NewCommandHistory = typeof commandHistory.$inferInsert
export type ActiveStream = typeof activeStreams.$inferSelect
export type NewActiveStream = typeof activeStreams.$inferInsert
export type BrowserSession = typeof browserSessions.$inferSelect
export type NewBrowserSession = typeof browserSessions.$inferInsert
