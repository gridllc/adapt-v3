import { startProcessing } from './ai/aiPipeline.js'

export function isEnabled() {
  // Force disable QStash for MVP (more reliable inline processing)
  if (process.env.FORCE_INLINE_PROCESSING === 'true') {
    console.log(`🔧 Using inline processing (FORCE_INLINE_PROCESSING=true)`)
    return false
  }
  
  return !!process.env.QSTASH_TOKEN && process.env.QSTASH_ENABLED !== 'false'
}

export async function queueOrInline(moduleId: string) {
  const timestamp = new Date().toISOString();
  
  try {
    if (isEnabled()) {
      console.log(`📬 [${moduleId}] QStash enabled, attempting to enqueue...`, { timestamp })
      
      // Validate QStash configuration
      const dest = process.env.QSTASH_DESTINATION_URL
      if (!dest) {
        console.warn(`⚠️ [${moduleId}] Missing QSTASH_DESTINATION_URL, falling back to inline`, { timestamp })
        return await runInlineProcessing(moduleId, 'missing_destination_url')
      }
      
      // Validate destination URL format
      if (!dest.startsWith('https://')) {
        console.warn(`⚠️ [${moduleId}] Invalid QSTASH_DESTINATION_URL format (must be https), falling back to inline`, { timestamp, dest })
        return await runInlineProcessing(moduleId, 'invalid_destination_url')
      }
      
      try {
        const { Client } = await import('@upstash/qstash')
        const c = new Client({
          token: process.env.QSTASH_TOKEN!,
        })
        
        const r = await c.publishJSON({
          url: dest,
          body: { moduleId },
          delay: 0, // Process immediately
          retries: 2, // Allow 2 retries
        })
        
        if (!r.messageId) {
          console.warn(`⚠️ [${moduleId}] No messageId returned from QStash, falling back to inline`, { timestamp })
          return await runInlineProcessing(moduleId, 'no_message_id')
        }
        
        console.log(`📬 [${moduleId}] Enqueued job successfully`, { moduleId, messageId: r.messageId, timestamp })
        return { success: true, messageId: r.messageId, method: 'qstash' }
      } catch (qstashError: any) {
        console.warn(`⚠️ [${moduleId}] QStash API call failed, falling back to inline`, { 
          timestamp, 
          error: qstashError.message,
          stack: qstashError.stack 
        })
        return await runInlineProcessing(moduleId, `qstash_api_error: ${qstashError.message}`)
      }
    }
    
    // QStash disabled, run inline
    console.log(`⚙️ [${moduleId}] QStash disabled → running inline processing`, { timestamp })
    return await runInlineProcessing(moduleId, 'qstash_disabled')
  } catch (err: any) {
    console.error(`💥 [${moduleId}] Unexpected error in queueOrInline`, { 
      timestamp, 
      error: err.message, 
      stack: err.stack 
    })
    return await runInlineProcessing(moduleId, `unexpected_error: ${err.message}`)
  }
}

// Helper function for consistent inline processing
async function runInlineProcessing(moduleId: string, reason: string) {
  const timestamp = new Date().toISOString();
  console.log(`🔄 [${moduleId}] Running inline processing`, { reason, timestamp })
  
  try {
    await startProcessing(moduleId)
    console.log(`✅ [${moduleId}] Inline processing completed successfully`, { reason, timestamp })
    return { success: true, method: 'inline', reason }
  } catch (processingError: any) {
    console.error(`💥 [${moduleId}] Inline processing failed`, { 
      reason, 
      timestamp, 
      error: processingError.message,
      stack: processingError.stack 
    })
    throw processingError // Re-throw so caller can handle the failure
  }
}
