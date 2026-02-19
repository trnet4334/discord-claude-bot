import { AttachmentBuilder, type TextBasedChannel } from 'discord.js'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { DISCORD } from '../../config/constants.ts'
import { getLogger } from '../../utils/logger.ts'

const logger = getLogger()

/**
 * Uploads a local file as a Discord attachment.
 */
export async function uploadFile(
  channel: TextBasedChannel,
  filePath: string,
  caption?: string,
): Promise<void> {
  if (!channel.isSendable()) {
    throw new Error('Channel does not support sending messages')
  }

  try {
    const content = await readFile(filePath)
    const fileName = basename(filePath)

    const attachment = new AttachmentBuilder(content, { name: fileName })
    await channel.send({
      content: caption ?? `📎 \`${fileName}\``,
      files: [attachment],
    })

    logger.debug('File uploaded', { path: filePath, size: content.length })
  } catch (error) {
    throw new Error(
      `Failed to upload file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Reads a file and returns its text content, truncated to Discord's limit.
 */
export async function readFileForDisplay(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8')
  if (content.length <= DISCORD.STREAM_CONTENT_LIMIT) return content
  return content.slice(0, DISCORD.STREAM_CONTENT_LIMIT) + '\n…(truncated)'
}
