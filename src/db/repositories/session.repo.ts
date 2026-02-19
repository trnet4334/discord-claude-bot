import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getDb } from '../client.ts'
import { tmuxSessions, type NewTmuxSession, type TmuxSession } from '../schema.ts'

export const sessionRepo = {
  async create(data: Omit<NewTmuxSession, 'id'>): Promise<TmuxSession> {
    const db = getDb()
    const id = nanoid(8)
    const record: NewTmuxSession = { ...data, id }
    await db.insert(tmuxSessions).values(record)
    const created = await this.findById(id)
    if (created === null) throw new Error(`Failed to create session with id ${id}`)
    return created
  },

  async findById(id: string): Promise<TmuxSession | null> {
    const db = getDb()
    const rows = await db.select().from(tmuxSessions).where(eq(tmuxSessions.id, id)).limit(1)
    return rows[0] ?? null
  },

  async findByName(name: string): Promise<TmuxSession | null> {
    const db = getDb()
    const rows = await db.select().from(tmuxSessions).where(eq(tmuxSessions.name, name)).limit(1)
    return rows[0] ?? null
  },

  async findAll(): Promise<ReadonlyArray<TmuxSession>> {
    const db = getDb()
    return db.select().from(tmuxSessions)
  },

  async findAlive(): Promise<ReadonlyArray<TmuxSession>> {
    const db = getDb()
    return db.select().from(tmuxSessions).where(eq(tmuxSessions.isAlive, true))
  },

  async markAlive(id: string, alive: boolean): Promise<void> {
    const db = getDb()
    await db
      .update(tmuxSessions)
      .set({ isAlive: alive, lastSeenAt: new Date() })
      .where(eq(tmuxSessions.id, id))
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.delete(tmuxSessions).where(eq(tmuxSessions.id, id))
  },
} as const
