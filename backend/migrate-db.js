import 'dotenv/config'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runMigrations() {
  console.log('🔄 Running database migrations...')
  console.log('')
  
  try {
    // Generate Prisma client
    console.log('📦 Generating Prisma client...')
    execSync('npx prisma generate', { 
      cwd: __dirname,
      stdio: 'inherit'
    })
    console.log('✅ Prisma client generated')
    
    console.log('')
    
    // Push schema to database
    console.log('🚀 Pushing schema to database...')
    execSync('npx prisma db push', { 
      cwd: __dirname,
      stdio: 'inherit'
    })
    console.log('✅ Schema pushed to database')
    
    console.log('')
    
    // Show database status
    console.log('📊 Database status:')
    execSync('npx prisma db pull', { 
      cwd: __dirname,
      stdio: 'inherit'
    })
    
    console.log('')
    console.log('✅ Database migration completed successfully!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

runMigrations() 