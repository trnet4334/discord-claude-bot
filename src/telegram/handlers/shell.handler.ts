import type { Context } from 'telegraf'
import { safeExec } from '../../utils/process.ts'
import { commandRepo } from '../../db/repositories/command.repo.ts'
import { requireTelegramConfirmation } from '../telegram.confirm.ts'
import { checkDangerous } from '../../modules/shell/shell.dangerous.ts'
import { formatOutput } from '../../streaming/output.formatter.ts'
import { getLogger } from '../../utils/logger.ts'

const logger = getLogger()

const TELEGRAM_MAX_MSG = 4000

function truncate(text: string): string {
  return text.length > TELEGRAM_MAX_MSG ? text.slice(text.length - TELEGRAM_MAX_MSG) : text
}

/**
 * Handles /shell <command>
 * Usage: /shell ls -la
 */
export async function handleTelegramShell(ctx: Context, command: string): Promise<void> {
  const dangerCheck = checkDangerous(command)
  const severity = dangerCheck.isDangerous ? 'dangerous' : 'write'

  const promptParts = [`*Command:* \`${command}\``]
  if (dangerCheck.isDangerous) {
    promptParts.push(`*Matched pattern:* \`${dangerCheck.matchedPattern}\``)
  }

  const confirmed = await requireTelegramConfirmation(ctx, promptParts.join('\n'), severity)
  if (!confirmed) return

  const startedAt = Date.now()
  const sent = await ctx.reply('⏳ Running...')

  try {
    const result = await safeExec(command, 30_000)
    const output = result.stdout + result.stderr
    const formatted = formatOutput(output)
    const status = result.exitCode === 0 ? '✅' : '❌'
    const text = `${status} Exit \`${result.exitCode}\`\n\`\`\`\n${truncate(formatted.content)}\n\`\`\``

    await ctx.telegram.editMessageText(sent.chat.id, sent.message_id, undefined, text, {
      parse_mode: 'MarkdownV2',
    })

    await commandRepo.create({
      sessionId: null,
      command,
      output: output.slice(0, 4096),
      exitCode: result.exitCode,
      executedAt: new Date(startedAt),
      durationMs: Date.now() - startedAt,
      discordUserId: String(ctx.from?.id ?? 'telegram'),
      discordChannelId: String(ctx.chat?.id ?? 'telegram'),
    })

    logger.info('Telegram shell command executed', { command, exitCode: result.exitCode })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    await ctx.telegram.editMessageText(sent.chat.id, sent.message_id, undefined, `❌ ${msg}`)
  }
}

/**
 * Handles /shell_history [limit]
 * Usage: /shell_history or /shell_history 20
 */
export async function handleTelegramShellHistory(ctx: Context, limit = 10): Promise<void> {
  const history = await commandRepo.findRecent(Math.min(limit, 50))

  if (history.length === 0) {
    await ctx.reply('No command history yet.')
    return
  }

  const lines = history.map((h, i) => {
    const status = h.exitCode === 0 ? '✅' : '❌'
    const ts =
      h.executedAt instanceof Date
        ? h.executedAt.toISOString().slice(0, 19)
        : String(h.executedAt)
    return `${i + 1}. ${status} \`${h.command}\` — ${ts}`
  })

  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' })
}
