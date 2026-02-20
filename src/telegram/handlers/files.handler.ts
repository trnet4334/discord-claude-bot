import type { Context } from 'telegraf'
import { resolve, relative } from 'node:path'
import { readdir, stat, writeFile, unlink } from 'node:fs/promises'
import { env } from '../../config/env.ts'
import { requireTelegramConfirmation } from '../telegram.confirm.ts'
import { readFileForDisplay } from '../../modules/files/files.uploader.ts'
import { getLogger } from '../../utils/logger.ts'

const logger = getLogger()

const TELEGRAM_MAX_MSG = 4000

function safePath(inputPath: string): string {
  const base = resolve(env.CLAUDE_WORK_DIR)
  const resolved = resolve(base, inputPath)
  if (!resolved.startsWith(base + '/') && resolved !== base) {
    throw new Error(`Path traversal detected: "${inputPath}" is outside the work directory.`)
  }
  return resolved
}

/**
 * Handles /file_read <path>
 */
export async function handleTelegramFileRead(ctx: Context, inputPath: string): Promise<void> {
  try {
    const fullPath = safePath(inputPath)
    const info = await stat(fullPath)

    if (info.size > 1_000_000) {
      // Upload as document for large files
      await ctx.replyWithDocument(
        { source: fullPath, filename: inputPath.split('/').pop() ?? 'file' },
        { caption: `📎 \`${inputPath}\` (${(info.size / 1024).toFixed(1)} KB)` },
      )
    } else {
      const text = await readFileForDisplay(fullPath)
      const truncated = text.length > TELEGRAM_MAX_MSG ? text.slice(0, TELEGRAM_MAX_MSG) + '\n…' : text
      await ctx.reply(`\`\`\`\n${truncated}\n\`\`\``, { parse_mode: 'MarkdownV2' })
    }
  } catch (error) {
    await ctx.reply(`❌ ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Handles /file_write <path> <content>
 * Format: /file_write path/to/file.txt content here
 */
export async function handleTelegramFileWrite(
  ctx: Context,
  inputPath: string,
  content: string,
): Promise<void> {
  const preview = content.length > 100 ? content.slice(0, 100) + '…' : content
  const confirmed = await requireTelegramConfirmation(
    ctx,
    `*File:* \`${inputPath}\`\n*Size:* ${content.length} chars\n*Preview:*\n\`\`\`\n${preview}\n\`\`\``,
    'write',
  )
  if (!confirmed) return

  try {
    const fullPath = safePath(inputPath)
    await writeFile(fullPath, content, 'utf-8')
    await ctx.reply(`✅ Written ${content.length} chars to \`${inputPath}\`.`, {
      parse_mode: 'Markdown',
    })
    logger.info('Telegram file written', { path: fullPath, size: content.length })
  } catch (error) {
    await ctx.reply(`❌ ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Handles /file_list [path]
 */
export async function handleTelegramFileList(ctx: Context, inputPath = '.'): Promise<void> {
  try {
    const fullPath = safePath(inputPath)
    const entries = await readdir(fullPath, { withFileTypes: true })
    const base = resolve(env.CLAUDE_WORK_DIR)

    const lines = entries.map((e) => {
      const rel = relative(base, `${fullPath}/${e.name}`)
      const icon = e.isDirectory() ? '📁' : '📄'
      return `${icon} ${rel}`
    })

    if (lines.length === 0) {
      await ctx.reply(`📁 \`${inputPath}\` is empty.`, { parse_mode: 'Markdown' })
      return
    }

    const text = lines.join('\n')
    const truncated = text.length > TELEGRAM_MAX_MSG ? text.slice(0, TELEGRAM_MAX_MSG) + '\n…' : text
    await ctx.reply(`\`\`\`\n${truncated}\n\`\`\``, { parse_mode: 'MarkdownV2' })
  } catch (error) {
    await ctx.reply(`❌ ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Handles /file_delete <path>
 */
export async function handleTelegramFileDelete(ctx: Context, inputPath: string): Promise<void> {
  const confirmed = await requireTelegramConfirmation(
    ctx,
    `*Delete file:* \`${inputPath}\`\n\nThis action cannot be undone.`,
    'dangerous',
  )
  if (!confirmed) return

  try {
    const fullPath = safePath(inputPath)
    await unlink(fullPath)
    await ctx.reply(`✅ Deleted \`${inputPath}\`.`, { parse_mode: 'Markdown' })
    logger.info('Telegram file deleted', { path: fullPath })
  } catch (error) {
    await ctx.reply(`❌ ${error instanceof Error ? error.message : String(error)}`)
  }
}
