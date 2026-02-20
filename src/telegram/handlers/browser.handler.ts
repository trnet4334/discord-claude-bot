import type { Context } from 'telegraf'
import type { BrowserService } from '../../browser/browser.service.ts'
import { getLogger } from '../../utils/logger.ts'

const logger = getLogger()

// Per-chat single active browser session
const chatSessions: Map<number | string, string> = new Map()

function getChatId(ctx: Context): number | string {
  return ctx.chat?.id ?? 'unknown'
}

async function sendScreenshot(ctx: Context, screenshot: Buffer, caption: string): Promise<void> {
  await ctx.replyWithPhoto({ source: screenshot }, { caption })
}

/**
 * Handles /browser_open <url>
 */
export async function handleTelegramBrowserOpen(
  ctx: Context,
  url: string,
  browserService: BrowserService,
): Promise<void> {
  const chatId = getChatId(ctx)
  const sent = await ctx.reply('🌐 Opening browser...')

  try {
    const existing = chatSessions.get(chatId)
    const sessionId: string =
      existing !== undefined && browserService.hasSession(existing)
        ? existing
        : await browserService.createSession()
    chatSessions.set(chatId, sessionId)

    const screenshot = await browserService.navigate(sessionId, url)
    await ctx.telegram.deleteMessage(sent.chat.id, sent.message_id)
    await sendScreenshot(ctx, screenshot, `🌐 Navigated to ${url}`)
    logger.info('Telegram browser navigate', { sessionId, url })
  } catch (error) {
    await ctx.telegram.editMessageText(
      sent.chat.id,
      sent.message_id,
      undefined,
      `❌ ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Handles /browser_click <selector>
 */
export async function handleTelegramBrowserClick(
  ctx: Context,
  selector: string,
  browserService: BrowserService,
): Promise<void> {
  const chatId = getChatId(ctx)
  const sessionId = chatSessions.get(chatId)

  if (sessionId === undefined || !browserService.hasSession(sessionId)) {
    await ctx.reply('❌ No active browser session. Use /browser\\_open first.', {
      parse_mode: 'Markdown',
    })
    return
  }

  try {
    const screenshot = await browserService.click(sessionId, selector)
    await sendScreenshot(ctx, screenshot, `🖱️ Clicked \`${selector}\``)
  } catch (error) {
    await ctx.reply(`❌ ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Handles /browser_type <selector> <text>
 */
export async function handleTelegramBrowserType(
  ctx: Context,
  selector: string,
  text: string,
  browserService: BrowserService,
): Promise<void> {
  const chatId = getChatId(ctx)
  const sessionId = chatSessions.get(chatId)

  if (sessionId === undefined || !browserService.hasSession(sessionId)) {
    await ctx.reply('❌ No active browser session. Use /browser\\_open first.', {
      parse_mode: 'Markdown',
    })
    return
  }

  try {
    const screenshot = await browserService.typeText(sessionId, selector, text)
    await sendScreenshot(ctx, screenshot, `⌨️ Typed into \`${selector}\``)
  } catch (error) {
    await ctx.reply(`❌ ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Handles /browser_shot
 */
export async function handleTelegramBrowserShot(
  ctx: Context,
  browserService: BrowserService,
): Promise<void> {
  const chatId = getChatId(ctx)
  const sessionId = chatSessions.get(chatId)

  if (sessionId === undefined || !browserService.hasSession(sessionId)) {
    await ctx.reply('❌ No active browser session. Use /browser\\_open first.', {
      parse_mode: 'Markdown',
    })
    return
  }

  try {
    const screenshot = await browserService.screenshot(sessionId)
    await sendScreenshot(ctx, screenshot, '📸 Current screenshot')
  } catch (error) {
    await ctx.reply(`❌ ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Handles /browser_close
 */
export async function handleTelegramBrowserClose(
  ctx: Context,
  browserService: BrowserService,
): Promise<void> {
  const chatId = getChatId(ctx)
  const sessionId = chatSessions.get(chatId)

  if (sessionId === undefined || !browserService.hasSession(sessionId)) {
    await ctx.reply('ℹ️ No active browser session.')
    return
  }

  await browserService.closeSession(sessionId)
  chatSessions.delete(chatId)
  await ctx.reply('✅ Browser session closed.')
  logger.info('Telegram browser session closed', { sessionId })
}
