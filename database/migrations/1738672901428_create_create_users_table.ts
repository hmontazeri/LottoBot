import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id') // Auto-increment ID
      table.bigInteger('telegram_id').unique().notNullable() // Telegram User ID
      table.string('first_name')
      table.string('username')
      table.boolean('active').defaultTo(true) // Subscription status
      table.timestamp('created_at').defaultTo(this.now())
      table.timestamp('updated_at').defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
