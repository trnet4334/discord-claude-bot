# Discord Claude Bot

A TypeScript/Bun Discord bot for remotely controlling your local machine — running Claude Code CLI, executing shell commands, managing files, and monitoring system health — all via Discord Slash Commands and natural-language messages.

## Features

- **Claude Code control** — start sessions, send messages, stream responses in real-time
- **Shell execution** — run commands with live tmux-backed streaming output
- **File management** — read, write, list, and delete files within a configurable work directory
- **System monitoring** — CPU, memory, disk, and process snapshots
- **Security** — single-owner access control, dangerous-command confirmation dialogs, path traversal protection
- **Session persistence** — tmux sessions survive bot restarts; automatic reconciliation on startup

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Discord | discord.js v14 |
| Database | bun:sqlite + Drizzle ORM |
| Validation | Zod |
| Sessions | tmux |
| Language | TypeScript (strict) |

## Setup

### 1. Prerequisites

- [Bun](https://bun.sh) v1.0+
- tmux installed (`brew install tmux`)
- Claude Code CLI installed and authenticated (`npm install -g @anthropic-ai/claude-code`)
- A Discord bot token (create at [discord.com/developers](https://discord.com/developers/applications))

### 2. Install

```bash
git clone <repo>
cd discord-claude-bot
bun install
```

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_APPLICATION_ID=your_app_id
DISCORD_GUILD_ID=your_server_id
ALLOWED_USER_ID=your_discord_user_id   # Only this user can control the bot

CLAUDE_WORK_DIR=/Users/yourname        # Directory for file operations and Claude
TMUX_PREFIX=discord-bot                # Prefix for all tmux session names
```

### 4. Deploy Slash Commands

Run once after setting up (or after adding new commands):

```bash
bun run deploy
```

### 5. Start

```bash
bun run start
# or for development with auto-reload:
bun run dev
```

## Commands

### `/claude`

| Subcommand | Description |
|-----------|-------------|
| `/claude start` | Start a new Claude Code session |
| `/claude send <message>` | Send a message to the active Claude session |
| `/claude stop` | Stop the active Claude session |
| `/claude status` | Show all Claude session statuses |
| `/claude attach` | Get the tmux attach command for a session |

### `/shell`

| Subcommand | Description |
|-----------|-------------|
| `/shell run <command>` | Execute a shell command with streaming output |
| `/shell run <command> persist:true` | Keep tmux session alive after completion |
| `/shell history [limit]` | Show recent command history |
| `/shell sessions` | List active shell tmux sessions |

### `/file`

| Subcommand | Description |
|-----------|-------------|
| `/file read <path>` | Read a file (uploads as attachment if large) |
| `/file write <path> <content>` | Write content to a file |
| `/file list [path]` | List files in a directory |
| `/file delete <path>` | Delete a file (requires confirmation) |

File paths are relative to `CLAUDE_WORK_DIR`. Path traversal attempts are blocked.

### `/system`

| Subcommand | Description |
|-----------|-------------|
| `/system status` | System overview (uptime, CPU count, vm_stat) |
| `/system ps [count]` | Top processes by CPU usage |
| `/system df` | Disk usage |
| `/system top` | CPU and memory snapshot |

## Architecture

```
Discord ──► AuthGuard ──► Router ──► Module Handler
                                         │
                          ┌──────────────┤
                          │              │
                    tmux Session     DB (SQLite)
                          │
                    TmuxPoller (1500ms)
                          │
                    DiscordStreamer
                    (debounced edits, rate-limit aware)
                          │
                    Discord Message (live updates)
```

### Module System

All features are implemented as `BotModule` instances:

```typescript
interface BotModule {
  readonly name: string
  readonly slashCommands: ReadonlyArray<SlashCommandDef>
  readonly chatHandlers: ReadonlyArray<ChatHandlerDef>
  initialize(client: Client): Promise<void>
  teardown(): Promise<void>
}
```

To add a new module: implement the interface and add it to the `modules` array in `src/main.ts`.

### Security Model

1. **Auth guard** — all interactions require `ALLOWED_USER_ID` match
2. **Dangerous command detection** — shell commands matched against `DANGEROUS_PATTERNS` regex list; requires Discord button confirmation
3. **Path traversal protection** — file paths resolved and checked against `CLAUDE_WORK_DIR`
4. **tmux session isolation** — Claude/Shell/Monitor each use separate sessions
5. **Env validation** — Zod schema rejects startup if any required variable is missing

### tmux Session Names

```
{TMUX_PREFIX}-claude-{nanoid6}   # Long-running Claude Code sessions
{TMUX_PREFIX}-shell-{nanoid6}    # Short shell commands (or persistent)
{TMUX_PREFIX}-monitor            # System monitoring (singleton)
```

## Development

```bash
# Run tests
bun test

# Type check
bun run typecheck

# Watch mode
bun run dev
```

## Project Structure

```
src/
├── main.ts                    # Entry point
├── config/                    # Env validation, constants
├── bot/                       # Discord client, registry, router, deployer
├── guards/                    # Auth + confirmation guards
├── tmux/                      # Adapter interface + implementation, session manager, poller
├── streaming/                 # Output formatter, Discord streamer, stream manager
├── modules/
│   ├── shell/                 # Shell command execution
│   ├── claude/                # Claude Code CLI integration
│   ├── files/                 # File management
│   └── system/                # System monitoring
├── db/                        # Drizzle schema, client, repositories
├── chat/                      # Natural-language router and intent detection
└── utils/                     # Logger, ANSI stripper, truncator, retry, process exec
```
