# Discord Claude Bot

A TypeScript/Bun bot for remotely controlling your local machine — running Claude Code CLI, executing shell commands, managing files, monitoring system health, and automating a headless browser — via **Discord Slash Commands**, **Telegram commands**, and natural-language messages.

## Features

- **Claude Code control** — start sessions, send messages, stream responses in real-time via tmux
- **Shell execution** — run commands with live streaming output (tmux-backed)
- **File management** — read, write, list, and delete files within a configurable work directory
- **System monitoring** — CPU, memory, disk, and process snapshots (macOS)
- **Browser automation** — open URLs, click elements, type text, capture screenshots (Playwright headless)
- **Telegram interface** — full command parity with Discord via Telegram bot (optional)
- **Three-tier permission model** — read ops run immediately; write ops require confirmation; destructive ops require a second warning
- **Session persistence** — tmux sessions survive bot restarts; automatic reconciliation on startup
- **Single-owner access control** — all interactions gated by your configured Discord User ID / Telegram Chat ID

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Discord | discord.js v14 |
| Telegram | Telegraf v4 |
| Browser | Playwright (Chromium headless) |
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
- *(Optional)* A Telegram bot token from [@BotFather](https://t.me/BotFather)

### 2. Install

```bash
git clone https://github.com/trnet4334/discord-claude-bot.git
cd discord-claude-bot
bun install
bunx playwright install chromium   # for browser automation
```

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Required | Where to find it |
|----------|----------|-----------------|
| `DISCORD_TOKEN` | Yes | Developer Portal → Your App → Bot → Token |
| `DISCORD_APPLICATION_ID` | Yes | Developer Portal → General Information → Application ID |
| `DISCORD_GUILD_ID` | Yes | Discord → Right-click your server → Copy Server ID |
| `ALLOWED_USER_ID` | Yes | Discord → Right-click your username → Copy User ID |
| `CLAUDE_WORK_DIR` | No | Absolute path to working directory (defaults to `$HOME`) |
| `TELEGRAM_BOT_TOKEN` | No | @BotFather → /newbot → token |
| `TELEGRAM_ALLOWED_CHAT_ID` | No | Your Telegram user/chat ID (bot ignores all others) |

### 4. Deploy Slash Commands

Run once to register Discord slash commands with your guild:

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
{"message":"Module loaded","meta":{"name":"browser"}}
{"message":"Slash commands deployed successfully"}
{"message":"Telegram bot started (long-polling)"}
```

---

## Discord Commands

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

### `/browser` — Browser Automation

Each subcommand returns a screenshot of the current browser state.

| Subcommand | Description |
|-----------|-------------|
| `/browser open <url>` | Navigate to a URL |
| `/browser click <selector>` | Click a CSS selector |
| `/browser type <selector> <text>` | Fill an input field |
| `/browser screenshot` | Capture current state |
| `/browser close` | Close the browser session |

---

## Telegram Commands

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_CHAT_ID` in `.env` to enable. The Telegram bot shares the same tmux sessions and database as Discord.

Send `/start` to see the full command list. Key commands:

| Command | Description |
|---------|-------------|
| `/shell <cmd>` | Run a shell command (inline keyboard confirmation) |
| `/shell_history [limit]` | Recent command history |
| `/claude_start` | Start a Claude Code session |
| `/claude_send <message>` | Send to active Claude session |
| `/claude_stop` | Stop active session |
| `/claude_status` | List sessions |
| `/claude_attach` | Get `tmux attach` command |
| `/file_read <path>` | Read a file |
| `/file_write <path> <content>` | Write a file (confirmation required) |
| `/file_list [path]` | List directory |
| `/file_delete <path>` | Delete a file (destructive confirmation) |
| `/system_status` | System overview |
| `/system_ps [count]` | Top processes |
| `/system_df` | Disk usage |
| `/system_top` | CPU snapshot |
| `/browser_open <url>` | Open URL, returns screenshot |
| `/browser_click <selector>` | Click element, returns screenshot |
| `/browser_type <selector> <text>` | Fill input, returns screenshot |
| `/browser_shot` | Current screenshot |
| `/browser_close` | Close browser session |

---

## Permission Model

Every operation falls into one of three tiers:

| Tier | Operations | Confirmation |
|------|-----------|--------------|
| **Read** | `system *`, `file read`, `file list`, `shell history`, `claude status` | None — executes immediately |
| **Write** | `shell run` (safe commands), `file write`, `file write` via Telegram | Discord: 📝 Blue button · Telegram: ✅ inline keyboard |
| **Destructive** | `shell run` (dangerous patterns), `file delete` | Discord: ⚠️ Red button · Telegram: ⚠️ inline keyboard |

Dangerous shell patterns (`rm -rf`, `dd`, `mkfs`, `DROP DATABASE`, etc.) are detected by regex and automatically escalated to the destructive tier.

---

## Architecture

```
Discord ──► AuthGuard (User ID check)          Telegram ──► TelegramAuth (Chat ID check)
               │                                                │
               ▼                                                ▼
           BotRouter ──► SlashCommandHandler         TelegramBot (Telegraf)
                               │                               │
               ┌───────────────┴───────────────────────────────┘
               │
         ConfirmationGuard ──── DB (SQLite / Drizzle)
         (write / dangerous)         │
               │               SessionRepo / CommandRepo / BrowserRepo
               ▼
          TmuxAdapter
          SessionManager ──► reconcile on startup
               │
          TmuxPoller (1500ms capture-pane)
               │
          DiscordStreamer (debounced edits, rate-limit aware)
          TelegramStreamer (1200ms debounce, editMessageText)
               │
          Live message updates (Discord edit / Telegram edit)

          BrowserService (Playwright chromium)
               │
          Screenshots returned as Buffer → Discord attachment / Telegram photo
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
              └─► debounce 500ms (Discord) / 1200ms (Telegram)
                  └─► message.edit() — rate-limit aware
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
├── browser/
│   ├── browser.service.ts       # Playwright chromium, per-session Page map
│   ├── browser.module.ts        # BotModule wrapping BrowserService
│   ├── browser.commands.ts      # /browser slash commands → screenshot attachment
│   └── browser.session.ts       # In-memory session store
├── telegram/
│   ├── telegram.bot.ts          # Telegraf factory — all commands wired
│   ├── telegram.auth.ts         # Chat ID enforcement
│   ├── telegram.confirm.ts      # Inline keyboard confirmation
│   ├── telegram.streamer.ts     # Debounced editMessageText
│   └── handlers/                # shell / claude / files / system / browser
├── db/
│   ├── schema.ts                # Drizzle table definitions
│   ├── client.ts                # bun:sqlite singleton + inline migrations
│   └── repositories/            # session / command / stream / browser repos
├── chat/                        # Natural-language intent routing
└── utils/                       # logger, ansi, truncate, retry, process exec
tests/
└── unit/                        # 27 unit tests across guards, streaming, tmux, utils
```
