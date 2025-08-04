import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testPrisma() {
  try {
    console.log('🔍 Testing Prisma connection...')
    
    // Test database connection
    await prisma.$connect()
    console.log('✅ Database connected successfully')
    
    // Test User model query
    console.log('🔍 Querying users...')
    const users = await prisma.user.findMany()
    console.log('📊 Users found:', users.length)
    console.log('👥 Users:', users)
    
    // Test Module model query
    console.log('🔍 Querying modules...')
    const modules = await prisma.module.findMany()
    console.log('📊 Modules found:', modules.length)
    console.log('📦 Modules:', modules)
    
    // Test Question model query
    console.log('🔍 Querying questions...')
    const questions = await prisma.question.findMany()
    console.log('📊 Questions found:', questions.length)
    console.log('❓ Questions:', questions)
    
    console.log('✅ All Prisma tests passed!')
    
  } catch (error) {
    console.error('❌ Prisma test failed:', error)
  } finally {
    await prisma.$disconnect()
    console.log('🔌 Database disconnected')
  }
}

testPrisma() 