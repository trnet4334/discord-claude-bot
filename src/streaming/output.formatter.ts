import { cleanOutput } from '../utils/ansi.ts'
import { truncateForDiscord, codeBlock } from '../utils/truncate.ts'

export interface FormattedOutput {
  /** Text to display directly in the Discord message */
  readonly content: string
  /** True if output was truncated and should be uploaded as attachment */
  readonly hasOverflow: boolean
  /** The full overflow text for attachment upload */
  readonly overflow: string
}

/**
 * Formats raw tmux pane output for display in Discord:
 * 1. Strips ANSI escape codes
 * 2. Normalises whitespace
 * 3. Truncates to Discord's streaming content limit (1800 chars)
 * 4. Wraps in a code block
 */
export function formatOutput(rawOutput: string, lang = ''): FormattedOutput {
  const cleaned = cleanOutput(rawOutput)
  const result = truncateForDiscord(cleaned)
  const content = codeBlock(result.text, lang)

  return {
    content,
    hasOverflow: result.truncated,
    overflow: result.truncated ? cleaned : '',
  }
}

/**
 * Formats a brief status line + code block for in-progress streaming.
 */
export function formatStreamingContent(
  output: string,
  status: 'running' | 'done' | 'error',
  lang = '',
): string {
  const icons = { running: '⏳', done: '✅', error: '❌' }
  const icon = icons[status]
  const { text } = truncateForDiscord(cleanOutput(output))

  if (text.trim().length === 0) {
    return `${icon} ${status === 'running' ? 'Running…' : status === 'done' ? 'Done.' : 'Error.'}`
  }

  return `${icon}\n${codeBlock(text, lang)}`
}
