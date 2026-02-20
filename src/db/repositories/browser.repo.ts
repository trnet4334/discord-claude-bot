import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { browserSessions, type BrowserSession, type NewBrowserSession } from '../schema.ts'
import { getDb } from '../client.ts'

export const browserRepo = {
  create(data: Omit<NewBrowserSession, 'id' | 'createdAt'>): BrowserSession {
    const db = getDb()
    const record: NewBrowserSession = {
      id: nanoid(8),
      createdAt: new Date(),
      ...data,
    }
    db.insert(browserSessions).values(record).run()
    return record as BrowserSession
  },

  findById(id: string): BrowserSession | undefined {
    const db = getDb()
    return db.select().from(browserSessions).where(eq(browserSessions.id, id)).get()
  },

  findActive(): ReadonlyArray<BrowserSession> {
    const db = getDb()
    return db.select().from(browserSessions).where(eq(browserSessions.status, 'active')).all()
  },

  markClosed(id: string): void {
    const db = getDb()
    db.update(browserSessions)
      .set({ status: 'closed', lastActiveAt: new Date() })
      .where(eq(browserSessions.id, id))
      .run()
  },

  updateUrl(id: string, url: string): void {
    const db = getDb()
    db.update(browserSessions)
      .set({ url, lastActiveAt: new Date() })
      .where(eq(browserSessions.id, id))
      .run()
  },
} as const
