import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getDb } from '../client.ts'
import { activeStreams, type ActiveStream, type NewActiveStream } from '../schema.ts'

export const streamRepo = {
  async create(data: Omit<NewActiveStream, 'id'>): Promise<ActiveStream> {
    const db = getDb()
    const id = nanoid(8)
    const record: NewActiveStream = { ...data, id }
    await db.insert(activeStreams).values(record)
    const created = await this.findById(id)
    if (created === null) throw new Error(`Failed to create stream with id ${id}`)
    return created
  },

  async findById(id: string): Promise<ActiveStream | null> {
    const db = getDb()
    const rows = await db.select().from(activeStreams).where(eq(activeStreams.id, id)).limit(1)
    return rows[0] ?? null
  },

  async findActive(): Promise<ReadonlyArray<ActiveStream>> {
    const db = getDb()
    return db.select().from(activeStreams).where(eq(activeStreams.isActive, true))
  },

  async markInactive(id: string): Promise<void> {
    const db = getDb()
    await db
      .update(activeStreams)
      .set({ isActive: false, lastEditedAt: new Date() })
      .where(eq(activeStreams.id, id))
  },

  async updateLastEdited(id: string): Promise<void> {
    const db = getDb()
    await db
      .update(activeStreams)
      .set({ lastEditedAt: new Date() })
      .where(eq(activeStreams.id, id))
  },
} as const
