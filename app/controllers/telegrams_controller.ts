import type { HttpContext } from '@adonisjs/core/http'
import puppeteer from 'puppeteer'
import axios from 'axios'
import User from '#models/user'

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`
export default class TelegramsController {
  // webhook method to handle incoming Telegram messages
  public async webhook({ request, response }: HttpContext) {
    const update = request.all()

    if (!update.message) {
      return response.json({ status: 'ignored' })
    }

    const chatId = update.message.chat.id
    const text = update.message.text

    if (text === '/start') {
      await this.subscribeUser(update.message)
      await this.sendMessage(
        chatId,
        `✅ Du erhältst nun automatisch die aktuellen Lottozahlen:
        •	6aus49: Mittwoch & Samstag um 19:30 Uhr
        •	Eurojackpot: Dienstag & Freitag um 20:30 Uhr`
      )
    } else if (text === '/end') {
      await this.unsubscribeUser(chatId)
      await this.sendMessage(chatId, '❌ Du erhältst keine Lottozahlen mehr.')
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
    await axios.post(TELEGRAM_API, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    })
  }

  public async sendLottoResults() {
    const users = await User.query().where('active', true)
    if (users.length === 0) return

    const today = new Date().getDay() // Holt den aktuellen Wochentag (0 = Sonntag, 1 = Montag, ...)

    let message = ''

    if (today === 3 || today === 6) {
      // Mittwoch (3) oder Samstag (6)
      const result = await this.get6outOf49Numbers()
      message = `Ziehungsdatum: ${result.drawDate}\nLottozahlen: ${result.lottoNumbers.join(', ')}\nZusatznummer: ${result.additionalNumber}\nSpiel 77: ${result.game77}\nSuper 6: ${result.super6}`
    } else if (today === 2 || today === 5) {
      // Dienstag (2) oder Freitag (5)
      const euroJackpotResult = await this.getEuroJackpotNumbers()
      message = `Ziehungsdatum: ${euroJackpotResult.ziehungsdatum}\nEuroJackpot Zahlen: ${euroJackpotResult.mainNumbers.join(', ')}\nEurozahlen: ${euroJackpotResult.eurozahlen.join(', ')}`
    }

    if (message) {
      for (const user of users) {
        await this.sendMessage(user.telegram_id, `📢 Deine Lottozahlen:\n\n${message}`)
      }
    }
  }

  private async get6outOf49Numbers() {
    // samstags um 19:25 Uhr sowie mittwochs um 18:25 Uhr
    const browser = await puppeteer.launch({
      headless: true, // Use "new" to prevent deprecation warnings
    })
    const page = await browser.newPage()

    // 🚀 Set User-Agent to mimic a real browser
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    )

    // 🚀 Set additional headers to look human
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    })

    const url = 'https://www.lotto.de/lotto-6aus49/lottozahlen'
    await page.goto(url, { waitUntil: 'networkidle2' }) // Ensures most resources are loaded

    const lottoNumbers: string[] = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(
          '.DrawNumbersCollection__container:nth-child(1) .LottoBall__circle'
        )
      ).map((el) => el.textContent?.trim() || '')
    })

    const additionalNumber: string = await page.evaluate(() => {
      const element = document.querySelector(
        '.DrawNumbersCollection__container:nth-child(2) .LottoBall__circle'
      )
      return element ? element.textContent?.trim() || '' : ''
    })

    const game77: string = await page.evaluate(() => {
      const element = document.querySelector(
        '.WinningNumbersAdditionalGame:nth-child(1) span:last-child'
      )
      return element ? element.textContent?.trim() || '' : ''
    })

    const super6: string = await page.evaluate(() => {
      const element = document.querySelector(
        '.WinningNumbersAdditionalGame:nth-child(2) span:last-child'
      )
      return element ? element.textContent?.trim() || '' : ''
    })

    const drawDate: string = await page.evaluate(() => {
      const element = document.querySelector('.WinningNumbers__date')
      return element ? element.textContent?.trim() || '' : ''
    })

    await browser.close()
    return {
      drawDate,
      lottoNumbers,
      additionalNumber,
      game77,
      super6,
    }
  }

  private async getEuroJackpotNumbers() {
    // jeden Dienstag und Freitag gegen 20 Uhr
    const browser = await puppeteer.launch({
      headless: true,
    })
    const page = await browser.newPage()

    // 🚀 Set User-Agent to mimic a real browser
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    )

    // 🚀 Set additional headers to look human
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    })

    const url = 'https://www.eurojackpot.de/'
    await page.goto(url, { waitUntil: 'networkidle2' })

    const ziehungsdatum: string = await page.evaluate(() => {
      const dateElement = document.querySelector('select[formcontrolname="datum"] option')
      return dateElement ? dateElement.textContent?.trim() || '' : ''
    })

    const mainNumbers: string[] = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.winning-number'))
        .slice(0, 5) // First 5 numbers
        .map((el) => el.textContent?.trim() || '')
    })

    const eurozahlen: string[] = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.winning-number'))
        .slice(5, 7) // The next 2 numbers
        .map((el) => el.textContent?.trim() || '')
    })

    // 🚀 8. Close the browser
    await browser.close()

    // 🚀 9. Return JSON response
    return {
      ziehungsdatum,
      mainNumbers,
      eurozahlen,
    }
  }
}
