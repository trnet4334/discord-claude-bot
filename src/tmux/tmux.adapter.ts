import { safeExec, exec } from '../utils/process.ts'
import { getLogger } from '../utils/logger.ts'
import type { TmuxAdapter, TmuxSession } from './adapter.ts'

const SEP = '\x1f' // Unit separator — safe delimiter for tmux format strings

export class TmuxAdapterImpl implements TmuxAdapter {
  private readonly logger = getLogger()

  async createSession(name: string, command?: string): Promise<void> {
    const cmdPart = command !== undefined ? ` "${command}"` : ''
    const result = await safeExec(`tmux new-session -d -s "${name}"${cmdPart}`)
    if (result.exitCode !== 0 && !result.stderr.includes('duplicate session')) {
      throw new Error(`Failed to create tmux session "${name}": ${result.stderr}`)
    }
    this.logger.debug('Created tmux session', { name, command })
  }

  async killSession(name: string): Promise<void> {
    await safeExec(`tmux kill-session -t "${name}"`)
    this.logger.debug('Killed tmux session', { name })
  }

  async hasSession(name: string): Promise<boolean> {
    const result = await safeExec(`tmux has-session -t "${name}"`)
    return result.exitCode === 0
  }

  async listSessions(): Promise<ReadonlyArray<TmuxSession>> {
    const fmt = `#{session_name}${SEP}#{session_windows}${SEP}#{session_created}`
    const result = await safeExec(`tmux list-sessions -F "${fmt}"`)

    if (result.exitCode !== 0) return []

    return result.stdout
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line): TmuxSession => {
        const parts = line.split(SEP)
        const name = parts[0] ?? ''
        const windows = parseInt(parts[1] ?? '1', 10)
        const createdTs = parseInt(parts[2] ?? '0', 10)
        return { name, windows, created: new Date(createdTs * 1000) }
      })
  }

  async sendKeys(session: string, keys: string): Promise<void> {
    // Escape single quotes in the keys string
    const escaped = keys.replace(/'/g, "'\\''")
    await exec(`tmux send-keys -t "${session}" '${escaped}' Enter`)
    this.logger.debug('Sent keys to tmux session', { session, keys: keys.slice(0, 80) })
  }

  async capturePane(session: string, historyLines = 500): Promise<string> {
    const result = await safeExec(
      `tmux capture-pane -t "${session}" -p -S -${historyLines}`,
    )
    if (result.exitCode !== 0) {
      this.logger.warn('capture-pane failed', { session, stderr: result.stderr })
      return ''
    }
    return result.stdout
  }

  async runCommand(session: string, command: string): Promise<void> {
    await this.sendKeys(session, command)
  }
}
