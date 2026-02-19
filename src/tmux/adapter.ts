/**
 * Abstract interface for tmux operations.
 * Enables testing via mock adapters without real tmux.
 */
export interface TmuxSession {
  readonly name: string
  readonly windows: number
  readonly created: Date
}

export interface TmuxAdapter {
  createSession(name: string, command?: string): Promise<void>
  killSession(name: string): Promise<void>
  hasSession(name: string): Promise<boolean>
  listSessions(): Promise<ReadonlyArray<TmuxSession>>
  sendKeys(session: string, keys: string): Promise<void>
  capturePane(session: string, historyLines?: number): Promise<string>
  runCommand(session: string, command: string): Promise<void>
}
