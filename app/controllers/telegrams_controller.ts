import type { HttpContext } from '@adonisjs/core/http'
import puppeteer from 'puppeteer'
import axios from 'axios'
import User from '#models/user'

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`

// Shared browser instance management
let browserInstance: puppeteer.Browser | null = null

const getBrowser = async () => {
  if (!browserInstance || !browserInstance.isConnected()) {
    const launchOptions: puppeteer.LaunchOptions & { args: string[]; executablePath?: string } = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--disable-gpu',
        '--memory-pressure-off',
      ],
      protocolTimeout: 180000, // 3 minutes
    }

    if (process.env.NODE_ENV === 'production') {
      launchOptions.executablePath = '/usr/bin/chromium-browser'
    }

    browserInstance = await puppeteer.launch(launchOptions)
  }
  return browserInstance
}

const restartBrowser = async () => {
  if (browserInstance) {
    await browserInstance.close().catch(() => null)
  }
  browserInstance = null
  return getBrowser()
}

// Restart browser every hour to prevent memory leaks
setInterval(restartBrowser, 3600000)

export default class TelegramsController {
  public async webhook({ request, response }: HttpContext) {
    const update = request.all()

    if (!update.message) {
      return response.json({ status: 'ignored' })
    }

    const chatId = update.message.chat.id
    const text = update.message.text

    try {
      if (text === '/start') {
        await this.subscribeUser(update.message)
        await this.sendMessage(
          chatId,
          `✅ Du erhältst nun automatisch die aktuellen Lottozahlen:\n` +
            `• 6aus49: Mittwoch & Samstag um 19:30 Uhr\n` +
            `• Eurojackpot: Dienstag & Freitag um 20:30 Uhr`
        )
      } else if (text === '/end') {
        await this.unsubscribeUser(chatId)
        await this.sendMessage(chatId, '❌ Du erhältst keine Lottozahlen mehr.')
      } else if (text === '/time') {
        await this.sendMessage(
          chatId,
          `Aktuelle Serverzeit: ${new Date().toLocaleString('de-DE', {
            timeZone: 'Europe/Berlin',
          })}`
        )
      } else if (text === '/6aus49') {
        const result = await this.get6outOf49Numbers()
        await this.sendMessage(
          chatId,
          `Ziehungsdatum: ${result.drawDate}\n` +
            `6 aus 49 Lottozahlen: ${result.lottoNumbers.join(', ')}\n` +
            `Superzahl: ${result.additionalNumber}\n\n` +
            `Spiel 77: ${result.game77}\n` +
            `Super 6: ${result.super6}`
        )
      } else if (text === '/eurojackpot') {
        const result = await this.getEuroJackpotNumbers()
        await this.sendMessage(
          chatId,
          `Ziehungsdatum: ${result.ziehungsdatum}\n` +
            `EuroJackpot Gewinnzahlen: ${result.mainNumbers.join(', ')}\n` +
            `Eurozahlen: ${result.eurozahlen.join(', ')}`
        )
      }
    } catch (error) {
      console.error('Error handling message:', error)
      await this.sendMessage(
        chatId,
        '⚠️ Ein Fehler ist aufgetreten. Bitte versuche es später erneut.'
      )
    }

    return response.json({ status: 'ok' })
  }

  private async subscribeUser(message: any) {
    const user = await User.findBy('telegram_id', message.chat.id)

    if (user) {
      user.active = true
      await user.save()
    } else {
      await User.create({
        telegram_id: message.chat.id,
        first_name: message.chat.first_name,
        username: message.chat.username,
        active: true,
      })
    }
  }

  private async unsubscribeUser(chatId: number) {
    const user = await User.findBy('telegram_id', chatId)
    if (user) {
      user.active = false
      await user.save()
    }
  }

  private async sendMessage(chatId: number, text: string) {
    try {
      await axios.post(TELEGRAM_API, {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      })
    } catch (error) {
      console.error('Error sending Telegram message:', error)
    }
  }

  public async sendLottoResults() {
    try {
      const users = await User.query().where('active', true)
      if (users.length === 0) return

      const today = new Date().getDay()
      let message = ''

      if (today === 3 || today === 6) {
        // Wednesday or Saturday
        const result = await this.get6outOf49Numbers()
        message =
          `Ziehungsdatum: ${result.drawDate}\n` +
          `6 aus 49 Lottozahlen: ${result.lottoNumbers.join(', ')}\n` +
          `Superzahl: ${result.additionalNumber}\n\n` +
          `Spiel 77: ${result.game77}\n` +
          `Super 6: ${result.super6}`
      } else if (today === 2 || today === 5) {
        // Tuesday or Friday
        const result = await this.getEuroJackpotNumbers()
        message =
          `Ziehungsdatum: ${result.ziehungsdatum}\n` +
          `EuroJackpot Gewinnzahlen: ${result.mainNumbers.join(', ')}\n` +
          `Eurozahlen: ${result.eurozahlen.join(', ')}`
      }

      if (message) {
        for (const user of users) {
          await this.sendMessage(user.telegram_id, `📢 Die Lottozahlen:\n\n${message}`)
        }
      }
    } catch (error) {
      console.error('Error sending lotto results:', error)
    }
  }

  private async get6outOf49Numbers() {
    let page: puppeteer.Page | null = null
    try {
      const browser = await getBrowser()
      page = await browser.newPage()

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      )
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
      await page.setDefaultNavigationTimeout(90000)
      await page.setDefaultTimeout(90000)

      // Stealth measures
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false })
      })

      const url = 'https://www.lotto.de/lotto-6aus49/lottozahlen'
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })

      if (!response?.ok()) {
        throw new Error(`Failed to load page: ${response?.status()}`)
      }

      // Retry logic for selectors
      const retrySelector = async (selector: string, retries = 3, delay = 2000) => {
        for (let i = 0; i < retries; i++) {
          const element = await page?.$(selector)
          if (element) return element
          await new Promise((res) => setTimeout(res, delay))
        }
        throw new Error(`Selector not found: ${selector}`)
      }

      // Extract data
      const lottoNumbers = await page?.$$eval(
        '.DrawNumbersCollection__container:nth-child(1) .LottoBall__circle',
        (elements) => elements.map((el) => el.textContent?.trim() || '')
      )

      const additionalNumber = await retrySelector(
        '.DrawNumbersCollection__container:nth-child(2) .LottoBall__circle'
      ).then((el) => el.evaluate((e) => e.textContent?.trim() || ''))

      const game77 = await retrySelector(
        '.WinningNumbersAdditionalGame:nth-child(1) span:last-child'
      ).then((el) => el.evaluate((e) => e.textContent?.trim() || ''))

      const super6 = await retrySelector(
        '.WinningNumbersAdditionalGame:nth-child(2) span:last-child'
      ).then((el) => el.evaluate((e) => e.textContent?.trim() || ''))

      const drawDate = await retrySelector('.WinningNumbers__date').then((el) =>
        el.evaluate((e) => e.textContent?.trim() || '')
      )

      return { drawDate, lottoNumbers, additionalNumber, game77, super6 }
    } catch (error) {
      console.error('Error in get6outOf49Numbers:', error)
      await restartBrowser()
      throw error
    } finally {
      if (page && !page.isClosed()) {
        await page.close().catch(() => null)
      }
    }
  }

  private async getEuroJackpotNumbers() {
    let page: puppeteer.Page | null = null
    try {
      const browser = await getBrowser()
      page = await browser.newPage()

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      )
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
      await page.setDefaultNavigationTimeout(90000)
      await page.setDefaultTimeout(90000)

      // Stealth measures
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false })
      })

      const url = 'https://www.eurojackpot.de/'
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })

      if (!response?.ok()) {
        throw new Error(`Failed to load page: ${response?.status()}`)
      }

      // Retry logic
      const retrySelector = async (selector: string, retries = 3, delay = 2000) => {
        for (let i = 0; i < retries; i++) {
          const element = await page?.$(selector)
          if (element) return element
          await new Promise((res) => setTimeout(res, delay))
        }
        throw new Error(`Selector not found: ${selector}`)
      }

      // Extract data
      const ziehungsdatum = await retrySelector('select[formcontrolname="datum"] option').then(
        (el) => el.evaluate((e) => e.textContent?.trim() || '')
      )

      const mainNumbers = await page.$$eval('.winning-number', (elements) =>
        elements.slice(0, 5).map((el) => el.textContent?.trim() || '')
      )

      const eurozahlen = await page.$$eval('.winning-number', (elements) =>
        elements.slice(5, 7).map((el) => el.textContent?.trim() || '')
      )

      return { ziehungsdatum, mainNumbers, eurozahlen }
    } catch (error) {
      console.error('Error in getEuroJackpotNumbers:', error)
      await restartBrowser()
      throw error
    } finally {
      if (page && !page.isClosed()) {
        await page.close().catch(() => null)
      }
    }
  }
}
