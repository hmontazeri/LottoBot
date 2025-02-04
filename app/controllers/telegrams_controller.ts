import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'

export default class TelegramsController {
  // webhook method to handle incoming Telegram messages
  public async webhook({ request, response }: HttpContext) {
    // get the message from the request body
    const message = request.input('message')
    logger.info('data: %j', request.all())
    // log the message to the console
    logger.info('message: %j', message)

    // respond with a 200 status code
    response.status(200).send('OK')
  }
}
