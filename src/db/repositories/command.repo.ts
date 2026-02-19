import { desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getDb } from '../client.ts'
import { commandHistory, type CommandHistory, type NewCommandHistory } from '../schema.ts'

export const commandRepo = {
  async create(data: Omit<NewCommandHistory, 'id'>): Promise<CommandHistory> {
    const db = getDb()
    const id = nanoid(8)
    const record: NewCommandHistory = { ...data, id }
    await db.insert(commandHistory).values(record)
    const created = await this.findById(id)
    if (created === null) throw new Error(`Failed to create command history with id ${id}`)
    return created
  },

  async findById(id: string): Promise<CommandHistory | null> {
    const db = getDb()
    const rows = await db
      .select()
      .from(commandHistory)
      .where(eq(commandHistory.id, id))
      .limit(1)
    return rows[0] ?? null
  },

  async findRecent(limit = 20): Promise<ReadonlyArray<CommandHistory>> {
    const db = getDb()
    return db
      .select()
      .from(commandHistory)
      .orderBy(desc(commandHistory.executedAt))
      .limit(limit)
  },

  async findBySessionId(sessionId: string): Promise<ReadonlyArray<CommandHistory>> {
    const db = getDb()
    return db
      .select()
      .from(commandHistory)
      .where(eq(commandHistory.sessionId, sessionId))
      .orderBy(desc(commandHistory.executedAt))
  },
} as const
