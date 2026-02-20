import type { Client } from 'discord.js'
import type { BotModule, SlashCommandDef, ChatHandlerDef } from '../modules/module.interface.ts'
import { createBrowserCommands } from './browser.commands.ts'
import { BrowserService } from './browser.service.ts'
import { getLogger } from '../utils/logger.ts'

const logger = getLogger()

export class BrowserModule implements BotModule {
  readonly name = 'browser'
  readonly description = 'Headless browser automation with screenshot return'
  readonly chatHandlers: ReadonlyArray<ChatHandlerDef> = []
  readonly slashCommands: ReadonlyArray<SlashCommandDef>

  private readonly browserService: BrowserService

  constructor() {
    this.browserService = new BrowserService()
    this.slashCommands = createBrowserCommands(this.browserService)
  }

  async initialize(_client: Client): Promise<void> {
    await this.browserService.initialize()
    logger.info('BrowserModule initialized')
  }

  async teardown(): Promise<void> {
    await this.browserService.teardown()
    logger.info('BrowserModule torn down')
  }
}
