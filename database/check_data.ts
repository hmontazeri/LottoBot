import User from '#models/user'

async function checkDatabase() {
  const users = await User.all()
  console.log('Users in database:', users)
  process.exit(0)
}

checkDatabase()
