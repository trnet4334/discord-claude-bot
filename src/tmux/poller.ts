import { env } from '../config/env.ts'
import { getLogger } from '../utils/logger.ts'
import type { TmuxAdapter } from './adapter.ts'

export type PollCallback = (newContent: string, fullContent: string) => Promise<void>

interface PollState {
  readonly sessionName: string
  readonly callback: PollCallback
  lastContent: string
  timer: ReturnType<typeof setInterval> | null
}

/**
 * Polls a tmux pane at a fixed interval and emits new content diffs.
 */
export class TmuxPoller {
  private readonly logger = getLogger()
  private readonly polls = new Map<string, PollState>()

  constructor(private readonly adapter: TmuxAdapter) {}

  /**
   * Starts polling a tmux session. Returns a poll ID to stop later.
   */
  start(
    pollId: string,
    sessionName: string,
    callback: PollCallback,
    intervalMs = env.STREAM_POLL_INTERVAL_MS,
  ): void {
    if (this.polls.has(pollId)) {
      this.logger.warn('Poll already running', { pollId })
      return
    }

    const state: PollState = {
      sessionName,
      callback,
      lastContent: '',
      timer: null,
    }

    state.timer = setInterval(async () => {
      try {
        const fullContent = await this.adapter.capturePane(sessionName, 500)
        if (fullContent !== state.lastContent) {
          const newContent = this.diffContent(state.lastContent, fullContent)
          state.lastContent = fullContent
          if (newContent.trim().length > 0) {
            await callback(newContent, fullContent)
          }
        }
      } catch (error) {
        this.logger.error('Poll iteration failed', {
          pollId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }, intervalMs)

    this.polls.set(pollId, state)
    this.logger.debug('Poller started', { pollId, sessionName })
  }

  /**
   * Stops a running poll.
   */
  stop(pollId: string): void {
    const state = this.polls.get(pollId)
    if (state?.timer !== null && state?.timer !== undefined) {
      clearInterval(state.timer)
    }
    this.polls.delete(pollId)
    this.logger.debug('Poller stopped', { pollId })
  }

  /**
   * Stops all running polls.
   */
  stopAll(): void {
    for (const pollId of this.polls.keys()) {
      this.stop(pollId)
    }
  }

  isRunning(pollId: string): boolean {
    return this.polls.has(pollId)
  }

  /**
   * Computes the new lines added since last capture.
   * Simple line-diff: returns lines in new that weren't in old (by position).
   */
  private diffContent(oldContent: string, newContent: string): string {
    if (oldContent.length === 0) return newContent

    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')

    if (newLines.length > oldLines.length) {
      return newLines.slice(oldLines.length).join('\n')
    }

    // Content was replaced (cleared/reset) — return all new content
    if (!newContent.startsWith(oldContent.slice(0, 100))) {
      return newContent
    }

    return ''
  }
}
