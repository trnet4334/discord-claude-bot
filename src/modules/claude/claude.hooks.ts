import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { env } from '../../config/env.ts'
import { getLogger } from '../../utils/logger.ts'

const logger = getLogger()

/**
 * Writes a .claude/settings.json in the work directory that adds PostToolUse hooks.
 * The hook echoes a JSON notification to stdout which the bot can parse via polling.
 * (Full FIFO bridge is a future enhancement; stdout capture is used here for simplicity.)
 */
export async function writeCaudeHooks(): Promise<void> {
  const claudeDir = join(env.CLAUDE_WORK_DIR, '.claude')

  try {
    await mkdir(claudeDir, { recursive: true })
  } catch {
    // Directory already exists — fine
  }

  const settingsPath = join(claudeDir, 'settings.json')

  // Minimal hook: logs tool usage to a temp file for optional monitoring
  const hookScript = `echo "{\\"type\\":\\"tool_use\\",\\"tool\\":\\"$CLAUDE_TOOL_NAME\\",\\"ts\\":\\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\"}" >> /tmp/claude-bot-hooks.log`

  const settings = {
    hooks: {
      PostToolUse: [
        {
          matcher: '*',
          hooks: [{ type: 'command', command: hookScript }],
        },
      ],
    },
  }

  await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
  logger.info('Claude hooks written', { path: settingsPath })
}
