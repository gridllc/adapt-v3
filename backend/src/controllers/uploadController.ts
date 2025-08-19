// backend/src/controllers/uploadController.ts
import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'
import { aiService } from '../services/aiService.js'
import { storageService } from '../services/storageService.js'
import { VideoNormalizationService } from '../services/videoNormalizationService.js'

// Unified response interface
interface UploadResponse {
  success: boolean;
  moduleId?: string;
  videoUrl?: string;
  status?: 'PROCESSING' | 'READY' | 'ERROR';
  steps?: any[];
  error?: string;
  message?: string;
}

export const uploadController = {
  /**
   * Main upload endpoint with FFmpeg normalization, unified JSON, and comprehensive error handling
   */
  async uploadVideo(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    console.log('🎬 Starting video upload process...');
    
    // Declare temp file paths at function scope for cleanup
    let originalPath = '';
    let normalizedPath = '';

    try {
      // Validate request
      if (!req.file) {
        const response: UploadResponse = {
          success: false,
          error: 'No file uploaded',
          message: 'Please select a video file to upload'
        };
        res.status(400).json(response);
        return;
      }

      const file = req.file;
      console.log(`📁 File received: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);

      // Validate file type
      if (!file.mimetype.startsWith('video/')) {
        const response: UploadResponse = {
          success: false,
          error: 'Invalid file type',
          message: 'Only video files are allowed'
        };
        res.status(400).json(response);
        return;
      }

      // Validate file size (100MB limit)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        const response: UploadResponse = {
          success: false,
          error: 'File too large',
          message: 'File size must be under 100MB'
        };
        res.status(413).json(response);
        return;
      }

      // Step 1: ALWAYS normalize video for browser compatibility (fixes MEDIA_ELEMENT_ERROR)
      console.log('🔄 Step 1: Normalizing video for browser compatibility...');
      
      // Create temp directory and file paths
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      originalPath = path.join(tempDir, `${uuidv4()}-original-${file.originalname}`);
      normalizedPath = path.join(tempDir, `${uuidv4()}-normalized.mp4`);
      
      try {
        // Write original file to temp directory
        await fs.writeFile(originalPath, file.buffer);
        console.log(`📁 Original file written to temp: ${originalPath}`);
        
        // CRITICAL: Always normalize with FFmpeg using file paths (not in-memory)
        console.log('📹 Processing video with FFmpeg for guaranteed H.264/AAC compatibility...');
        await VideoNormalizationService.normalizeVideoFile(originalPath, normalizedPath, {
          preset: process.env.NODE_ENV === 'production' ? 'veryfast' : 'ultrafast',
          crf: 23,
          audioBitrate: '128k',
          maxHeight: 720 // Cap at 720p for mobile-friendliness
        });
        
        // Verify normalized file exists and has content
        const normalizedStats = await fs.stat(normalizedPath);
        if (!normalizedStats.size || normalizedStats.size === 0) {
          throw new Error('FFmpeg normalization produced empty file');
        }
        
        console.log(`✅ Video normalized: ${file.size} → ${normalizedStats.size} bytes (${((1 - normalizedStats.size / file.size) * 100).toFixed(1)}% compression)`);
        
        // HARD GUARD: Validate MP4 format by reading file header
        const normalizedBuffer = await fs.readFile(normalizedPath);
        const mp4Signature = normalizedBuffer.slice(4, 8).toString();
        if (mp4Signature !== 'ftyp') {
          throw new Error(`FFmpeg normalization failed - invalid MP4 format. Expected 'ftyp', got '${mp4Signature}'`);
        }
        
        console.log(`🔍 MP4 validation passed: ${mp4Signature} signature detected`);
      } catch (normalizationError) {
        console.error('❌ Video normalization failed:', normalizationError);
        const response: UploadResponse = {
          success: false,
          error: 'Video processing failed',
          message: 'Unable to process video file. Please try a different format.'
        };
        res.status(422).json(response);
        return;
      }

      // Step 2: Upload to S3 (CRITICAL: Upload ONLY the normalized file)
      console.log('☁️ Step 2: Uploading normalized video to S3...');
      let videoUrl: string;

      try {
        // CRITICAL FIX: Upload the normalized file directly from disk
        console.log(`🔧 Uploading normalized file: ${normalizedPath}`);
        
        // Read the normalized file and upload it
        const normalizedBuffer = await fs.readFile(normalizedPath);
        const normalizedFile: Express.Multer.File = {
          fieldname: file.fieldname,
          originalname: file.originalname.replace(/\.[^/.]+$/, '.mp4'), // Force .mp4 extension
          encoding: file.encoding,
          mimetype: 'video/mp4', // Always MP4 after normalization
          buffer: normalizedBuffer, // Use the normalized file content
          size: normalizedBuffer.length
        };

        console.log(`🔧 Uploading normalized file: ${normalizedFile.originalname} (${normalizedFile.size} bytes, ${normalizedFile.mimetype})`);
        
        videoUrl = await storageService.uploadVideo(normalizedFile);
        console.log(`✅ Normalized video uploaded to S3: ${videoUrl}`);
      } catch (uploadError) {
        console.error('❌ S3 upload failed:', uploadError);
        const response: UploadResponse = {
          success: false,
          error: 'Upload failed',
          message: 'Failed to save video. Please try again.'
        };
        res.status(500).json(response);
        return;
      }

      // Step 3: Process with AI
      console.log('🤖 Step 3: Processing with AI...');
      let moduleData: any;

      try {
        // Generate module ID for AI processing
        const moduleId = uuidv4();
        
        // Use the correct AI service method for step generation
        await aiService.generateStepsForModule(moduleId, videoUrl);
        
        // For now, create basic module data structure
        moduleData = {
          id: moduleId,
          videoUrl,
          steps: [],
          status: 'PROCESSING'
        };
        
        console.log(`✅ AI processing started for module: ${moduleId}`);
      } catch (aiError) {
        console.error('❌ AI processing failed:', aiError);

        // Return partial success - video is uploaded but not processed
        const response: UploadResponse = {
          success: true,
          videoUrl,
          status: 'ERROR',
          error: 'AI processing failed',
          message: 'Video uploaded but automatic step extraction failed. You can manually add steps.',
          steps: []
        };
        res.status(200).json(response);
        return;
      }

      // Step 4: Save module
      console.log('💾 Step 4: Saving module...');
      let moduleId: string;

      try {
        moduleId = await storageService.saveModule(moduleData);
        console.log(`✅ Module saved with ID: ${moduleId}`);
      } catch (saveError) {
        console.error('❌ Module save failed:', saveError);

        // Return partial success - video processed but not saved
        const response: UploadResponse = {
          success: true,
          videoUrl,
          status: 'ERROR',
          error: 'Save failed',
          message: 'Video processed but failed to save. Please try again.',
          steps: moduleData.steps || []
        };
        res.status(200).json(response);
        return;
      }

      // Success! Return complete unified response
      const processingTime = Date.now() - startTime;
      console.log(`🎉 Upload complete in ${processingTime}ms`);

      const response: UploadResponse = {
        success: true,
        moduleId,
        videoUrl,
        status: 'READY',
        steps: moduleData.steps || [],
        message: `Video processed successfully in ${Math.round(processingTime / 1000)}s`
      };

      res.status(200).json(response);

    } catch (error) {
      // Catch-all error handler
      console.error('❌ Unexpected upload error:', error);

      const response: UploadResponse = {
        success: false,
        error: 'Unexpected error',
        message: 'An unexpected error occurred. Please try again.'
      };

      res.status(500).json(response);
    } finally {
      // CRITICAL: Always clean up temporary files
      try {
        if (originalPath && await fs.access(originalPath).then(() => true).catch(() => false)) {
          await fs.unlink(originalPath);
          console.log('🧹 Cleaned up original temp file');
        }
        if (normalizedPath && await fs.access(normalizedPath).then(() => true).catch(() => false)) {
          await fs.unlink(normalizedPath);
          console.log('🧹 Cleaned up normalized temp file');
        }
      } catch (cleanupError) {
        console.warn('⚠️ Failed to clean up temp files:', cleanupError);
      }
    }
  },

  /**
   * Health check endpoint for upload service
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Check FFmpeg availability
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      await execAsync('ffmpeg -version', { timeout: 5000 });

      const response = {
        success: true,
        status: 'healthy',
        ffmpeg: 'available',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      const response = {
        success: false,
        status: 'unhealthy',
        ffmpeg: 'unavailable',
        error: 'FFmpeg not found',
        timestamp: new Date().toISOString()
      };

      res.status(503).json(response);
    }
  }
};

// Export types for frontend
export type { UploadResponse };