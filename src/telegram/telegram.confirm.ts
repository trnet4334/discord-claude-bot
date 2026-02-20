import { Markup, type Context, type Telegraf } from 'telegraf'
import { nanoid } from 'nanoid'
import { getLogger } from '../utils/logger.ts'
import { env } from '../config/env.ts'

const logger = getLogger()

type ConfirmSeverity = 'write' | 'dangerous'

const SEVERITY_CONFIG = {
  write: {
    header: '📝 *Confirm write operation*',
    confirmLabel: '✅ Proceed',
  },
  dangerous: {
    header: '⚠️ *Dangerous operation* — are you sure?',
    confirmLabel: '⚠️ Confirm',
  },
} as const

// Global registry of pending confirmations: callbackData → resolver fn
const pending: Map<string, (confirmed: boolean) => void> = new Map()

/**
 * Wire this once in telegram.bot.ts after bot creation.
 * Handles all inline keyboard confirmation callbacks.
 */
export function registerConfirmationHandlers(bot: Telegraf): void {
  bot.action(/^(confirm|cancel)-/, async (ctx: Context) => {
    const data = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
    const resolve = pending.get(data)
    if (resolve === undefined) {
      await ctx.answerCbQuery('This confirmation has expired.')
      return
    }
    pending.delete(data)

    const confirmed = data.startsWith('confirm-')
    await ctx.answerCbQuery(confirmed ? '✅ Proceeding' : '🚫 Cancelled')
    try {
      const cbq = ctx.callbackQuery
      const originalText =
        cbq !== undefined && cbq.message !== undefined && 'text' in cbq.message
          ? cbq.message.text
          : ''
      await ctx.editMessageText(
        `${originalText}\n\n${confirmed ? '✅ Proceeding...' : '🚫 Cancelled.'}`,
        { parse_mode: 'Markdown' },
      )
    } catch {
      // ignore if message already edited
    }

    resolve(confirmed)
  })
}

/**
 * Sends an inline keyboard confirmation message via Telegram.
 * Returns true if user confirmed, false if cancelled or timed out.
 */
export async function requireTelegramConfirmation(
  ctx: Context,
  prompt: string,
  severity: ConfirmSeverity = 'write',
): Promise<boolean> {
  const config = SEVERITY_CONFIG[severity]
  const confirmData = `confirm-${nanoid(6)}`
  const cancelData = `cancel-${nanoid(6)}`
  const timeoutMs = env.DANGEROUS_CMD_TIMEOUT_MS

  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback(config.confirmLabel, confirmData),
    Markup.button.callback('❌ Cancel', cancelData),
  ])

  const message = `${config.header}\n\n${prompt}`
  const sent = await ctx.reply(message, { ...keyboard, parse_mode: 'Markdown' })

  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(async () => {
      pending.delete(confirmData)
      pending.delete(cancelData)
      try {
        await ctx.telegram.editMessageText(
          sent.chat.id,
          sent.message_id,
          undefined,
          `${message}\n\n_⏰ Timed out._`,
          { parse_mode: 'Markdown' },
        )
      } catch {
        // ignore
      }
      logger.info('Telegram confirmation timed out', { severity })
      resolve(false)
    }, timeoutMs)

    function settle(confirmed: boolean): void {
      clearTimeout(timer)
      pending.delete(confirmData)
      pending.delete(cancelData)
      logger.info('Telegram confirmation settled', { severity, confirmed })
      resolve(confirmed)
    }

    pending.set(confirmData, (confirmed) => settle(confirmed))
    pending.set(cancelData, (confirmed) => settle(confirmed))
  })
}
