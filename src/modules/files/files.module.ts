import type { Client } from 'discord.js'
import type { BotModule, SlashCommandDef, ChatHandlerDef } from '../module.interface.ts'
import { createFilesCommands } from './files.commands.ts'
import { getLogger } from '../../utils/logger.ts'

const logger = getLogger()

export class FilesModule implements BotModule {
  readonly name = 'files'
  readonly description = 'File management in the configured work directory'
  readonly chatHandlers: ReadonlyArray<ChatHandlerDef> = []
  readonly slashCommands: ReadonlyArray<SlashCommandDef>

  constructor() {
    this.slashCommands = createFilesCommands()
  }

  async initialize(_client: Client): Promise<void> {
    logger.info('FilesModule initialized')
  }

  async teardown(): Promise<void> {
    logger.info('FilesModule torn down')
  }
}
