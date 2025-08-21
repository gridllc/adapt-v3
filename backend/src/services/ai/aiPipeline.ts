import { ModuleService } from '../moduleService.js'
import { aiService } from '../aiService.js'
import { runOneAtATime } from './queue.js'
import { submitTranscriptJob } from '../transcription/assembly.js'
import { presignedUploadService } from '../presignedUploadService.js'
import { prisma } from '../../config/database.js'

export async function startProcessing(moduleId: string) {
  // Use the queue to ensure only one job runs at a time
  return runOneAtATime(async () => {
    // Mark as processing
    await ModuleService.markProcessing(moduleId)
    
    try {
      // Get module to access s3Key
      const mod = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });

      // Update progress
      await prisma.module.update({
        where: { id: moduleId },
        data: { status: "PROCESSING", progress: 5 }
      });

      // get a short-lived signed read URL for the uploaded video
      const mediaUrl = await presignedUploadService.getSignedPlaybackUrl(mod.s3Key!);

      // submit async job to AssemblyAI
      const transcriptJobId = await submitTranscriptJob({ mediaUrl, moduleId });

      await prisma.module.update({
        where: { id: moduleId },
        data: { transcriptJobId, progress: 15 }
      });

      // stop here — webhook will finish
      console.log(`✅ AssemblyAI job submitted for module ${moduleId}, jobId: ${transcriptJobId}`)
      
    } catch (e: any) {
      const msg = String(e?.message || e)
      console.error('processing failed', msg)
      await ModuleService.markError(moduleId, msg)
    }
  })
}
