import type { Message } from 'discord.js'
import { getLogger } from '../utils/logger.ts'
import { INTENT_PATTERNS } from './intent.detector.ts'
import { formatHelp, formatUnknown } from './response.formatter.ts'
import type { BotRegistry } from '../bot/registry.ts'

const logger = getLogger()

/**
 * Handles natural-language messages (non-slash-command) by detecting intent
 * and routing to the appropriate module's chat handler.
 */
export async function handleChatMessage(
  message: Message,
  registry: BotRegistry,
): Promise<void> {
  const lower = message.content.toLowerCase().trim()

  if (lower === 'help' || lower === '?') {
    await message.reply(formatHelp())
    return
  }

  // Try intent detection
  for (const { pattern, module: moduleName } of INTENT_PATTERNS) {
    if (pattern.test(lower)) {
      const module = registry.getModules().find((m) => m.name === moduleName)
      if (module === undefined) continue

      const handler = module.chatHandlers.find((h) => h.pattern.test(lower))
      if (handler !== undefined) {
        try {
          await handler.execute(message)
          logger.debug('Chat intent routed', { module: moduleName, pattern: pattern.source })
        } catch (error) {
          logger.error('Chat handler error', {
            module: moduleName,
            error: error instanceof Error ? error.message : String(error),
          })
          await message.reply('❌ Something went wrong processing your message.').catch(() => undefined)
        }
        return
      }
    }
  }

  await message.reply(formatUnknown()).catch(() => undefined)
}
