import { env } from './config/env.ts'
import { initLogger, getLogger } from './utils/logger.ts'
import { initDb, runMigrations } from './db/client.ts'
import { createClient } from './bot/client.ts'
import { BotRegistry } from './bot/registry.ts'
import { deployCommands } from './bot/deployer.ts'
import { attachRouter } from './bot/router.ts'
import { loadModules, unloadModules } from './modules/module.loader.ts'
import { TmuxAdapterImpl } from './tmux/tmux.adapter.ts'
import { SessionManager } from './tmux/session.manager.ts'
import { TmuxPoller } from './tmux/poller.ts'
import { StreamManager } from './streaming/stream.manager.ts'
import { ShellModule } from './modules/shell/shell.module.ts'
import { ClaudeModule } from './modules/claude/claude.module.ts'
import { FilesModule } from './modules/files/files.module.ts'
import { SystemModule } from './modules/system/system.module.ts'
import { BrowserModule } from './browser/browser.module.ts'
import { createTelegramBot, startTelegramBot, stopTelegramBot } from './telegram/telegram.bot.ts'
import { Events } from 'discord.js'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

// ─── Bootstrap ───────────────────────────────────────────────────────────────

initLogger(env.LOG_LEVEL)
const logger = getLogger()

logger.info('Starting Discord Claude Bot', { logLevel: env.LOG_LEVEL })

// Ensure data directory exists
await mkdir(dirname(env.DATABASE_PATH), { recursive: true }).catch(() => undefined)

// Initialize database
const db = initDb(env.DATABASE_PATH)
runMigrations(db)

// Build infrastructure
const adapter = new TmuxAdapterImpl()
const sessionManager = new SessionManager(adapter)
const poller = new TmuxPoller(adapter)
const streamManager = new StreamManager(poller)

// Reconcile existing sessions with live tmux
await sessionManager.reconcile()

// Build modules
const claudeModule = new ClaudeModule(sessionManager, streamManager, adapter)
const browserModule = new BrowserModule()
const modules = [
  new ShellModule(sessionManager, streamManager),
  claudeModule,
  new FilesModule(),
  new SystemModule(),
  browserModule,
]

// Optional Telegram bot (started after Discord is ready)
const telegramBotInstance =
  env.TELEGRAM_BOT_TOKEN !== undefined && env.TELEGRAM_ALLOWED_CHAT_ID !== undefined
    ? createTelegramBot({
        token: env.TELEGRAM_BOT_TOKEN,
        allowedChatId: env.TELEGRAM_ALLOWED_CHAT_ID,
        sessionManager,
        sessionStore: claudeModule.sessionStore,
        browserService: browserModule.browserService,
      })
    : null

// Build registry and Discord client
const registry = new BotRegistry()
const client = createClient()

// Attach event router
attachRouter(client, registry)

// Deploy slash commands and initialize modules once ready
client.once(Events.ClientReady, async (readyClient: { user: { tag: string } }) => {
  logger.info('Discord client ready', { username: readyClient.user.tag })

  await loadModules(modules, registry, client)

  // Deploy slash commands to the configured guild
  try {
    await deployCommands(registry)
  } catch (error) {
    logger.error('Failed to deploy commands', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Start Telegram bot if configured
  if (telegramBotInstance !== null) {
    await startTelegramBot(telegramBotInstance)
  }
})

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal} — shutting down`)
  streamManager.stopAll()
  poller.stopAll()
  if (telegramBotInstance !== null) stopTelegramBot(telegramBotInstance)
  await unloadModules(modules)
  client.destroy()
  logger.info('Shutdown complete')
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack })
  void shutdown('uncaughtException')
})

// ─── Connect ──────────────────────────────────────────────────────────────────

await client.login(env.DISCORD_TOKEN)
