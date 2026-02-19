import type { Message } from 'discord.js'
import { AttachmentBuilder } from 'discord.js'
import { env } from '../config/env.ts'
import { getLogger } from '../utils/logger.ts'
import { withRetry } from '../utils/retry.ts'
import { DISCORD } from '../config/constants.ts'
import { formatStreamingContent } from './output.formatter.ts'

const logger = getLogger()

/**
 * Manages throttled, rate-limit-aware Discord message edits for streaming output.
 */
export class DiscordStreamer {
  private pendingContent: string | null = null
  private lastEditAt = 0
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private isUpdating = false
  private isDone = false

  constructor(
    private readonly message: Message,
    private readonly streamId: string,
  ) {}

  /**
   * Queues new content for display. Debounces rapid updates.
   */
  update(content: string): void {
    if (this.isDone) return
    this.pendingContent = content
    this.scheduleEdit()
  }

  /**
   * Marks the stream as complete and performs a final edit.
   */
  async complete(content: string, isError = false): Promise<void> {
    this.isDone = true
    this.cancelDebounce()

    const formatted = formatStreamingContent(content, isError ? 'error' : 'done')
    await this.doEdit(formatted, content, isError ? 'error' : 'done')
  }

  private scheduleEdit(): void {
    if (this.debounceTimer !== null) return

    const now = Date.now()
    const elapsed = now - this.lastEditAt
    const minGap = 1000 / DISCORD.MAX_EDITS_PER_SECOND

    const delay = Math.max(0, minGap - elapsed, env.STREAM_EDIT_DEBOUNCE_MS)

    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null
      await this.flush()
    }, delay)
  }

  private async flush(): Promise<void> {
    if (this.isUpdating || this.pendingContent === null) return
    this.isUpdating = true
    const content = this.pendingContent
    this.pendingContent = null

    const formatted = formatStreamingContent(content, 'running')
    await this.doEdit(formatted, content, 'running')
    this.lastEditAt = Date.now()
    this.isUpdating = false

    // If more content arrived while we were updating, schedule another flush
    if (this.pendingContent !== null) {
      this.scheduleEdit()
    }
  }

  private async doEdit(
    formatted: string,
    rawContent: string,
    _status: 'running' | 'done' | 'error',
  ): Promise<void> {
    try {
      if (rawContent.length > DISCORD.STREAM_CONTENT_LIMIT) {
        const attachment = new AttachmentBuilder(Buffer.from(rawContent), {
          name: DISCORD.ATTACHMENT_FILENAME,
        })
        await withRetry(() =>
          this.message.edit({ content: formatted, files: [attachment] }),
        )
      } else {
        await withRetry(() => this.message.edit({ content: formatted }))
      }
    } catch (error) {
      logger.error('Failed to edit Discord message', {
        streamId: this.streamId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private cancelDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }
}
