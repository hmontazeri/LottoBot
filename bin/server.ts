/*
|--------------------------------------------------------------------------
| HTTP server entrypoint
|--------------------------------------------------------------------------
|
| The "server.ts" file is the entrypoint for starting the AdonisJS HTTP
| server. Either you can run this file directly or use the "serve"
| command to run this file and monitor file changes
|
*/

import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'

/**
 * Bind the HTTP server to all interfaces.
 *
 * Coolify injects HOST=<application id>, and @adonisjs/core's Ignitor uses
 * process.env.HOST verbatim as the bind address:
 *
 *   const host = process.env.HOST || '0.0.0.0'   // build/src/ignitor/http.js
 *
 * During a rolling deploy that name resolved to the previous container's IP,
 * so the server died with EADDRNOTAVAIL: address not available 172.16.16.20:8080
 * (or getaddrinfo EAI_AGAIN <application id> after a plain restart). No HTTP
 * server came up and the Telegram webhook answered 502 Bad Gateway.
 *
 * config/server.ts cannot fix this: the ServerConfig type has no `host`
 * property, the bind address is read from the environment only. So force it
 * here, before the Ignitor boots.
 */
process.env.HOST = '0.0.0.0'

/**
 * URL to the application root. AdonisJS need it to resolve
 * paths to file and directories for scaffolding commands
 */
const APP_ROOT = new URL('../', import.meta.url)

/**
 * The importer is used to import files in context of the
 * application.
 */
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')
    })
    app.listen('SIGTERM', () => app.terminate())
    app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate())
  })
  .httpServer()
  .start()
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })
