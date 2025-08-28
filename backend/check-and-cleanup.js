// Check modules and run cleanup
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAndCleanup() {
  try {
    console.log('🔍 Checking modules in database...');

    const modules = await prisma.module.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        durationSec: true,
        createdAt: true
      }
    });

    if (modules.length === 0) {
      console.log('📝 No modules found in database');
      return;
    }

    console.log(`📊 Found ${modules.length} modules:`);
    modules.forEach(mod => {
      const duration = (mod as any).durationSec;
      console.log(`- ${mod.id}: "${mod.title}" (status: ${mod.status}, duration: ${duration || 'null'})`);
    });

    // Check for modules that might have problematic data
    const potentiallyProblematic = modules.filter(mod =>
      mod.status === 'READY' && !(mod as any).durationSec
    );

    if (potentiallyProblematic.length > 0) {
      console.log(`\n⚠️ Found ${potentiallyProblematic.length} modules that might have issues:`);
      potentiallyProblematic.forEach(mod => {
        console.log(`- ${mod.id}: "${mod.title}" - Ready but no duration`);
      });

      // Run cleanup on these modules
      console.log('\n🧹 Running cleanup...');
      for (const mod of potentiallyProblematic) {
        console.log(`Cleaning up ${mod.id}...`);

        // Clear DB steps
        const deletedSteps = await prisma.step.deleteMany({
          where: { moduleId: mod.id }
        });
        console.log(`  ✅ Deleted ${deletedSteps.count} steps from database`);

        // Note: S3 cleanup would require AWS credentials, so we'll skip that here
        console.log(`  📝 Would delete S3 file: training/${mod.id}.json`);
      }

      console.log('\n🎉 Cleanup complete!');
      console.log('Run "Generate Steps" again for these modules to create fresh data.');
    } else {
      console.log('\n✅ No problematic modules found');
    }

  } catch (error) {
    console.error('❌ Error during check/cleanup:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndCleanup();
