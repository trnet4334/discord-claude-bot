import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
} from 'discord.js'
import { env } from '../config/env.ts'
import { getLogger } from '../utils/logger.ts'
import { DISCORD } from '../config/constants.ts'

const logger = getLogger()

/**
 * write   — blue Primary button, 📝 header (file writes, all shell runs)
 * dangerous — red Danger button, ⚠️ header (file delete, dangerous shell patterns)
 */
export type ConfirmationSeverity = 'write' | 'dangerous'

const SEVERITY_CONFIG = {
  write: {
    header: '📝 **Confirm write operation**',
    confirmLabel: 'Proceed',
    confirmStyle: ButtonStyle.Primary,
  },
  dangerous: {
    header: '⚠️ **Dangerous operation** — are you sure?',
    confirmLabel: 'Confirm',
    confirmStyle: ButtonStyle.Danger,
  },
} as const

/**
 * Shows a Discord Button confirmation dialog.
 * Returns true if the user confirmed, false if cancelled or timed out.
 *
 * @param severity 'write' for write-level ops, 'dangerous' for destructive ops
 */
export async function requireConfirmation(
  interaction: ChatInputCommandInteraction,
  prompt: string,
  severity: ConfirmationSeverity = 'dangerous',
): Promise<boolean> {
  const ts = Date.now()
  const confirmId = `confirm-${ts}`
  const cancelId = `cancel-${ts}`
  const cfg = SEVERITY_CONFIG[severity]

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(confirmId)
      .setLabel(cfg.confirmLabel)
      .setStyle(cfg.confirmStyle),
    new ButtonBuilder()
      .setCustomId(cancelId)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  )

  const reply = await interaction.reply({
    content: `${cfg.header}\n\n${prompt}`,
    components: [row],
    ephemeral: true,
  })

  try {
    const component = await reply.awaitMessageComponent({
      filter: (i: MessageComponentInteraction) =>
        (i.customId === confirmId || i.customId === cancelId) &&
        i.user.id === interaction.user.id,
      time: env.DANGEROUS_CMD_TIMEOUT_MS,
    })

    const confirmed = component.customId === confirmId
    await component.update({
      content: confirmed ? '✅ Proceeding.' : '🚫 Cancelled.',
      components: [],
    })

    logger.info('Confirmation dialog resolved', { severity, confirmed })
    return confirmed
  } catch {
    // Timeout
    await interaction
      .editReply({ content: DISCORD.BUTTON_TIMEOUT_LABEL, components: [] })
      .catch(() => undefined)
    logger.info('Confirmation dialog timed out', { severity })
    return false
  }
}
