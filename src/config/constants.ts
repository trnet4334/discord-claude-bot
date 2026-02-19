// Discord rate limits and timing constants
export const DISCORD = {
  MAX_MESSAGE_LENGTH: 2000,
  STREAM_CONTENT_LIMIT: 1800,
  MAX_EDITS_PER_SECOND: 4,
  BUTTON_TIMEOUT_LABEL: '⏱️ Confirmation timed out',
  ATTACHMENT_FILENAME: 'output.txt',
} as const

// tmux constants
export const TMUX = {
  HISTORY_LINES: 500,
  SESSION_TYPE_CLAUDE: 'claude',
  SESSION_TYPE_SHELL: 'shell',
  SESSION_TYPE_MONITOR: 'monitor',
} as const

// Emoji indicators for status messages
export const EMOJI = {
  RUNNING: '⏳',
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  TERMINAL: '💻',
  CLAUDE: '🤖',
  FILE: '📁',
  SYSTEM: '📊',
} as const

// Claude CLI flags
export const CLAUDE_CLI = {
  BINARY: 'claude',
  FLAGS: ['--dangerously-skip-permissions'],
} as const

// Dangerous shell command patterns
export const DANGEROUS_PATTERNS: readonly RegExp[] = [
  /\brm\s+-rf?\b/,
  /\brm\s+--recursive\b/,
  /\brmdir\b/,
  /\bdd\s+if=/,
  /\bmkfs\b/,
  /\bformat\b/,
  /\bshred\b/,
  /\bwipefs\b/,
  />\s*\/dev\/sd/,
  /\bdropdb\b/,
  /\bdrop\s+database\b/i,
  /\btruncate\s+table\b/i,
  /\bpkill\b/,
  /\bkillall\b/,
  /\bsudo\s+rm\b/,
  /\bchmod\s+777\b/,
  /\bchmod\s+-R\b/,
] as const
