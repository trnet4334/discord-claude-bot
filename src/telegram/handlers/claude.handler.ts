import type { Context } from 'telegraf'
import type { SessionManager } from '../../tmux/session.manager.ts'
import type { ClaudeSessionStore } from '../../modules/claude/claude.session.ts'
import { writeCaudeHooks } from '../../modules/claude/claude.hooks.ts'
import { CLAUDE_CLI, EMOJI } from '../../config/constants.ts'
import { getLogger } from '../../utils/logger.ts'

const logger = getLogger()

/**
 * Handles /claude_start
 */
export async function handleTelegramClaudeStart(
  ctx: Context,
  sessionManager: SessionManager,
  store: ClaudeSessionStore,
): Promise<void> {
  await writeCaudeHooks().catch((e) =>
    logger.warn('Failed to write Claude hooks', {
      error: e instanceof Error ? e.message : String(e),
    }),
  )

  const claudeCmd = `${CLAUDE_CLI.BINARY} ${CLAUDE_CLI.FLAGS.join(' ')}`
  const dbSession = await sessionManager.createSession('claude', claudeCmd, {
    startedBy: String(ctx.from?.id ?? 'telegram'),
  })

  store.set(dbSession.id, {
    dbSession,
    status: 'starting',
    lastActivityAt: new Date(),
    streamId: null,
  })

  store.update(dbSession.id, { status: 'ready' })

  await ctx.reply(
    `${EMOJI.CLAUDE} Claude Code session started!\n` +
      `Session ID: \`${dbSession.id}\`\n` +
      `tmux: \`tmux attach -t ${dbSession.name}\``,
    { parse_mode: 'Markdown' },
  )

  logger.info('Telegram Claude session started', { sessionId: dbSession.id })
}

/**
 * Handles /claude_send <message>
 */
export async function handleTelegramClaudeSend(
  ctx: Context,
  message: string,
  sessionManager: SessionManager,
  store: ClaudeSessionStore,
): Promise<void> {
  const sessions = store.getAll().filter((s) => s.status !== 'dead')

  if (sessions.length === 0) {
    await ctx.reply('❌ No active Claude session. Use /claude\\_start first.', {
      parse_mode: 'Markdown',
    })
    return
  }

  const sessionState = sessions.sort(
    (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime(),
  )[0]

  if (sessionState === undefined) {
    await ctx.reply('❌ No active Claude session.')
    return
  }

  await sessionManager.sendKeys(sessionState.dbSession.id, message)
  store.update(sessionState.dbSession.id, { status: 'busy', lastActivityAt: new Date() })

  await ctx.reply(
    `${EMOJI.RUNNING} Sent to Claude session \`${sessionState.dbSession.id}\`.\nOutput streams to tmux — use \`/claude_attach\` to watch locally.`,
    { parse_mode: 'Markdown' },
  )
}

/**
 * Handles /claude_stop
 */
export async function handleTelegramClaudeStop(
  ctx: Context,
  sessionManager: SessionManager,
  store: ClaudeSessionStore,
): Promise<void> {
  const sessions = store.getAll().filter((s) => s.status !== 'dead')

  if (sessions.length === 0) {
    await ctx.reply('No active Claude sessions.')
    return
  }

  const target = sessions[0]
  if (target === undefined) {
    await ctx.reply('No active Claude sessions.')
    return
  }

  await sessionManager.killSession(target.dbSession.id)
  store.update(target.dbSession.id, { status: 'dead' })

  await ctx.reply(`✅ Claude session \`${target.dbSession.id}\` stopped.`, {
    parse_mode: 'Markdown',
  })
}

/**
 * Handles /claude_status
 */
export async function handleTelegramClaudeStatus(
  ctx: Context,
  store: ClaudeSessionStore,
): Promise<void> {
  const sessions = store.getAll()

  if (sessions.length === 0) {
    await ctx.reply('No Claude sessions. Use /claude\\_start.', { parse_mode: 'Markdown' })
    return
  }

  const lines = sessions.map((s) => {
    const age = Math.round((Date.now() - s.lastActivityAt.getTime()) / 1000)
    return `• \`${s.dbSession.id}\` — ${s.status} — ${age}s ago`
  })

  await ctx.reply(`*Claude Sessions:*\n${lines.join('\n')}`, { parse_mode: 'Markdown' })
}

/**
 * Handles /claude_attach
 */
export async function handleTelegramClaudeAttach(
  ctx: Context,
  store: ClaudeSessionStore,
): Promise<void> {
  const sessions = store.getAll().filter((s) => s.status !== 'dead')

  const target = sessions[0]
  if (target === undefined) {
    await ctx.reply('❌ No active Claude session.')
    return
  }

  await ctx.reply(
    `Run locally:\n\`\`\`\ntmux attach -t ${target.dbSession.name}\n\`\`\``,
    { parse_mode: 'Markdown' },
  )
}
