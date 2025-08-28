// One-time cleanup script for placeholder data
// Run this in the backend directory: node cleanup-placeholders.js <moduleId>

const { PrismaClient } = require('@prisma/client');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs/promises');
const path = require('path');

const prisma = new PrismaClient();
const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.AWS_BUCKET_NAME;

async function cleanupModule(moduleId) {
  console.log(`🧹 Cleaning up placeholders for module: ${moduleId}`);

  try {
    // 1. Clear DB steps
    console.log('📝 Clearing DB steps...');
    const deletedSteps = await prisma.step.deleteMany({
      where: { moduleId }
    });
    console.log(`✅ Deleted ${deletedSteps.count} steps from database`);

    // 2. Remove S3 training JSON
    console.log('☁️ Removing S3 training file...');
    try {
      await s3.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: `training/${moduleId}.json`
      }));
      console.log('✅ Deleted S3 training file');
    } catch (err) {
      console.log('⚠️ S3 file not found or already deleted');
    }

    // 3. Remove local data files (if they exist)
    const dataDir = path.join(process.cwd(), 'src', 'data');
    const trainingFile = path.join(dataDir, 'training', `${moduleId}.json`);
    const stepsFile = path.join(dataDir, 'steps', `${moduleId}.json`);

    try {
      await fs.unlink(trainingFile);
      console.log('✅ Deleted local training file');
    } catch {
      console.log('⚠️ Local training file not found');
    }

    try {
      await fs.unlink(stepsFile);
      console.log('✅ Deleted local steps file');
    } catch {
      console.log('⚠️ Local steps file not found');
    }

    console.log(`🎉 Cleanup complete for module ${moduleId}!`);
    console.log('Run "Generate Steps" again to create fresh, real data.');

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Get module ID from command line
const moduleId = process.argv[2];
if (!moduleId) {
  console.log('Usage: node cleanup-placeholders.js <moduleId>');
  process.exit(1);
}

cleanupModule(moduleId);
