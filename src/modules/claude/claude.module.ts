import type { Client } from 'discord.js'
import type { BotModule, SlashCommandDef, ChatHandlerDef } from '../module.interface.ts'
import type { SessionManager } from '../../tmux/session.manager.ts'
import type { StreamManager } from '../../streaming/stream.manager.ts'
import { createClaudeCommands } from './claude.commands.ts'
import { ClaudeSessionStore } from './claude.session.ts'
import { sessionRepo } from '../../db/repositories/session.repo.ts'
import { getLogger } from '../../utils/logger.ts'
import type { TmuxAdapter } from '../../tmux/adapter.ts'

const logger = getLogger()

export class ClaudeModule implements BotModule {
  readonly name = 'claude'
  readonly description = 'Manage Claude Code CLI sessions via tmux'
  readonly chatHandlers: ReadonlyArray<ChatHandlerDef> = []
  readonly slashCommands: ReadonlyArray<SlashCommandDef>
  readonly sessionStore = new ClaudeSessionStore()

  constructor(
    sessionManager: SessionManager,
    streamManager: StreamManager,
    private readonly adapter: TmuxAdapter,
  ) {
    this.slashCommands = createClaudeCommands(sessionManager, streamManager, this.sessionStore)
  }

  async initialize(_client: Client): Promise<void> {
    // Re-hydrate in-memory store from persisted claude sessions
    const aliveSessions = await sessionRepo.findAlive()
    const claudeSessions = aliveSessions.filter((s) => s.type === 'claude')

    for (const dbSession of claudeSessions) {
      const alive = await this.adapter.hasSession(dbSession.name)
      if (alive) {
        this.sessionStore.set(dbSession.id, {
          dbSession,
          status: 'ready',
          lastActivityAt: dbSession.lastSeenAt ?? new Date(),
          streamId: null,
        })
        logger.info('Re-hydrated Claude session', { id: dbSession.id })
      }
    }

    logger.info('ClaudeModule initialized', { rehydrated: claudeSessions.length })
  }

  async teardown(): Promise<void> {
    logger.info('ClaudeModule torn down')
  }
}
