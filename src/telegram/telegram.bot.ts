import { Telegraf } from 'telegraf'
import { getLogger } from '../utils/logger.ts'
import { assertTelegramAllowed } from './telegram.auth.ts'
import { registerConfirmationHandlers } from './telegram.confirm.ts'
import type { SessionManager } from '../tmux/session.manager.ts'
import type { ClaudeSessionStore } from '../modules/claude/claude.session.ts'
import type { BrowserService } from '../browser/browser.service.ts'
import {
  handleTelegramShell,
  handleTelegramShellHistory,
} from './handlers/shell.handler.ts'
import {
  handleTelegramClaudeStart,
  handleTelegramClaudeSend,
  handleTelegramClaudeStop,
  handleTelegramClaudeStatus,
  handleTelegramClaudeAttach,
} from './handlers/claude.handler.ts'
import {
  handleTelegramFileRead,
  handleTelegramFileWrite,
  handleTelegramFileList,
  handleTelegramFileDelete,
} from './handlers/files.handler.ts'
import {
  handleTelegramSystemStatus,
  handleTelegramSystemPs,
  handleTelegramSystemDf,
  handleTelegramSystemTop,
} from './handlers/system.handler.ts'
import {
  handleTelegramBrowserOpen,
  handleTelegramBrowserClick,
  handleTelegramBrowserType,
  handleTelegramBrowserShot,
  handleTelegramBrowserClose,
} from './handlers/browser.handler.ts'

const logger = getLogger()

export interface TelegramBotConfig {
  readonly token: string
  readonly allowedChatId: string
  readonly sessionManager: SessionManager
  readonly sessionStore: ClaudeSessionStore
  readonly browserService: BrowserService
}

export function createTelegramBot(config: TelegramBotConfig): Telegraf {
  const { token, allowedChatId, sessionManager, sessionStore, browserService } = config
  const bot = new Telegraf(token)

  // Auth middleware — runs before every update
  bot.use(async (ctx, next) => {
    const allowed = await assertTelegramAllowed(ctx, allowedChatId)
    if (!allowed) return
    await next()
  })

  // Register inline keyboard confirmation handler
  registerConfirmationHandlers(bot)

  // ── Shell ─────────────────────────────────────────────────────────────────
  // Usage: /shell ls -la
  bot.command('shell', async (ctx) => {
    const text = ctx.message.text.replace(/^\/shell\s*/, '').trim()
    if (text.length === 0) {
      await ctx.reply('Usage: /shell <command>')
      return
    }
    await handleTelegramShell(ctx, text)
  })

  // Usage: /shell_history [limit]
  bot.command('shell_history', async (ctx) => {
    const arg = ctx.message.text.replace(/^\/shell_history\s*/, '').trim()
    const limit = parseInt(arg, 10)
    await handleTelegramShellHistory(ctx, isNaN(limit) ? 10 : limit)
  })

  // ── Claude ────────────────────────────────────────────────────────────────
  bot.command('claude_start', async (ctx) => {
    await handleTelegramClaudeStart(ctx, sessionManager, sessionStore)
  })

  // Usage: /claude_send <message>
  bot.command('claude_send', async (ctx) => {
    const message = ctx.message.text.replace(/^\/claude_send\s*/, '').trim()
    if (message.length === 0) {
      await ctx.reply('Usage: /claude\\_send <message>', { parse_mode: 'Markdown' })
      return
    }
    await handleTelegramClaudeSend(ctx, message, sessionManager, sessionStore)
  })

  bot.command('claude_stop', async (ctx) => {
    await handleTelegramClaudeStop(ctx, sessionManager, sessionStore)
  })

  bot.command('claude_status', async (ctx) => {
    await handleTelegramClaudeStatus(ctx, sessionStore)
  })

  bot.command('claude_attach', async (ctx) => {
    await handleTelegramClaudeAttach(ctx, sessionStore)
  })

  // ── Files ─────────────────────────────────────────────────────────────────
  // Usage: /file_read path/to/file.txt
  bot.command('file_read', async (ctx) => {
    const path = ctx.message.text.replace(/^\/file_read\s*/, '').trim()
    if (path.length === 0) {
      await ctx.reply('Usage: /file_read <path>')
      return
    }
    await handleTelegramFileRead(ctx, path)
  })

  // Usage: /file_write path/to/file.txt\ncontent here
  bot.command('file_write', async (ctx) => {
    const rest = ctx.message.text.replace(/^\/file_write\s*/, '').trim()
    const spaceIdx = rest.indexOf(' ')
    if (spaceIdx === -1) {
      await ctx.reply('Usage: /file_write <path> <content>')
      return
    }
    const filePath = rest.slice(0, spaceIdx)
    const content = rest.slice(spaceIdx + 1)
    await handleTelegramFileWrite(ctx, filePath, content)
  })

  // Usage: /file_list [path]
  bot.command('file_list', async (ctx) => {
    const path = ctx.message.text.replace(/^\/file_list\s*/, '').trim()
    await handleTelegramFileList(ctx, path.length > 0 ? path : '.')
  })

  // Usage: /file_delete path/to/file.txt
  bot.command('file_delete', async (ctx) => {
    const path = ctx.message.text.replace(/^\/file_delete\s*/, '').trim()
    if (path.length === 0) {
      await ctx.reply('Usage: /file_delete <path>')
      return
    }
    await handleTelegramFileDelete(ctx, path)
  })

  // ── System ────────────────────────────────────────────────────────────────
  bot.command('system_status', async (ctx) => {
    await handleTelegramSystemStatus(ctx)
  })

  bot.command('system_ps', async (ctx) => {
    const arg = ctx.message.text.replace(/^\/system_ps\s*/, '').trim()
    const count = parseInt(arg, 10)
    await handleTelegramSystemPs(ctx, isNaN(count) ? 10 : count)
  })

  bot.command('system_df', async (ctx) => {
    await handleTelegramSystemDf(ctx)
  })

  bot.command('system_top', async (ctx) => {
    await handleTelegramSystemTop(ctx)
  })

  // ── Browser ───────────────────────────────────────────────────────────────
  // Usage: /browser_open https://example.com
  bot.command('browser_open', async (ctx) => {
    const url = ctx.message.text.replace(/^\/browser_open\s*/, '').trim()
    if (url.length === 0) {
      await ctx.reply('Usage: /browser_open <url>')
      return
    }
    await handleTelegramBrowserOpen(ctx, url, browserService)
  })

  // Usage: /browser_click h1
  bot.command('browser_click', async (ctx) => {
    const selector = ctx.message.text.replace(/^\/browser_click\s*/, '').trim()
    if (selector.length === 0) {
      await ctx.reply('Usage: /browser_click <css-selector>')
      return
    }
    await handleTelegramBrowserClick(ctx, selector, browserService)
  })

  // Usage: /browser_type input[name=q] hello world
  bot.command('browser_type', async (ctx) => {
    const rest = ctx.message.text.replace(/^\/browser_type\s*/, '').trim()
    const spaceIdx = rest.indexOf(' ')
    if (spaceIdx === -1) {
      await ctx.reply('Usage: /browser_type <selector> <text>')
      return
    }
    const selector = rest.slice(0, spaceIdx)
    const text = rest.slice(spaceIdx + 1)
    await handleTelegramBrowserType(ctx, selector, text, browserService)
  })

  bot.command('browser_shot', async (ctx) => {
    await handleTelegramBrowserShot(ctx, browserService)
  })

  bot.command('browser_close', async (ctx) => {
    await handleTelegramBrowserClose(ctx, browserService)
  })

  // ── Help ──────────────────────────────────────────────────────────────────
  bot.command('start', async (ctx) => {
    await ctx.reply(
      '*Discord Claude Bot — Telegram Interface*\n\n' +
        '*Shell*\n' +
        '/shell \\<cmd\\> — Run command\n' +
        '/shell\\_history \\[limit\\] — Recent history\n\n' +
        '*Claude Code*\n' +
        '/claude\\_start — Start session\n' +
        '/claude\\_send \\<msg\\> — Send message\n' +
        '/claude\\_stop — Stop session\n' +
        '/claude\\_status — List sessions\n' +
        '/claude\\_attach — Get tmux command\n\n' +
        '*Files*\n' +
        '/file\\_read \\<path\\>\n' +
        '/file\\_write \\<path\\> \\<content\\>\n' +
        '/file\\_list \\[path\\]\n' +
        '/file\\_delete \\<path\\>\n\n' +
        '*System*\n' +
        '/system\\_status — Overview\n' +
        '/system\\_ps \\[count\\] — Processes\n' +
        '/system\\_df — Disk usage\n' +
        '/system\\_top — CPU snapshot\n\n' +
        '*Browser*\n' +
        '/browser\\_open \\<url\\>\n' +
        '/browser\\_click \\<selector\\>\n' +
        '/browser\\_type \\<selector\\> \\<text\\>\n' +
        '/browser\\_shot — Screenshot\n' +
        '/browser\\_close — Close session',
      { parse_mode: 'MarkdownV2' },
    )
  })

  logger.info('Telegram bot configured')
  return bot
}

export async function startTelegramBot(bot: Telegraf): Promise<void> {
  await bot.launch()
  logger.info('Telegram bot started (long-polling)')
}

export function stopTelegramBot(bot: Telegraf): void {
  bot.stop('SIGTERM')
  logger.info('Telegram bot stopped')
}
