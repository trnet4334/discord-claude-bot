import type { Context } from 'telegraf'
import { safeExec } from '../../utils/process.ts'
import { getLogger } from '../../utils/logger.ts'

const logger = getLogger()

const TELEGRAM_MAX_MSG = 4000

function truncate(text: string): string {
  return text.length > TELEGRAM_MAX_MSG ? text.slice(0, TELEGRAM_MAX_MSG) + '\n…' : text
}

async function replyCode(ctx: Context, text: string): Promise<void> {
  await ctx.reply(`\`\`\`\n${truncate(text)}\n\`\`\``, { parse_mode: 'MarkdownV2' })
}

/**
 * Handles /system_status
 */
export async function handleTelegramSystemStatus(ctx: Context): Promise<void> {
  const [uptimeResult, memResult, loadResult] = await Promise.all([
    safeExec('uptime'),
    safeExec('vm_stat | head -10'),
    safeExec('sysctl -n hw.ncpu'),
  ])

  const output = [
    `Uptime: ${uptimeResult.stdout.trim()}`,
    `CPUs: ${loadResult.stdout.trim()}`,
    '',
    'Memory (vm_stat):',
    memResult.stdout.trim(),
  ].join('\n')

  await replyCode(ctx, output)
  logger.debug('Telegram system status sent')
}

/**
 * Handles /system_ps [count]
 */
export async function handleTelegramSystemPs(ctx: Context, count = 10): Promise<void> {
  const result = await safeExec(`ps aux | sort -nrk 3 | head -n ${Math.min(count, 30) + 1}`)
  await replyCode(ctx, result.stdout.trim())
}

/**
 * Handles /system_df
 */
export async function handleTelegramSystemDf(ctx: Context): Promise<void> {
  const result = await safeExec('df -h')
  await replyCode(ctx, result.stdout.trim())
}

/**
 * Handles /system_top
 */
export async function handleTelegramSystemTop(ctx: Context): Promise<void> {
  const result = await safeExec('top -l 1 -n 10 -s 1')
  const lines = result.stdout.trim().split('\n').slice(0, 15)
  await replyCode(ctx, lines.join('\n'))
}
