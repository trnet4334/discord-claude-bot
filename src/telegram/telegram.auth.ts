import type { Context } from 'telegraf'
import { getLogger } from '../utils/logger.ts'

const logger = getLogger()

/**
 * Enforces that a Telegram message comes from the allowed chat/user.
 * Returns true if allowed, false otherwise (and sends rejection message).
 */
export async function assertTelegramAllowed(
  ctx: Context,
  allowedChatId: string,
): Promise<boolean> {
  const chatId = ctx.chat?.id?.toString()
  if (chatId === allowedChatId) return true

  logger.warn('Unauthorized Telegram access attempt', {
    chatId,
    userId: ctx.from?.id,
  })

  try {
    await ctx.reply('⛔ Unauthorized.')
  } catch {
    // ignore reply errors
  }
  return false
}
