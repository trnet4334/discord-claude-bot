import { z } from 'zod'

const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_APPLICATION_ID: z.string().min(1, 'DISCORD_APPLICATION_ID is required'),
  DISCORD_GUILD_ID: z.string().min(1, 'DISCORD_GUILD_ID is required'),
  ALLOWED_USER_ID: z.string().min(1, 'ALLOWED_USER_ID is required'),
  DATABASE_PATH: z.string().default('./data/bot.db'),
  CLAUDE_WORK_DIR: z.string().default(process.env['HOME'] ?? '/tmp'),
  TMUX_PREFIX: z.string().default('discord-bot'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  STREAM_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1500),
  STREAM_EDIT_DEBOUNCE_MS: z.coerce.number().int().positive().default(500),
  DANGEROUS_CMD_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
})

export type Env = z.infer<typeof EnvSchema>

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Environment validation failed:\n${formatted}`)
  }
  return result.data
}

export const env: Env = parseEnv()
