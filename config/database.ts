import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'
import env from '#start/env'

const dbConfig = defineConfig({
  connection: 'sqlite',
  connections: {
    sqlite: {
      client: 'better-sqlite3',
      connection: {
        filename:
          env.get('NODE_ENV') === 'production'
            ? '/sqlite/db.sqlite3' // ✅ Store outside the app folder in Docker
            : app.tmpPath('db.sqlite3'), // Local development uses temp path
      },
      useNullAsDefault: true,
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default dbConfig
