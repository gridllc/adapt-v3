import { Router } from 'express'
import { initUpload, completeUpload } from '../controllers/uploadController.js'

export const uploadRoutes = Router()

// New names (what the frontend expects)
uploadRoutes.post('/init', initUpload)
uploadRoutes.post('/complete', completeUpload)

// Back-compat aliases (what your server log shows)
uploadRoutes.post('/presigned-url', initUpload)
uploadRoutes.post('/process', completeUpload)