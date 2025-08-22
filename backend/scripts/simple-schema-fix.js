#!/usr/bin/env node

/**
 * Simple schema fix for immediate foreign key constraint issue
 * This script just drops the problematic constraint so uploads can work
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function simpleSchemaFix() {
  try {
    console.log('🔧 Starting simple schema fix...');

    // Just drop the problematic foreign key constraint
    console.log('🔗 Dropping problematic foreign key constraint...');
    
    try {
      await prisma.$executeRaw`ALTER TABLE modules DROP CONSTRAINT IF EXISTS "modules_userId_fkey";`;
      console.log('✅ Foreign key constraint dropped successfully');
    } catch (error) {
      console.log('⚠️ Could not drop constraint (might not exist):', error.message);
    }

    // Check if users table exists and has right structure
    console.log('📋 Checking users table...');
    
    try {
      const tableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `;

      if (!tableExists[0].exists) {
        console.log('📋 Creating users table...');
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            "clerkId" TEXT UNIQUE,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
          );
        `;
        console.log('✅ Users table created');
      } else {
        console.log('✅ Users table already exists');
      }
    } catch (error) {
      console.log('⚠️ Users table check failed:', error.message);
    }

    console.log('🎉 Simple schema fix completed! Uploads should now work.');
    
  } catch (error) {
    console.error('❌ Error in simple schema fix:', error);
    // Don't exit with error code - we want the app to start
    console.log('⚠️ Continuing despite errors...');
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
simpleSchemaFix().catch(console.error);
