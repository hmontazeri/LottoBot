/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
const TelegramsController = () => import('#controllers/telegrams_controller')

router.on('/').render('pages/home')

// add /telegrams/webhook route to Telegram Controller
router.post('/telegram/webhook', [TelegramsController, 'webhook'])
