#!/usr/bin/env node

/**
 * Script to unstick modules stuck in PROCESSING status
 * Run this to clear any stale processing locks from failed runs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function unstickProcessingModules() {
  try {
    console.log('🔧 Checking for modules stuck in PROCESSING status...')
    
    // Find modules that have been PROCESSING for more than 10 minutes
    const stuckModules = await prisma.module.findMany({
      where: {
        status: 'PROCESSING',
        updatedAt: {
          lt: new Date(Date.now() - 10 * 60 * 1000) // older than 10 minutes
        }
      },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        createdAt: true
      }
    })
    
    if (stuckModules.length === 0) {
      console.log('✅ No stuck modules found')
      return
    }
    
    console.log(`⚠️ Found ${stuckModules.length} stuck modules:`)
    stuckModules.forEach(module => {
      const stuckDuration = Math.round((Date.now() - module.updatedAt.getTime()) / 1000 / 60)
      console.log(`  - ${module.id}: ${module.title} (stuck for ${stuckDuration} minutes)`)
    })
    
    // Update stuck modules to FAILED status
    const result = await prisma.module.updateMany({
      where: {
        status: 'PROCESSING',
        updatedAt: {
          lt: new Date(Date.now() - 10 * 60 * 1000) // older than 10 minutes
        }
      },
      data: {
        status: 'FAILED',
        progress: 0,
        error: 'Stale processing lock cleared - module was stuck in PROCESSING status'
      }
    })
    
    console.log(`✅ Successfully unstuck ${result.count} modules`)
    console.log('\n📝 These modules can now be re-run using the "Re-run AI Step Detection" button')
    
  } catch (error) {
    console.error('❌ Error unsticking modules:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
unstickProcessingModules()
  .then(() => {
    console.log('✅ Script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
