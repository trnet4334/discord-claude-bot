import { chromium, type Browser, type Page } from 'playwright'
import { nanoid } from 'nanoid'
import { getLogger } from '../utils/logger.ts'

const logger = getLogger()

export class BrowserService {
  private browser: Browser | null = null
  private readonly pages: Map<string, Page> = new Map()

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({ headless: true })
    logger.info('BrowserService initialized')
  }

  async teardown(): Promise<void> {
    for (const [id, page] of this.pages) {
      try {
        await page.close()
      } catch {
        // ignore errors during teardown
      }
      this.pages.delete(id)
    }
    if (this.browser !== null) {
      await this.browser.close()
      this.browser = null
    }
    logger.info('BrowserService torn down')
  }

  async createSession(): Promise<string> {
    if (this.browser === null) throw new Error('BrowserService not initialized')
    const page = await this.browser.newPage()
    const sessionId = nanoid(8)
    this.pages.set(sessionId, page)
    logger.debug('Browser session created', { sessionId })
    return sessionId
  }

  async closeSession(sessionId: string): Promise<void> {
    const page = this.pages.get(sessionId)
    if (page === undefined) throw new Error(`Browser session not found: ${sessionId}`)
    await page.close()
    this.pages.delete(sessionId)
    logger.debug('Browser session closed', { sessionId })
  }

  hasSession(sessionId: string): boolean {
    return this.pages.has(sessionId)
  }

  listSessions(): ReadonlyArray<string> {
    return Array.from(this.pages.keys())
  }

  async navigate(sessionId: string, url: string): Promise<Buffer> {
    const page = this.getPage(sessionId)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    return this.captureScreenshot(page)
  }

  async click(sessionId: string, selector: string): Promise<Buffer> {
    const page = this.getPage(sessionId)
    await page.click(selector, { timeout: 10_000 })
    return this.captureScreenshot(page)
  }

  async typeText(sessionId: string, selector: string, text: string): Promise<Buffer> {
    const page = this.getPage(sessionId)
    await page.fill(selector, text, { timeout: 10_000 })
    return this.captureScreenshot(page)
  }

  async screenshot(sessionId: string): Promise<Buffer> {
    const page = this.getPage(sessionId)
    return this.captureScreenshot(page)
  }

  private getPage(sessionId: string): Page {
    const page = this.pages.get(sessionId)
    if (page === undefined) throw new Error(`Browser session not found: ${sessionId}`)
    return page
  }

  private async captureScreenshot(page: Page): Promise<Buffer> {
    const bytes = await page.screenshot({ type: 'png', fullPage: false })
    return Buffer.from(bytes)
  }
}
