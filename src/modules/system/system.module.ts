import type { Client } from 'discord.js'
import type { BotModule, SlashCommandDef, ChatHandlerDef } from '../module.interface.ts'
import { createSystemCommands } from './system.commands.ts'
import { SystemMonitor } from './system.monitor.ts'
import { getLogger } from '../../utils/logger.ts'

const logger = getLogger()

export class SystemModule implements BotModule {
  readonly name = 'system'
  readonly description = 'System monitoring and diagnostics'
  readonly chatHandlers: ReadonlyArray<ChatHandlerDef> = []
  readonly slashCommands: ReadonlyArray<SlashCommandDef>
  readonly monitor = new SystemMonitor()

  constructor() {
    this.slashCommands = createSystemCommands()
  }

  async initialize(_client: Client): Promise<void> {
    logger.info('SystemModule initialized')
  }

  async teardown(): Promise<void> {
    this.monitor.stop()
    logger.info('SystemModule torn down')
  }
}
