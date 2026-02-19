import { describe, it, expect } from 'bun:test'
import type { TmuxAdapter, TmuxSession } from '../../../src/tmux/adapter.ts'

// Create a mock adapter for testing
function createMockAdapter(sessions: TmuxSession[] = []): TmuxAdapter {
  const sessionMap = new Map(sessions.map((s) => [s.name, s]))

  return {
    async createSession(name: string, _command?: string): Promise<void> {
      sessionMap.set(name, { name, windows: 1, created: new Date() })
    },
    async killSession(name: string): Promise<void> {
      sessionMap.delete(name)
    },
    async hasSession(name: string): Promise<boolean> {
      return sessionMap.has(name)
    },
    async listSessions(): Promise<ReadonlyArray<TmuxSession>> {
      return [...sessionMap.values()]
    },
    async sendKeys(_session: string, _keys: string): Promise<void> {
      // no-op in tests
    },
    async capturePane(_session: string, _historyLines?: number): Promise<string> {
      return 'mock pane output'
    },
    async runCommand(session: string, command: string): Promise<void> {
      await this.sendKeys(session, command)
    },
  }
}

describe('TmuxAdapter interface contract', () => {
  it('createSession adds the session', async () => {
    const adapter = createMockAdapter()
    await adapter.createSession('test-session')
    expect(await adapter.hasSession('test-session')).toBe(true)
  })

  it('killSession removes the session', async () => {
    const adapter = createMockAdapter([{ name: 'existing', windows: 1, created: new Date() }])
    await adapter.killSession('existing')
    expect(await adapter.hasSession('existing')).toBe(false)
  })

  it('listSessions returns all sessions', async () => {
    const adapter = createMockAdapter([
      { name: 'sess-1', windows: 1, created: new Date() },
      { name: 'sess-2', windows: 2, created: new Date() },
    ])
    const list = await adapter.listSessions()
    expect(list.length).toBe(2)
    expect(list.map((s: TmuxSession) => s.name)).toContain('sess-1')
  })

  it('capturePane returns a string', async () => {
    const adapter = createMockAdapter([{ name: 'active', windows: 1, created: new Date() }])
    const output = await adapter.capturePane('active')
    expect(typeof output).toBe('string')
  })
})
