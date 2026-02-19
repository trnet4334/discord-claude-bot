import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextBasedChannel,
} from 'discord.js'
import { getLogger } from '../../utils/logger.ts'
import { safeExec } from '../../utils/process.ts'
import { commandRepo } from '../../db/repositories/command.repo.ts'
import { requireConfirmation } from '../../guards/confirmation.guard.ts'
import { checkDangerous } from './shell.dangerous.ts'
import { formatOutput } from '../../streaming/output.formatter.ts'
import { codeBlock } from '../../utils/truncate.ts'
import type { SlashCommandDef } from '../module.interface.ts'
import type { StreamManager } from '../../streaming/stream.manager.ts'
import type { SessionManager } from '../../tmux/session.manager.ts'

const logger = getLogger()

export function createShellCommands(
  sessionManager: SessionManager,
  streamManager: StreamManager,
): ReadonlyArray<SlashCommandDef> {
  return [
    {
      name: 'shell',
      builder: new SlashCommandBuilder()
        .setName('shell')
        .setDescription('Shell command management')
        .addSubcommand((sub) =>
          sub
            .setName('run')
            .setDescription('Execute a shell command with streaming output')
            .addStringOption((opt) =>
              opt.setName('command').setDescription('Command to execute').setRequired(true),
            )
            .addBooleanOption((opt) =>
              opt.setName('persist').setDescription('Keep tmux session alive after completion'),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('history')
            .setDescription('Show recent command history')
            .addIntegerOption((opt) =>
              opt.setName('limit').setDescription('Number of entries (default 10)').setMinValue(1).setMaxValue(50),
            ),
        )
        .addSubcommand((sub) =>
          sub.setName('sessions').setDescription('List active shell tmux sessions'),
        ) as unknown as SlashCommandBuilder,

      async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const sub = interaction.options.getSubcommand(true)

        if (sub === 'run') {
          await handleShellRun(interaction, sessionManager, streamManager)
        } else if (sub === 'history') {
          await handleShellHistory(interaction)
        } else if (sub === 'sessions') {
          await handleShellSessions(interaction, sessionManager)
        }
      },
    },
  ] as const
}

async function handleShellRun(
  interaction: ChatInputCommandInteraction,
  sessionManager: SessionManager,
  streamManager: StreamManager,
): Promise<void> {
  const command = interaction.options.getString('command', true)
  const persist = interaction.options.getBoolean('persist') ?? false

  const dangerCheck = checkDangerous(command)

  if (dangerCheck.isDangerous) {
    const confirmed = await requireConfirmation(
      interaction,
      `**Command:** \`${command}\`\n**Matched pattern:** \`${dangerCheck.matchedPattern}\``,
    )
    if (!confirmed) return
  } else {
    await interaction.deferReply()
  }

  const startedAt = Date.now()

  if (persist) {
    // Long-running: use a persistent tmux session with streaming
    const session = await sessionManager.createSession('shell', command)
    const channel = interaction.channel as TextBasedChannel
    const handle = await streamManager.createStream(channel, session.name, session.id)

    await interaction.editReply(
      `💻 Running in tmux session \`${session.name}\`\nStream ID: \`${handle.streamId}\``,
    )
  } else {
    // Short-running: exec directly
    const result = await safeExec(command, 30_000)
    const output = result.stdout + result.stderr
    const formatted = formatOutput(output)

    await commandRepo.create({
      sessionId: null,
      command,
      output: output.slice(0, 4096),
      exitCode: result.exitCode,
      executedAt: new Date(startedAt),
      durationMs: Date.now() - startedAt,
      discordUserId: interaction.user.id,
      discordChannelId: interaction.channelId,
    })

    const status = result.exitCode === 0 ? '✅' : '❌'
    const reply = `${status} Exit code: \`${result.exitCode}\`\n${formatted.content}`
    await interaction.editReply(reply)
  }
}

async function handleShellHistory(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })
  const limit = interaction.options.getInteger('limit') ?? 10
  const history = await commandRepo.findRecent(limit)

  if (history.length === 0) {
    await interaction.editReply('No command history yet.')
    return
  }

  const lines = history.map((h, i) => {
    const status = h.exitCode === 0 ? '✅' : '❌'
    const ts = h.executedAt instanceof Date ? h.executedAt.toISOString().slice(0, 19) : String(h.executedAt)
    return `${i + 1}. ${status} \`${h.command}\` — ${ts}`
  })

  await interaction.editReply(codeBlock(lines.join('\n')))
}

async function handleShellSessions(
  interaction: ChatInputCommandInteraction,
  sessionManager: SessionManager,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })
  const sessions = await sessionManager.listAlive()
  const shellSessions = sessions.filter((s) => s.type === 'shell')

  if (shellSessions.length === 0) {
    await interaction.editReply('No active shell sessions.')
    return
  }

  const lines = shellSessions.map((s) => `• \`${s.name}\` (${s.id})`)
  await interaction.editReply(`**Active shell sessions:**\n${lines.join('\n')}`)
}

logger.debug('Shell commands module initialised')
