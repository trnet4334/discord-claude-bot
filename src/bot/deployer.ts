import { REST, Routes } from 'discord.js'
import { env } from '../config/env.ts'
import { getLogger } from '../utils/logger.ts'
import type { BotRegistry } from './registry.ts'

/**
 * Deploys slash commands to the configured Discord guild.
 * Run this script once after adding/removing commands.
 */
export async function deployCommands(registry: BotRegistry): Promise<void> {
  const logger = getLogger()
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN)

  const commands = registry.getAllSlashCommands().map((cmd) => cmd.toJSON())

  logger.info('Deploying slash commands', { count: commands.length })

  try {
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_APPLICATION_ID, env.DISCORD_GUILD_ID), {
      body: commands,
    })
    logger.info('Slash commands deployed successfully')
  } catch (error) {
    throw new Error(
      `Failed to deploy slash commands: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
