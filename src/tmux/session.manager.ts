import { nanoid } from 'nanoid'
import { env } from '../config/env.ts'
import { TMUX } from '../config/constants.ts'
import { getLogger } from '../utils/logger.ts'
import { sessionRepo } from '../db/repositories/session.repo.ts'
import type { TmuxAdapter } from './adapter.ts'
import type { TmuxSession as DbSession } from '../db/schema.ts'

type SessionType = 'claude' | 'shell' | 'monitor'

export class SessionManager {
  private readonly logger = getLogger()

  constructor(private readonly adapter: TmuxAdapter) {}

  /**
   * Builds a unique tmux session name using the configured prefix.
   */
  buildSessionName(type: SessionType, suffix?: string): string {
    if (type === 'monitor') return `${env.TMUX_PREFIX}-monitor`
    const id = suffix ?? nanoid(6)
    return `${env.TMUX_PREFIX}-${type}-${id}`
  }

  /**
   * Creates a new tmux session and persists it to the database.
   */
  async createSession(
    type: SessionType,
    command?: string,
    metadata?: Record<string, unknown>,
  ): Promise<DbSession> {
    const name = this.buildSessionName(type)
    await this.adapter.createSession(name, command)

    const record = await sessionRepo.create({
      name,
      type,
      createdAt: new Date(),
      lastSeenAt: new Date(),
      isAlive: true,
      metadata: metadata ?? null,
    })

    this.logger.info('Session created', { type, name, id: record.id })
    return record
  }

  /**
   * Kills a tmux session and marks it dead in the database.
   */
  async killSession(sessionId: string): Promise<void> {
    const record = await sessionRepo.findById(sessionId)
    if (record === null) throw new Error(`Session ${sessionId} not found`)

    await this.adapter.killSession(record.name)
    await sessionRepo.markAlive(sessionId, false)
    this.logger.info('Session killed', { id: sessionId, name: record.name })
  }

  /**
   * Reconciles database records against live tmux sessions.
   * Marks dead sessions appropriately after a bot restart.
   */
  async reconcile(): Promise<void> {
    const dbSessions = await sessionRepo.findAlive()
    this.logger.info('Reconciling sessions', { count: dbSessions.length })

    await Promise.all(
      dbSessions.map(async (session) => {
        const alive = await this.adapter.hasSession(session.name)
        if (!alive) {
          await sessionRepo.markAlive(session.id, false)
          this.logger.info('Session marked dead during reconcile', { name: session.name })
        } else {
          await sessionRepo.markAlive(session.id, true)
        }
      }),
    )
  }

  /**
   * Lists all alive sessions from the database, verified against tmux.
   */
  async listAlive(): Promise<ReadonlyArray<DbSession>> {
    return sessionRepo.findAlive()
  }

  /**
   * Sends keys to a session identified by its database ID.
   */
  async sendKeys(sessionId: string, keys: string): Promise<void> {
    const record = await sessionRepo.findById(sessionId)
    if (record === null) throw new Error(`Session ${sessionId} not found`)
    if (!record.isAlive) throw new Error(`Session ${record.name} is not alive`)
    await this.adapter.sendKeys(record.name, keys)
  }

  /**
   * Captures the tmux pane output for a session.
   */
  async capturePane(sessionId: string, historyLines?: number): Promise<string> {
    const record = await sessionRepo.findById(sessionId)
    if (record === null) throw new Error(`Session ${sessionId} not found`)
    return this.adapter.capturePane(record.name, historyLines ?? TMUX.HISTORY_LINES)
  }
}
