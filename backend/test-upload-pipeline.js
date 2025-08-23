#!/usr/bin/env node

/**
 * Test script to verify the upload and processing pipeline
 * Run with: node test-upload-pipeline.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testUploadPipeline() {
  console.log('🧪 Testing Upload Pipeline...\n')
  
  try {
    // 1. Check database connection
    console.log('1️⃣ Testing database connection...')
    await prisma.$connect()
    console.log('✅ Database connected successfully\n')
    
    // 2. Check recent modules
    console.log('2️⃣ Checking recent modules...')
    const recentModules = await prisma.module.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        s3Key: true,
        stepsKey: true,
        progress: true,
        lastError: true,
        createdAt: true
      }
    })
    
    console.log(`📊 Found ${recentModules.length} recent modules:`)
    recentModules.forEach((module, i) => {
      console.log(`   ${i + 1}. ${module.title} (${module.id})`)
      console.log(`      Status: ${module.status}, Progress: ${module.progress}%`)
      console.log(`      S3 Key: ${module.s3Key ? '✅' : '❌'}`)
      console.log(`      Steps Key: ${module.stepsKey ? '✅' : '❌'}`)
      if (module.lastError) {
        console.log(`      Error: ${module.lastError}`)
      }
      console.log(`      Created: ${module.createdAt.toISOString()}`)
      console.log('')
    })
    
    // 3. Check for stuck modules
    console.log('3️⃣ Checking for stuck modules...')
    const stuckModules = await prisma.module.findMany({
      where: {
        OR: [
          { status: 'PROCESSING' },
          { status: 'UPLOADED' }
        ]
      },
      select: {
        id: true,
        title: true,
        status: true,
        progress: true,
        lastError: true,
        createdAt: true
      }
    })
    
    if (stuckModules.length > 0) {
      console.log(`⚠️  Found ${stuckModules.length} potentially stuck modules:`)
      stuckModules.forEach((module, i) => {
        console.log(`   ${i + 1}. ${module.title} (${module.id})`)
        console.log(`      Status: ${module.status}, Progress: ${module.progress}%`)
        if (module.lastError) {
          console.log(`      Error: ${module.lastError}`)
        }
        console.log(`      Created: ${module.createdAt.toISOString()}`)
        console.log('')
      })
    } else {
      console.log('✅ No stuck modules found\n')
    }
    
    // 4. Check environment variables
    console.log('4️⃣ Checking environment variables...')
    const requiredEnvVars = [
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY', 
      'AWS_REGION',
      'AWS_BUCKET_NAME',
      'OPENAI_API_KEY',
      'ASSEMBLYAI_API_KEY',
      'ASSEMBLYAI_WEBHOOK_SECRET'
    ]
    
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])
    
    if (missingEnvVars.length > 0) {
      console.log(`❌ Missing environment variables: ${missingEnvVars.join(', ')}`)
    } else {
      console.log('✅ All required environment variables are set')
    }
    console.log('')
    
    // 5. Summary and recommendations
    console.log('5️⃣ Summary and Recommendations:')
    
    if (stuckModules.length > 0) {
      console.log(`   • ${stuckModules.length} modules may be stuck in processing`)
      console.log('   • Consider running the reprocess endpoint for stuck modules')
      console.log('   • Check logs for any processing errors')
    }
    
    if (missingEnvVars.length > 0) {
      console.log(`   • ${missingEnvVars.length} environment variables are missing`)
      console.log('   • This will prevent upload and processing from working')
    }
    
    if (recentModules.length === 0) {
      console.log('   • No modules found - this may be normal for a fresh installation')
    }
    
    console.log('\n🎯 Next steps:')
    console.log('   1. Try uploading a video to test the pipeline')
    console.log('   2. Check the logs for any errors during processing')
    console.log('   3. Verify that steps are being saved to S3')
    console.log('   4. Ensure the webhook endpoint is accessible')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testUploadPipeline()
  .then(() => {
    console.log('\n✅ Test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })
