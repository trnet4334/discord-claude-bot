import type { Env } from '../config/env.ts'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class Logger {
  private readonly minLevel: number

  constructor(level: LogLevel = 'info') {
    this.minLevel = LEVELS[level]
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVELS[level] < this.minLevel) return

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta !== undefined ? { meta } : {}),
    }

    const line = JSON.stringify(entry)
    if (level === 'error' || level === 'warn') {
      process.stderr.write(line + '\n')
    } else {
      process.stdout.write(line + '\n')
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta)
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta)
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta)
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta)
  }
}

let _logger: Logger | null = null

export function initLogger(level: Env['LOG_LEVEL']): void {
  _logger = new Logger(level)
}

export function getLogger(): Logger {
  if (_logger === null) {
    _logger = new Logger('info')
  }
  return _logger
}
