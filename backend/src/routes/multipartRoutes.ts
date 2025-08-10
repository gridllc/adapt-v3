import express from 'express'
import { multipartController } from '../controllers/multipartController.js'

const router = express.Router()

// Initialize multipart upload
router.post('/init', multipartController.initUpload)

// Get signed URL for uploading a part
router.post('/sign-part', multipartController.signPart)

// Complete multipart upload
router.post('/complete', multipartController.completeUpload)

// Abort multipart upload
router.post('/abort', multipartController.abortUpload)

export { router as multipartRoutes }



