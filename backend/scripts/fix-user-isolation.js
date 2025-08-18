// scripts/fix-user-isolation.js
import { prisma } from '../src/config/database.js'

async function fixUserIsolation() {
  try {
    console.log('🔧 Starting user isolation fix...')
    
    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true, email: true, clerkId: true }
    })
    
    if (users.length === 0) {
      console.log('❌ No users found in database. Please create a user first.')
      return
    }
    
    console.log(`📊 Found ${users.length} users:`, users.map(u => `${u.email} (${u.id})`))
    
    // Get all modules without userId
    const orphanedModules = await prisma.module.findMany({
      where: { userId: null },
      select: { id: true, title: true, createdAt: true }
    })
    
    if (orphanedModules.length === 0) {
      console.log('✅ All modules already have userId assigned')
      return
    }
    
    console.log(`📦 Found ${orphanedModules.length} orphaned modules:`, 
      orphanedModules.map(m => `${m.title} (${m.id})`))
    
    // Assign all orphaned modules to the first user (or distribute them)
    const defaultUserId = users[0].id
    console.log(`🔗 Assigning orphaned modules to user: ${users[0].email} (${defaultUserId})`)
    
    const updateResult = await prisma.module.updateMany({
      where: { userId: null },
      data: { userId: defaultUserId }
    })
    
    console.log(`✅ Updated ${updateResult.count} modules with userId: ${defaultUserId}`)
    
    // Verify the fix
    const remainingOrphans = await prisma.module.findMany({
      where: { userId: null }
    })
    
    if (remainingOrphans.length === 0) {
      console.log('🎉 User isolation fix completed successfully!')
    } else {
      console.log(`⚠️ Warning: ${remainingOrphans.length} modules still have no userId`)
    }
    
  } catch (error) {
    console.error('❌ Error fixing user isolation:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the fix
fixUserIsolation()
