import {
  SlashCommandBuilder,
  AttachmentBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'
import { getLogger } from '../utils/logger.ts'
import type { SlashCommandDef } from '../modules/module.interface.ts'
import type { BrowserService } from './browser.service.ts'

const logger = getLogger()

export function createBrowserCommands(browserService: BrowserService): ReadonlyArray<SlashCommandDef> {
  // Per-user single active session stored in memory
  const userSessions: Map<string, string> = new Map()

  function getOrThrow(userId: string): string {
    const sessionId = userSessions.get(userId)
    if (sessionId === undefined || !browserService.hasSession(sessionId)) {
      throw new Error('No active browser session. Use `/browser open <url>` first.')
    }
    return sessionId
  }

  async function sendScreenshot(
    interaction: ChatInputCommandInteraction,
    screenshot: Buffer,
    label: string,
  ): Promise<void> {
    const attachment = new AttachmentBuilder(screenshot, { name: 'screenshot.png' })
    await interaction.editReply({ content: label, files: [attachment] })
  }

  return [
    {
      name: 'browser',
      builder: new SlashCommandBuilder()
        .setName('browser')
        .setDescription('Control a headless browser')
        .addSubcommand((sub) =>
          sub
            .setName('open')
            .setDescription('Open a URL in the browser')
            .addStringOption((opt) =>
              opt.setName('url').setDescription('URL to navigate to').setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('click')
            .setDescription('Click an element by CSS selector')
            .addStringOption((opt) =>
              opt.setName('selector').setDescription('CSS selector').setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('type')
            .setDescription('Fill an input element with text')
            .addStringOption((opt) =>
              opt.setName('selector').setDescription('CSS selector for input').setRequired(true),
            )
            .addStringOption((opt) =>
              opt.setName('text').setDescription('Text to type').setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub.setName('screenshot').setDescription('Capture current screenshot'),
        )
        .addSubcommand((sub) =>
          sub.setName('close').setDescription('Close the current browser session'),
        ) as unknown as SlashCommandBuilder,

      async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const sub = interaction.options.getSubcommand(true)
        const userId = interaction.user.id
        await interaction.deferReply()

        try {
          if (sub === 'open') {
            const url = interaction.options.getString('url', true)
            // Create or reuse session
            const existing = userSessions.get(userId)
            const sessionId: string =
              existing !== undefined && browserService.hasSession(existing)
                ? existing
                : await browserService.createSession()
            userSessions.set(userId, sessionId)
            const shot = await browserService.navigate(sessionId, url)
            logger.info('Browser navigated', { sessionId, url })
            await sendScreenshot(interaction, shot, `🌐 Navigated to \`${url}\``)
          } else if (sub === 'click') {
            const selector = interaction.options.getString('selector', true)
            const sessionId = getOrThrow(userId)
            const shot = await browserService.click(sessionId, selector)
            logger.info('Browser click', { sessionId, selector })
            await sendScreenshot(interaction, shot, `🖱️ Clicked \`${selector}\``)
          } else if (sub === 'type') {
            const selector = interaction.options.getString('selector', true)
            const text = interaction.options.getString('text', true)
            const sessionId = getOrThrow(userId)
            const shot = await browserService.typeText(sessionId, selector, text)
            logger.info('Browser type', { sessionId, selector })
            await sendScreenshot(interaction, shot, `⌨️ Typed into \`${selector}\``)
          } else if (sub === 'screenshot') {
            const sessionId = getOrThrow(userId)
            const shot = await browserService.screenshot(sessionId)
            await sendScreenshot(interaction, shot, '📸 Current screenshot')
          } else if (sub === 'close') {
            const sessionId = userSessions.get(userId)
            if (sessionId !== undefined && browserService.hasSession(sessionId)) {
              await browserService.closeSession(sessionId)
              userSessions.delete(userId)
              await interaction.editReply('✅ Browser session closed.')
            } else {
              await interaction.editReply('ℹ️ No active browser session.')
            }
          }
        } catch (error) {
          await interaction.editReply(
            `❌ ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      },
    },
  ] as const
}
