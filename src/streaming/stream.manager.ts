import type { TextBasedChannel } from 'discord.js'
import { nanoid } from 'nanoid'
import { getLogger } from '../utils/logger.ts'
import { streamRepo } from '../db/repositories/stream.repo.ts'
import { DiscordStreamer } from './discord.streamer.ts'
import type { TmuxPoller } from '../tmux/poller.ts'

const logger = getLogger()

export interface StreamHandle {
  readonly streamId: string
  readonly streamer: DiscordStreamer
  stop(): void
}

/**
 * Orchestrates tmux polling → Discord message streaming.
 * Creates a Discord message placeholder and wires it to a tmux poller.
 */
export class StreamManager {
  private readonly active = new Map<string, StreamHandle>()

  constructor(private readonly poller: TmuxPoller) {}

  /**
   * Starts streaming a tmux session's output to a Discord channel.
   */
  async createStream(
    channel: TextBasedChannel,
    sessionName: string,
    sessionDbId?: string,
  ): Promise<StreamHandle> {
    const streamId = nanoid(8)

    if (!channel.isSendable()) {
      throw new Error('Channel does not support sending messages')
    }
    const message = await channel.send('⏳ Starting…')

    const streamer = new DiscordStreamer(message, streamId)

    this.poller.start(streamId, sessionName, async (_newContent: string, fullContent: string) => {
      streamer.update(fullContent)
    })

    if (sessionDbId !== undefined) {
      await streamRepo
        .create({
          sessionId: sessionDbId,
          discordMessageId: message.id,
          discordChannelId: channel.id,
          startedAt: new Date(),
          isActive: true,
        })
        .catch((e) =>
          logger.warn('Failed to persist stream', {
            error: e instanceof Error ? e.message : String(e),
          }),
        )
    }

    const handle: StreamHandle = {
      streamId,
      streamer,
      stop: () => {
        this.poller.stop(streamId)
        this.active.delete(streamId)
        streamRepo.markInactive(streamId).catch(() => undefined)
      },
    }

    this.active.set(streamId, handle)
    logger.debug('Stream created', { streamId, sessionName })
    return handle
  }

  getStream(streamId: string): StreamHandle | undefined {
    return this.active.get(streamId)
  }

  stopAll(): void {
    for (const [id] of this.active) {
      this.active.get(id)?.stop()
    }
  }
}
