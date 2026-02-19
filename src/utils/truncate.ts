import { DISCORD } from '../config/constants.ts'

/**
 * Truncates text to Discord's streaming content limit (1800 chars).
 * Returns { text, truncated, overflow } where overflow is the excess text.
 */
export function truncateForDiscord(text: string): {
  text: string
  truncated: boolean
  overflow: string
} {
  if (text.length <= DISCORD.STREAM_CONTENT_LIMIT) {
    return { text, truncated: false, overflow: '' }
  }

  return {
    text: text.slice(0, DISCORD.STREAM_CONTENT_LIMIT),
    truncated: true,
    overflow: text.slice(DISCORD.STREAM_CONTENT_LIMIT),
  }
}

/**
 * Wraps text in a Discord code block, respecting the 2000-char limit.
 */
export function codeBlock(text: string, lang = ''): string {
  const wrapped = `\`\`\`${lang}\n${text}\n\`\`\``
  if (wrapped.length <= DISCORD.MAX_MESSAGE_LENGTH) return wrapped

  const limit = DISCORD.MAX_MESSAGE_LENGTH - lang.length - 8 // 8 = 3+1+3+1 for fences
  return `\`\`\`${lang}\n${text.slice(0, limit)}\n\`\`\``
}

/**
 * Truncates a string to fit within Discord's max message length.
 */
export function truncateMessage(text: string, suffix = '…'): string {
  if (text.length <= DISCORD.MAX_MESSAGE_LENGTH) return text
  return text.slice(0, DISCORD.MAX_MESSAGE_LENGTH - suffix.length) + suffix
}
