import { test } from '@japa/runner'
import TelegramsController from '#controllers/telegrams_controller'

test.group('Lottery scrapers', () => {
  test('scrapes 6aus49 winning numbers from lotto.de', async ({ assert }) => {
    const controller = new TelegramsController()
    const result = await controller.get6outOf49Numbers()

    assert.match(result.drawDate, /Ziehung/)
    assert.lengthOf(result.lottoNumbers, 6)
    result.lottoNumbers.forEach((n) => assert.match(n, /^\d{1,2}$/))
    assert.match(result.additionalNumber, /^\d{1,2}$/)
    assert.match(result.game77, /^\d(?:\s\d)+$/)
    assert.match(result.super6, /^\d(?:\s\d)+$/)
  }).timeout(120_000)

  test('scrapes Eurojackpot winning numbers from eurojackpot.de', async ({ assert }) => {
    const controller = new TelegramsController()
    const result = await controller.getEuroJackpotNumbers()

    assert.notEqual(result.ziehungsdatum, '')
    assert.lengthOf(result.mainNumbers, 5)
    result.mainNumbers.forEach((n) => assert.match(n, /^\d{1,2}$/))
    assert.lengthOf(result.eurozahlen, 2)
    result.eurozahlen.forEach((n) => assert.match(n, /^\d{1,2}$/))
  }).timeout(120_000)
})
