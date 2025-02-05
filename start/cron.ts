// start/cron.ts
import cron from 'node-cron'
import { Logger } from '@adonisjs/core/logger'
const logger = new Logger({ enabled: true, name: 'cron' })
// setup node cron
import TelegramsController from '#controllers/telegrams_controller'

// Lotto 6aus49 nur am Mittwoch & Samstag um 19:30 Uhr senden
cron.schedule('30 19 * * 3,6', async () => {
  // 3 = Mittwoch, 6 = Samstag
  logger.info(`Running Lotto 6aus49 task ${new Date().toLocaleString()})`)
  await new TelegramsController().sendLottoResults()
})

// Eurojackpot nur am Dienstag & Freitag um 20:30 Uhr senden
cron.schedule('30 20 * * 2,5', async () => {
  // 2 = Dienstag, 5 = Freitag
  logger.info(`Running Eurojackpot task ${new Date().toLocaleString()})`)
  await new TelegramsController().sendLottoResults()
})
