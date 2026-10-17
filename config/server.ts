import { defineConfig } from '@adonisjs/core/http'
import env from '#start/env'

/**
 * The HTTP server deliberately binds to 0.0.0.0.
 *
 * Coolify injects HOST=<application id>, and the AdonisJS default server config
 * reads exactly that variable as the bind address. That made the server try to
 * listen on the application id - or, during a rolling deploy, on the previous
 * container's IP, which no longer exists. The result was
 *   EADDRNOTAVAIL: address not available 172.16.16.20:8080
 * or
 *   getaddrinfo EAI_AGAIN <application id>
 * so no HTTP server came up and the Telegram webhook answered 502 Bad Gateway.
 *
 * Do not read HOST for the bind address on this host. PORT is safe (Coolify sets
 * it to the app's configured port).
 */
export default defineConfig({
  host: '0.0.0.0',
  port: env.get('PORT', 8080),
})
