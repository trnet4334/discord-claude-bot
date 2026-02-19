import type { Client, Interaction, Message } from 'discord.js'
import { Events } from 'discord.js'
import { getLogger } from '../utils/logger.ts'
import { authGuard } from '../guards/auth.guard.ts'
import type { BotRegistry } from './registry.ts'

/**
 * Wires Discord events to the appropriate module handlers.
 */
export function attachRouter(client: Client, registry: BotRegistry): void {
  const logger = getLogger()

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!authGuard.isAllowed(interaction.user.id)) {
      logger.warn('Unauthorized interaction attempt', { userId: interaction.user.id })
      if (interaction.isRepliable()) {
        await interaction.reply({ content: '🚫 Access denied.', ephemeral: true }).catch(() => undefined)
      }
      return
    }

    if (interaction.isChatInputCommand()) {
      const module = registry.findCommandModule(interaction.commandName)
      if (module === undefined) {
        logger.warn('Unknown slash command', { command: interaction.commandName })
        await interaction.reply({ content: '❓ Unknown command.', ephemeral: true }).catch(() => undefined)
        return
      }

      const handler = module.slashCommands.find((c) => c.name === interaction.commandName)
      if (handler === undefined) return

      try {
        await handler.execute(interaction)
      } catch (error) {
        logger.error('Command handler threw', {
          command: interaction.commandName,
          error: error instanceof Error ? error.message : String(error),
        })
        const msg = '❌ An error occurred while executing this command.'
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: msg, ephemeral: true }).catch(() => undefined)
        } else {
          await interaction.reply({ content: msg, ephemeral: true }).catch(() => undefined)
        }
      }
      return
    }

    // Button / select-menu interactions are handled by their own collectors;
    // unrecognised component interactions are silently ignored here.
  })

  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return
    if (!authGuard.isAllowed(message.author.id)) return

    const module = registry.findChatModule(message.content)
    if (module === undefined) return

    const handler = module.chatHandlers.find((h) => h.pattern.test(message.content.toLowerCase()))
    if (handler === undefined) return

    try {
      await handler.execute(message)
    } catch (error) {
      logger.error('Chat handler threw', {
        error: error instanceof Error ? error.message : String(error),
      })
      await message.reply('❌ Something went wrong.').catch(() => undefined)
    }
  })
}
