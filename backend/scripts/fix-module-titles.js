#!/usr/bin/env node

/**
 * Script to fix module titles that have UUID prefixes
 * Run with: node scripts/fix-module-titles.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixModuleTitles() {
  try {
    console.log('🔍 Finding modules with corrupted titles...')
    
    // Find all modules
    const modules = await prisma.module.findMany({
      select: {
        id: true,
        title: true,
        filename: true,
        s3Key: true
      }
    })
    
    console.log(`📊 Found ${modules.length} modules`)
    
    let fixedCount = 0
    
    for (const module of modules) {
      // Check if title contains a UUID pattern
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i
      
      if (uuidPattern.test(module.title)) {
        // Extract the original title by removing the UUID prefix
        const originalTitle = module.title.replace(uuidPattern, '')
        
        console.log(`🔧 Fixing module ${module.id}:`)
        console.log(`   Old title: ${module.title}`)
        console.log(`   New title: ${originalTitle}`)
        
        // Update the module
        await prisma.module.update({
          where: { id: module.id },
          data: { title: originalTitle }
        })
        
        fixedCount++
      }
    }
    
    console.log(`✅ Fixed ${fixedCount} module titles`)
    
  } catch (error) {
    console.error('❌ Error fixing module titles:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
fixModuleTitles()
  .then(() => {
    console.log('🎉 Script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })
