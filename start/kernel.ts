/*
|--------------------------------------------------------------------------
| HTTP kernel file
|--------------------------------------------------------------------------
|
| The HTTP kernel file is used to register the middleware with the server
| or the router.
|
*/

import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'
// import './cron.ts'
// start/cron.ts
import cron from 'node-cron'
import { Logger } from '@adonisjs/core/logger'
import TelegramsController from '#controllers/telegrams_controller'

const logger = new Logger({ enabled: true, name: 'cron' })
// setup node cron

// Lotto 6aus49 nur am Mittwoch & Samstag um 19:30 Uhr senden
cron.schedule('30 19 * * 3,6', async () => {
  // 3 = Mittwoch, 6 = Samstag
  logger.info(`Running Lotto 6aus49 task ${new Date().toLocaleString()})`)
  try {
    await new TelegramsController().sendLottoResults()
  } catch (error) {
    logger.error('Error sending lotto results:', error)
  }
})

// Eurojackpot nur am Dienstag & Freitag um 20:30 Uhr senden
cron.schedule('30 20 * * 2,5', async () => {
  // 2 = Dienstag, 5 = Freitag
  logger.info(`Running Eurojackpot task ${new Date().toLocaleString()})`)
  try {
    await new TelegramsController().sendLottoResults()
  } catch (error) {
    logger.error('Error sending lotto results:', error)
  }
})

/**
 * The error handler is used to convert an exception
 * to a HTTP response.
 */
server.errorHandler(() => import('#exceptions/handler'))

/**
 * The server middleware stack runs middleware on all the HTTP
 * requests, even if there is no route registered for
 * the request URL.
 */
server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/static/static_middleware'),
  () => import('@adonisjs/vite/vite_middleware'),
])

/**
 * The router middleware stack runs middleware on all the HTTP
 * requests with a registered route.
 */
router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/session/session_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
])

// const tasks = cron.getTasks()

// for (let [key, value] of tasks.entries()) {
//   console.log('key', key)
//   console.log('value', value)
// }
/**
 * Named middleware collection must be explicitly assigned to
 * the routes or the routes group.
 */
export const middleware = router.named({})
