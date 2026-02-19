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
 * Shows a Discord Button confirmation dialog for dangerous operations.
 * Returns true if the user confirmed, false if they cancelled or it timed out.
 */
export async function requireConfirmation(
  interaction: ChatInputCommandInteraction,
  prompt: string,
): Promise<boolean> {
  const confirmId = `confirm-${Date.now()}`
  const cancelId = `cancel-${Date.now()}`

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(confirmId)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(cancelId)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  )

  const reply = await interaction.reply({
    content: `⚠️ **Dangerous operation** — are you sure?\n\n${prompt}`,
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
      content: confirmed ? '✅ Confirmed — proceeding.' : '🚫 Cancelled.',
      components: [],
    })

    logger.info('Confirmation dialog resolved', { confirmed })
    return confirmed
  } catch {
    // Timeout
    await interaction
      .editReply({ content: DISCORD.BUTTON_TIMEOUT_LABEL, components: [] })
      .catch(() => undefined)
    logger.info('Confirmation dialog timed out')
    return false
  }
}
