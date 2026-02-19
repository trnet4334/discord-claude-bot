import type { Client, ChatInputCommandInteraction, Message, SlashCommandBuilder } from 'discord.js'

export interface SlashCommandDef {
  readonly name: string
  readonly builder: SlashCommandBuilder
  execute(interaction: ChatInputCommandInteraction): Promise<void>
}

export interface ChatHandlerDef {
  /** Regex pattern tested against the lowercased message content */
  readonly pattern: RegExp
  readonly description: string
  execute(message: Message): Promise<void>
}

/**
 * Lifecycle contract for all bot modules.
 * Each module registers its own slash commands and chat patterns.
 */
export interface BotModule {
  readonly name: string
  readonly description: string
  readonly slashCommands: ReadonlyArray<SlashCommandDef>
  readonly chatHandlers: ReadonlyArray<ChatHandlerDef>
  initialize(client: Client): Promise<void>
  teardown(): Promise<void>
}
