import type { SlashCommandBuilder } from 'discord.js'
import type { BotModule } from '../modules/module.interface.ts'

/**
 * Collects all slash command definitions and chat handlers from registered modules.
 */
export class BotRegistry {
  private readonly modules: BotModule[] = []

  register(module: BotModule): void {
    this.modules.push(module)
  }

  getModules(): ReadonlyArray<BotModule> {
    return this.modules
  }

  getAllSlashCommands(): ReadonlyArray<SlashCommandBuilder> {
    return this.modules.flatMap((m) =>
      m.slashCommands.map((def) => def.builder),
    )
  }

  findCommandModule(commandName: string): BotModule | undefined {
    return this.modules.find((m) =>
      m.slashCommands.some((cmd) => cmd.name === commandName),
    )
  }

  findChatModule(message: string): BotModule | undefined {
    const lower = message.toLowerCase()
    return this.modules.find((m) =>
      m.chatHandlers.some((h) => h.pattern.test(lower)),
    )
  }
}
