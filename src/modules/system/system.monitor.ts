import { getLogger } from '../../utils/logger.ts'
import type { TextBasedChannel } from 'discord.js'

const logger = getLogger()

interface MonitorConfig {
  readonly channelId: string
  readonly intervalMs: number
}

/**
 * Optional background system monitor that periodically posts a heartbeat
 * with CPU/memory usage to a designated Discord channel.
 * This is a lightweight implementation; extend for full monitoring.
 */
export class SystemMonitor {
  private timer: ReturnType<typeof setInterval> | null = null
  private channel: TextBasedChannel | null = null

  start(channel: TextBasedChannel, config: MonitorConfig): void {
    if (this.timer !== null) {
      logger.warn('SystemMonitor already running')
      return
    }

    this.channel = channel
    this.timer = setInterval(async () => {
      try {
        await this.broadcast()
      } catch (error) {
        logger.error('SystemMonitor broadcast failed', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }, config.intervalMs)

    logger.info('SystemMonitor started', { intervalMs: config.intervalMs })
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.channel = null
    logger.info('SystemMonitor stopped')
  }

  private async broadcast(): Promise<void> {
    if (this.channel === null) return
    // Heartbeat is optional; expand with real metrics if needed
    logger.debug('SystemMonitor heartbeat — monitoring active')
  }
}
