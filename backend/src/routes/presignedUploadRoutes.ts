import express from 'express'
import { presignedUploadController } from '../controllers/presignedUploadController.js'

const router = express.Router()

router.post('/presigned-url', presignedUploadController.getPresignedUrl)
router.post('/process', presignedUploadController.processVideo)
router.post('/confirm', presignedUploadController.confirmUpload)
router.get('/status/:key', presignedUploadController.getUploadStatus)
router.get('/health', presignedUploadController.healthCheck)

export { router as presignedUploadRoutes }
