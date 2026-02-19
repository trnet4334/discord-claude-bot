import type { Client } from 'discord.js'
import { getLogger } from '../utils/logger.ts'
import type { BotModule } from './module.interface.ts'
import type { BotRegistry } from '../bot/registry.ts'

const logger = getLogger()

/**
 * Registers all modules with the registry and initializes them.
 * Errors in individual modules are caught and logged without crashing the bot.
 */
export async function loadModules(
  modules: ReadonlyArray<BotModule>,
  registry: BotRegistry,
  client: Client,
): Promise<void> {
  for (const module of modules) {
    try {
      registry.register(module)
      await module.initialize(client)
      logger.info('Module loaded', { name: module.name })
    } catch (error) {
      logger.error('Failed to load module', {
        name: module.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

/**
 * Tears down all registered modules gracefully.
 */
export async function unloadModules(modules: ReadonlyArray<BotModule>): Promise<void> {
  for (const module of modules) {
    try {
      await module.teardown()
      logger.info('Module unloaded', { name: module.name })
    } catch (error) {
      logger.error('Error during module teardown', {
        name: module.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
