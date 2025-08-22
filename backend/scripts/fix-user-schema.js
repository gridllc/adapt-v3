#!/usr/bin/env node

/**
 * Script to fix the user schema for Clerk integration
 * This script handles the transition from auto-generated CUIDs to Clerk user IDs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixUserSchema() {
  try {
    console.log('🔧 Starting user schema fix...');

    // Check if we need to create the users table with new structure
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `;

    if (!tableExists[0].exists) {
      console.log('📋 Creating users table with new structure...');
      
      // Create the users table with Clerk ID as primary key
      await prisma.$executeRaw`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          "clerkId" TEXT UNIQUE,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL
        );
      `;
      
      console.log('✅ Users table created');
    } else {
      console.log('📋 Users table already exists, checking structure...');
      
      // Check if the table has the right structure
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position;
      `;
      
      console.log('📊 Current table structure:', columns);
      
      // If the table exists but has wrong structure, we need to recreate it
      const hasClerkId = columns.some(col => col.column_name === 'id' && col.data_type === 'text');
      
      if (!hasClerkId) {
        console.log('⚠️ Table structure needs updating...');
        
        // Drop and recreate the table
        await prisma.$executeRaw`DROP TABLE IF EXISTS users CASCADE;`;
        
        await prisma.$executeRaw`
          CREATE TABLE users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            "clerkId" TEXT UNIQUE,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
          );
        `;
        
        console.log('✅ Users table recreated with correct structure');
      }
    }

    // Update the modules table foreign key constraint
    console.log('🔗 Updating modules table foreign key...');
    
    try {
      await prisma.$executeRaw`ALTER TABLE modules DROP CONSTRAINT IF EXISTS "modules_userId_fkey";`;
      await prisma.$executeRaw`
        ALTER TABLE modules ADD CONSTRAINT "modules_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL;
      `;
      console.log('✅ Foreign key constraint updated');
    } catch (error) {
      console.log('⚠️ Foreign key update failed (might already be correct):', error.message);
    }

    console.log('🎉 User schema fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing user schema:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixUserSchema().catch(console.error);
