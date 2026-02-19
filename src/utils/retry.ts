import { getLogger } from './logger.ts'

interface RetryOptions {
  readonly maxAttempts: number
  readonly initialDelayMs: number
  readonly maxDelayMs: number
  readonly backoffFactor: number
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffFactor: 2,
}

/**
 * Retries an async operation with exponential backoff.
 * Specifically handles Discord API rate limit (429) responses.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const logger = getLogger()
  let delay = opts.initialDelayMs

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const isRateLimit =
        error instanceof Error && error.message.toLowerCase().includes('rate limit')

      if (attempt === opts.maxAttempts) {
        throw error
      }

      const waitMs = isRateLimit ? Math.min(delay * 2, opts.maxDelayMs) : delay
      logger.warn(`Retry attempt ${attempt} failed, waiting ${waitMs}ms`, {
        error: error instanceof Error ? error.message : String(error),
      })

      await Bun.sleep(waitMs)
      delay = Math.min(delay * opts.backoffFactor, opts.maxDelayMs)
    }
  }

  throw new Error('Retry exhausted — unreachable')
}
