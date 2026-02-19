import type { Client } from 'discord.js'
import type { BotModule, SlashCommandDef, ChatHandlerDef } from '../module.interface.ts'
import type { SessionManager } from '../../tmux/session.manager.ts'
import type { StreamManager } from '../../streaming/stream.manager.ts'
import { createShellCommands } from './shell.commands.ts'
import { getLogger } from '../../utils/logger.ts'

const logger = getLogger()

export class ShellModule implements BotModule {
  readonly name = 'shell'
  readonly description = 'Execute shell commands with tmux-backed streaming'
  readonly chatHandlers: ReadonlyArray<ChatHandlerDef> = []
  readonly slashCommands: ReadonlyArray<SlashCommandDef>

  constructor(sessionManager: SessionManager, streamManager: StreamManager) {
    this.slashCommands = createShellCommands(sessionManager, streamManager)
  }

  async initialize(_client: Client): Promise<void> {
    logger.info('ShellModule initialized')
  }

  async teardown(): Promise<void> {
    logger.info('ShellModule torn down')
  }
}
