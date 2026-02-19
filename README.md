# Discord Claude Bot

A TypeScript/Bun Discord bot for remotely controlling your local machine — running Claude Code CLI, executing shell commands, managing files, and monitoring system health — all via Discord Slash Commands and natural-language messages.

## Features

- **Claude Code control** — start sessions, send messages, stream responses in real-time via tmux
- **Shell execution** — run commands with live streaming output (tmux-backed)
- **File management** — read, write, list, and delete files within a configurable work directory
- **System monitoring** — CPU, memory, disk, and process snapshots (macOS)
- **Three-tier permission model** — read ops run immediately; write ops require a blue confirmation button; destructive ops require a red warning confirmation
- **Session persistence** — tmux sessions survive bot restarts; automatic reconciliation on startup
- **Single-owner access control** — all interactions gated by a configured Discord User ID

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Discord | discord.js v14 |
| Database | bun:sqlite + Drizzle ORM |
| Validation | Zod |
| Sessions | tmux |
| Language | TypeScript (strict) |

## Setup

### 1. Prerequisites

- [Bun](https://bun.sh) — `curl -fsSL https://bun.sh/install | bash`
- tmux — `brew install tmux`
- Claude Code CLI — `npm install -g @anthropic-ai/claude-code` (authenticated)
- A Discord bot with **Message Content Intent** enabled ([discord.com/developers](https://discord.com/developers/applications))

### 2. Install

```bash
git clone https://github.com/trnet4334/discord-claude-bot.git
cd discord-claude-bot
bun install
```

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Where to find it |
|----------|-----------------|
| `DISCORD_TOKEN` | Developer Portal → Your App → Bot → Token |
| `DISCORD_APPLICATION_ID` | Developer Portal → General Information → Application ID |
| `DISCORD_GUILD_ID` | Discord → Right-click your server → Copy Server ID (requires Developer Mode) |
| `ALLOWED_USER_ID` | Discord → Right-click your username → Copy User ID |
| `CLAUDE_WORK_DIR` | Absolute path to your working directory (defaults to `$HOME`) |

### 4. Deploy Slash Commands

Run once to register commands with your guild:

```bash
bun run deploy
```

### 5. Start

```bash
# Production
bun run start

# Development (auto-restart on file changes)
bun run dev
```

A successful startup looks like:
```json
{"message":"Discord client ready","meta":{"username":"YourBot#1234"}}
{"message":"Module loaded","meta":{"name":"shell"}}
{"message":"Module loaded","meta":{"name":"claude"}}
{"message":"Module loaded","meta":{"name":"files"}}
{"message":"Module loaded","meta":{"name":"system"}}
{"message":"Slash commands deployed successfully"}
```

---

## Commands

### `/claude` — Claude Code Sessions

| Subcommand | Description |
|-----------|-------------|
| `/claude start` | Start a new Claude Code tmux session |
| `/claude send <message>` | Send a message to the most-recently-active session |
| `/claude stop [id]` | Stop a Claude session |
| `/claude status` | List all sessions with status and last-activity time |
| `/claude attach [id]` | Get the `tmux attach` command to join locally |

### `/shell` — Shell Execution

| Subcommand | Description |
|-----------|-------------|
| `/shell run <command>` | Execute a command (write confirmation required) |
| `/shell run <command> persist:true` | Run in a persistent tmux session with streaming |
| `/shell history [limit]` | Show recent command history |
| `/shell sessions` | List active shell tmux sessions |

### `/file` — File Management

All paths are relative to `CLAUDE_WORK_DIR`. Path traversal attempts are blocked.

| Subcommand | Description |
|-----------|-------------|
| `/file read <path>` | Read a file; large files are uploaded as attachments |
| `/file write <path> <content>` | Write to a file (write confirmation + preview required) |
| `/file list [path]` | List directory contents |
| `/file delete <path>` | Delete a file (destructive confirmation required) |

### `/system` — System Info (macOS)

| Subcommand | Description |
|-----------|-------------|
| `/system status` | Uptime, CPU count, memory (vm_stat) |
| `/system ps [count]` | Top processes by CPU |
| `/system df` | Disk usage |
| `/system top` | CPU and memory snapshot |

---

## Permission Model

Every operation falls into one of three tiers:

| Tier | Operations | Dialog |
|------|-----------|--------|
| **Read** | `system *`, `file read`, `file list`, `shell history`, `claude status` | None — executes immediately |
| **Write** | `shell run` (safe commands), `file write` | 📝 Blue **Proceed** button |
| **Destructive** | `shell run` (dangerous patterns), `file delete` | ⚠️ Red **Confirm** button |

Dangerous shell patterns (rm -rf, dd, mkfs, drop database, etc.) are detected by regex and automatically escalated to the destructive tier regardless of intent.

---

## Architecture

```
Discord ──► AuthGuard (User ID check)
               │
               ▼
           BotRouter ──► SlashCommandHandler / ChatHandler
                               │
               ┌───────────────┤
               │               │
         ConfirmationGuard   DB (SQLite / Drizzle)
         (write / dangerous)   │
               │           SessionRepo / CommandRepo
               ▼
          TmuxAdapter
          SessionManager ──► reconcile on startup
               │
          TmuxPoller (1500ms capture-pane)
               │
          DiscordStreamer (debounced edits, rate-limit aware)
               │
          Discord Message (live updates)
```

### Module System

All features are `BotModule` instances wired in `src/main.ts`. To add a module:

```typescript
interface BotModule {
  readonly name: string
  readonly slashCommands: ReadonlyArray<SlashCommandDef>
  readonly chatHandlers: ReadonlyArray<ChatHandlerDef>
  initialize(client: Client): Promise<void>
  teardown(): Promise<void>
}
```

Implement the interface, instantiate in `main.ts`, add to the `modules` array — done.

### tmux Session Names

```
{TMUX_PREFIX}-claude-{nanoid6}   # Long-running Claude Code sessions
{TMUX_PREFIX}-shell-{nanoid6}    # Shell commands (transient or persistent)
{TMUX_PREFIX}-monitor            # System monitoring (singleton)
```

### Streaming Pipeline

```
tmux pane output
  └─► capture-pane every 1500ms
      └─► diff new lines
          └─► stripAnsi → truncate to 1800 chars
              └─► debounce 500ms
                  └─► discord.message.edit() (max 4/sec)
```

---

## Development

```bash
bun test          # Run unit tests (27 tests)
bun run typecheck # tsc --noEmit strict check
bun run dev       # Watch mode
```

## Project Structure

```
src/
├── main.ts                      # Entry point — wires all layers, handles shutdown
├── config/
│   ├── env.ts                   # Zod-validated env schema
│   └── constants.ts             # Discord limits, tmux names, dangerous patterns
├── bot/
│   ├── client.ts                # discord.js Client factory
│   ├── registry.ts              # Module/command registration
│   ├── deployer.ts              # Guild slash command deployment
│   └── router.ts                # Interaction + message routing
├── guards/
│   ├── auth.guard.ts            # Single-owner User ID enforcement
│   └── confirmation.guard.ts   # Write / dangerous confirmation dialogs
├── tmux/
│   ├── adapter.ts               # TmuxAdapter interface
│   ├── tmux.adapter.ts          # Concrete implementation
│   ├── session.manager.ts       # Session lifecycle + DB reconciliation
│   └── poller.ts                # capture-pane polling + diff
├── streaming/
│   ├── output.formatter.ts      # ANSI strip, truncate, code-block wrap
│   ├── discord.streamer.ts      # Throttled rate-limit-aware message edits
│   └── stream.manager.ts        # Orchestrates poller → Discord message
├── modules/
│   ├── module.interface.ts      # BotModule contract
│   ├── module.loader.ts         # Safe module registration + teardown
│   ├── shell/                   # /shell commands
│   ├── claude/                  # /claude commands + hook bridge
│   ├── files/                   # /file commands
│   └── system/                  # /system commands
├── db/
│   ├── schema.ts                # Drizzle table definitions
│   ├── client.ts                # bun:sqlite singleton + inline migrations
│   └── repositories/            # session / command / stream repos
├── chat/                        # Natural-language intent routing
└── utils/                       # logger, ansi, truncate, retry, process exec
tests/
└── unit/                        # 27 unit tests across guards, streaming, tmux, utils
```
