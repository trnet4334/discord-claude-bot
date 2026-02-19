import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'
import { safeExec } from '../../utils/process.ts'
import { getLogger } from '../../utils/logger.ts'
import { codeBlock } from '../../utils/truncate.ts'
import type { SlashCommandDef } from '../module.interface.ts'

const logger = getLogger()

export function createSystemCommands(): ReadonlyArray<SlashCommandDef> {
  return [
    {
      name: 'system',
      builder: new SlashCommandBuilder()
        .setName('system')
        .setDescription('System monitoring and diagnostics')
        .addSubcommand((sub) =>
          sub.setName('status').setDescription('Show system overview (CPU, memory, disk)'),
        )
        .addSubcommand((sub) =>
          sub
            .setName('ps')
            .setDescription('List top processes by CPU usage')
            .addIntegerOption((opt) =>
              opt.setName('count').setDescription('Number of processes (default 10)').setMinValue(1).setMaxValue(30),
            ),
        )
        .addSubcommand((sub) =>
          sub.setName('df').setDescription('Show disk usage'),
        )
        .addSubcommand((sub) =>
          sub.setName('top').setDescription('Show CPU and memory snapshot'),
        ) as unknown as SlashCommandBuilder,

      async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const sub = interaction.options.getSubcommand(true)
        await interaction.deferReply()

        if (sub === 'status') await handleStatus(interaction)
        else if (sub === 'ps') await handlePs(interaction)
        else if (sub === 'df') await handleDf(interaction)
        else if (sub === 'top') await handleTop(interaction)
      },
    },
  ] as const
}

async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  const [uptimeResult, memResult, loadResult] = await Promise.all([
    safeExec('uptime'),
    safeExec('vm_stat | head -10'),
    safeExec('sysctl -n hw.ncpu'),
  ])

  const uptime = uptimeResult.stdout.trim()
  const mem = memResult.stdout.trim()
  const cpus = loadResult.stdout.trim()

  const output = [`Uptime: ${uptime}`, `CPUs: ${cpus}`, '', 'Memory (vm_stat):', mem].join('\n')

  await interaction.editReply(codeBlock(output, 'text'))
}

async function handlePs(interaction: ChatInputCommandInteraction): Promise<void> {
  const count = interaction.options.getInteger('count') ?? 10
  const result = await safeExec(`ps aux | sort -nrk 3 | head -n ${count + 1}`)
  await interaction.editReply(codeBlock(result.stdout.trim(), 'text'))
}

async function handleDf(interaction: ChatInputCommandInteraction): Promise<void> {
  const result = await safeExec('df -h')
  await interaction.editReply(codeBlock(result.stdout.trim(), 'text'))
}

async function handleTop(interaction: ChatInputCommandInteraction): Promise<void> {
  // macOS: get a single sample from top
  const result = await safeExec('top -l 1 -n 10 -s 1')
  const lines = result.stdout.trim().split('\n').slice(0, 15)
  await interaction.editReply(codeBlock(lines.join('\n'), 'text'))
}

logger.debug('System commands module initialised')
