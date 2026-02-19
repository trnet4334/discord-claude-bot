import type { TmuxSession as DbSession } from '../../db/schema.ts'

export type ClaudeSessionStatus = 'starting' | 'ready' | 'busy' | 'dead'

/**
 * In-memory Claude session state, keyed by database session ID.
 * Augments the persisted database record with runtime status.
 */
export interface ClaudeSessionState {
  readonly dbSession: DbSession
  status: ClaudeSessionStatus
  lastActivityAt: Date
  streamId: string | null
}

export class ClaudeSessionStore {
  private readonly sessions = new Map<string, ClaudeSessionState>()

  set(sessionId: string, state: ClaudeSessionState): void {
    this.sessions.set(sessionId, state)
  }

  get(sessionId: string): ClaudeSessionState | undefined {
    return this.sessions.get(sessionId)
  }

  getAll(): ReadonlyArray<ClaudeSessionState> {
    return [...this.sessions.values()]
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  update(sessionId: string, patch: Partial<Omit<ClaudeSessionState, 'dbSession'>>): void {
    const state = this.sessions.get(sessionId)
    if (state === undefined) return
    this.sessions.set(sessionId, { ...state, ...patch })
  }
}
