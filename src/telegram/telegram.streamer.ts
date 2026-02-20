import type { Telegraf } from 'telegraf'
import { getLogger } from '../utils/logger.ts'

const logger = getLogger()

const TELEGRAM_MAX_CHARS = 4000
const DEBOUNCE_MS = 1200 // 1 edit/sec Telegram limit — safe margin

/**
 * Accumulates tmux output chunks and sends them as debounced edits
 * to a Telegram message. Rate-limit aware (1 edit/sec per chat).
 */
export class TelegramStreamer {
  private buffer: string = ''
  private timer: ReturnType<typeof setTimeout> | null = null
  private finished = false

  constructor(
    private readonly bot: Telegraf,
    private readonly chatId: number | string,
    private readonly messageId: number,
  ) {}

  push(chunk: string): void {
    if (this.finished) return
    this.buffer = this.buffer + chunk
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), DEBOUNCE_MS)
  }

  async finish(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.finished = true
    await this.flush()
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return

    const text = this.buffer.length > TELEGRAM_MAX_CHARS
      ? this.buffer.slice(this.buffer.length - TELEGRAM_MAX_CHARS)
      : this.buffer

    try {
      await this.bot.telegram.editMessageText(
        this.chatId,
        this.messageId,
        undefined,
        `\`\`\`\n${text}\n\`\`\``,
        { parse_mode: 'MarkdownV2' },
      )
    } catch (error) {
      // Ignore "message is not modified" errors (Telegram returns 400)
      const msg = error instanceof Error ? error.message : String(error)
      if (!msg.includes('message is not modified')) {
        logger.warn('TelegramStreamer edit failed', { error: msg })
      }
    }
  }
}
