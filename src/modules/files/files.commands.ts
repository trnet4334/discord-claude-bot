import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextBasedChannel,
} from 'discord.js'
import { resolve, join, relative } from 'node:path'
import { readdir, stat, writeFile, unlink } from 'node:fs/promises'
import { env } from '../../config/env.ts'
import { getLogger } from '../../utils/logger.ts'
import { uploadFile, readFileForDisplay } from './files.uploader.ts'
import { codeBlock } from '../../utils/truncate.ts'
import { requireConfirmation } from '../../guards/confirmation.guard.ts'
import type { SlashCommandDef } from '../module.interface.ts'

const logger = getLogger()

/**
 * Validates that a path is within the allowed work directory (path traversal protection).
 */
function safePath(inputPath: string): string {
  const base = resolve(env.CLAUDE_WORK_DIR)
  const resolved = resolve(base, inputPath)
  if (!resolved.startsWith(base + '/') && resolved !== base) {
    throw new Error(`Path traversal detected: "${inputPath}" is outside the work directory.`)
  }
  return resolved
}

export function createFilesCommands(): ReadonlyArray<SlashCommandDef> {
  return [
    {
      name: 'file',
      builder: new SlashCommandBuilder()
        .setName('file')
        .setDescription('File management in the work directory')
        .addSubcommand((sub) =>
          sub
            .setName('read')
            .setDescription('Read a file')
            .addStringOption((opt) =>
              opt.setName('path').setDescription('File path (relative to work dir)').setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('write')
            .setDescription('Write content to a file')
            .addStringOption((opt) =>
              opt.setName('path').setDescription('File path (relative to work dir)').setRequired(true),
            )
            .addStringOption((opt) =>
              opt.setName('content').setDescription('Content to write').setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('list')
            .setDescription('List files in a directory')
            .addStringOption((opt) =>
              opt.setName('path').setDescription('Directory path (relative to work dir)'),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('delete')
            .setDescription('Delete a file')
            .addStringOption((opt) =>
              opt.setName('path').setDescription('File path (relative to work dir)').setRequired(true),
            ),
        ) as unknown as SlashCommandBuilder,

      async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const sub = interaction.options.getSubcommand(true)

        if (sub === 'read') await handleRead(interaction)
        else if (sub === 'write') await handleWrite(interaction)
        else if (sub === 'list') await handleList(interaction)
        else if (sub === 'delete') await handleDelete(interaction)
      },
    },
  ] as const
}

async function handleRead(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply()
  const inputPath = interaction.options.getString('path', true)

  try {
    const fullPath = safePath(inputPath)
    const info = await stat(fullPath)

    if (info.size > 1_000_000) {
      // Large file: upload as attachment
      const channel = interaction.channel as TextBasedChannel
      await uploadFile(channel, fullPath, `📎 \`${inputPath}\` (${(info.size / 1024).toFixed(1)} KB)`)
      await interaction.editReply(`📎 File uploaded as attachment (${(info.size / 1024).toFixed(1)} KB).`)
    } else {
      const text = await readFileForDisplay(fullPath)
      await interaction.editReply(codeBlock(text))
    }
  } catch (error) {
    await interaction.editReply(`❌ ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function handleWrite(interaction: ChatInputCommandInteraction): Promise<void> {
  const inputPath = interaction.options.getString('path', true)
  const content = interaction.options.getString('content', true)

  const preview = content.length > 120 ? content.slice(0, 120) + '…' : content
  const confirmed = await requireConfirmation(
    interaction,
    `**File:** \`${inputPath}\`\n**Size:** ${content.length} chars\n**Preview:** \`\`\`\n${preview}\n\`\`\``,
    'write',
  )
  if (!confirmed) return

  try {
    const fullPath = safePath(inputPath)
    await writeFile(fullPath, content, 'utf-8')
    await interaction.editReply(`✅ Written ${content.length} chars to \`${inputPath}\`.`)
    logger.info('File written', { path: fullPath, size: content.length })
  } catch (error) {
    await interaction.editReply(`❌ ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply()
  const inputPath = interaction.options.getString('path') ?? '.'

  try {
    const fullPath = safePath(inputPath)
    const entries = await readdir(fullPath, { withFileTypes: true })
    const base = resolve(env.CLAUDE_WORK_DIR)

    const lines = entries.map((e) => {
      const rel = relative(base, join(fullPath, e.name))
      const icon = e.isDirectory() ? '📁' : '📄'
      return `${icon} ${rel}`
    })

    if (lines.length === 0) {
      await interaction.editReply(`📁 \`${inputPath}\` is empty.`)
      return
    }

    await interaction.editReply(codeBlock(lines.join('\n')))
  } catch (error) {
    await interaction.editReply(`❌ ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  const inputPath = interaction.options.getString('path', true)

  const confirmed = await requireConfirmation(
    interaction,
    `**Delete file:** \`${inputPath}\`\n\nThis action cannot be undone.`,
  )
  if (!confirmed) return

  try {
    const fullPath = safePath(inputPath)
    await unlink(fullPath)
    await interaction.editReply(`✅ Deleted \`${inputPath}\`.`)
    logger.info('File deleted', { path: fullPath })
  } catch (error) {
    await interaction.editReply(`❌ ${error instanceof Error ? error.message : String(error)}`)
  }
}

logger.debug('Files commands module initialised')
