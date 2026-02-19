import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextBasedChannel,
} from 'discord.js'
import { getLogger } from '../../utils/logger.ts'
import { writeCaudeHooks } from './claude.hooks.ts'
import { codeBlock } from '../../utils/truncate.ts'
import type { SlashCommandDef } from '../module.interface.ts'
import type { SessionManager } from '../../tmux/session.manager.ts'
import type { StreamManager } from '../../streaming/stream.manager.ts'
import type { ClaudeSessionStore } from './claude.session.ts'
import { CLAUDE_CLI, EMOJI } from '../../config/constants.ts'

const logger = getLogger()

export function createClaudeCommands(
  sessionManager: SessionManager,
  streamManager: StreamManager,
  store: ClaudeSessionStore,
): ReadonlyArray<SlashCommandDef> {
  return [
    {
      name: 'claude',
      builder: new SlashCommandBuilder()
        .setName('claude')
        .setDescription('Manage Claude Code sessions')
        .addSubcommand((sub) =>
          sub.setName('start').setDescription('Start a new Claude Code session'),
        )
        .addSubcommand((sub) =>
          sub
            .setName('send')
            .setDescription('Send a message to the active Claude session')
            .addStringOption((opt) =>
              opt.setName('message').setDescription('Message to send').setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub.setName('stop').setDescription('Stop the active Claude session'),
        )
        .addSubcommand((sub) =>
          sub.setName('status').setDescription('Show all Claude session statuses'),
        )
        .addSubcommand((sub) =>
          sub
            .setName('attach')
            .setDescription('Get the tmux attach command for a session')
            .addStringOption((opt) =>
              opt.setName('id').setDescription('Session database ID (from /claude status)'),
            ),
        ) as unknown as SlashCommandBuilder,

      async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const sub = interaction.options.getSubcommand(true)

        if (sub === 'start') await handleStart(interaction, sessionManager, streamManager, store)
        else if (sub === 'send') await handleSend(interaction, sessionManager, streamManager, store)
        else if (sub === 'stop') await handleStop(interaction, sessionManager, store)
        else if (sub === 'status') await handleStatus(interaction, store)
        else if (sub === 'attach') await handleAttach(interaction, store)
      },
    },
  ] as const
}

async function handleStart(
  interaction: ChatInputCommandInteraction,
  sessionManager: SessionManager,
  streamManager: StreamManager,
  store: ClaudeSessionStore,
): Promise<void> {
  await interaction.deferReply()

  await writeCaudeHooks().catch((e) =>
    logger.warn('Failed to write Claude hooks', { error: e instanceof Error ? e.message : String(e) }),
  )

  const claudeCmd = `${CLAUDE_CLI.BINARY} ${CLAUDE_CLI.FLAGS.join(' ')}`
  const dbSession = await sessionManager.createSession('claude', claudeCmd, {
    startedBy: interaction.user.id,
  })

  store.set(dbSession.id, {
    dbSession,
    status: 'starting',
    lastActivityAt: new Date(),
    streamId: null,
  })

  const channel = interaction.channel as TextBasedChannel
  const handle = await streamManager.createStream(channel, dbSession.name, dbSession.id)

  store.update(dbSession.id, { status: 'ready', streamId: handle.streamId })

  await interaction.editReply(
    `${EMOJI.CLAUDE} Claude Code session started!\n` +
      `Session ID: \`${dbSession.id}\`\n` +
      `tmux: \`tmux attach -t ${dbSession.name}\``,
  )

  logger.info('Claude session started', { sessionId: dbSession.id })
}

async function handleSend(
  interaction: ChatInputCommandInteraction,
  sessionManager: SessionManager,
  streamManager: StreamManager,
  store: ClaudeSessionStore,
): Promise<void> {
  await interaction.deferReply()

  const message = interaction.options.getString('message', true)
  const sessions = store.getAll().filter((s) => s.status !== 'dead')

  if (sessions.length === 0) {
    await interaction.editReply('❌ No active Claude session. Use `/claude start` first.')
    return
  }

  // Use the most recently active session
  const sessionState = sessions.sort(
    (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime(),
  )[0]

  if (sessionState === undefined) {
    await interaction.editReply('❌ No active Claude session.')
    return
  }

  await sessionManager.sendKeys(sessionState.dbSession.id, message)
  store.update(sessionState.dbSession.id, { status: 'busy', lastActivityAt: new Date() })

  // Create a new stream for this message's response
  const channel = interaction.channel as TextBasedChannel
  const handle = await streamManager.createStream(
    channel,
    sessionState.dbSession.name,
    sessionState.dbSession.id,
  )
  store.update(sessionState.dbSession.id, { streamId: handle.streamId })

  await interaction.editReply(`${EMOJI.RUNNING} Sent to Claude. Streaming response below…`)
}

async function handleStop(
  interaction: ChatInputCommandInteraction,
  sessionManager: SessionManager,
  store: ClaudeSessionStore,
): Promise<void> {
  await interaction.deferReply()

  const sessionId = interaction.options.getString('id') ?? null
  const sessions = store.getAll().filter((s) => s.status !== 'dead')

  if (sessions.length === 0) {
    await interaction.editReply('No active Claude sessions.')
    return
  }

  const target =
    sessionId !== null
      ? sessions.find((s) => s.dbSession.id === sessionId)
      : sessions[0]

  if (target === undefined) {
    await interaction.editReply(`❌ Session \`${sessionId}\` not found.`)
    return
  }

  await sessionManager.killSession(target.dbSession.id)
  store.update(target.dbSession.id, { status: 'dead' })

  await interaction.editReply(`✅ Claude session \`${target.dbSession.id}\` stopped.`)
}

async function handleStatus(
  interaction: ChatInputCommandInteraction,
  store: ClaudeSessionStore,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const sessions = store.getAll()
  if (sessions.length === 0) {
    await interaction.editReply('No Claude sessions in memory. Use `/claude start`.')
    return
  }

  const lines = sessions.map((s) => {
    const age = Math.round((Date.now() - s.lastActivityAt.getTime()) / 1000)
    return `• \`${s.dbSession.id}\` — ${s.status} — last active ${age}s ago — tmux: \`${s.dbSession.name}\``
  })

  await interaction.editReply(`**Claude Sessions:**\n${codeBlock(lines.join('\n'))}`)
}

async function handleAttach(
  interaction: ChatInputCommandInteraction,
  store: ClaudeSessionStore,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const sessionId = interaction.options.getString('id')
  const sessions = store.getAll()

  const target =
    sessionId !== null
      ? sessions.find((s) => s.dbSession.id === sessionId)
      : sessions.filter((s) => s.status !== 'dead')[0]

  if (target === undefined) {
    await interaction.editReply('❌ No session found.')
    return
  }

  await interaction.editReply(
    `Run this on your local machine:\n\`\`\`\ntmux attach -t ${target.dbSession.name}\n\`\`\``,
  )
}

logger.debug('Claude commands module initialised')
