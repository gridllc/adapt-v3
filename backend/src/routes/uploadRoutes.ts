import { Router } from 'express'
import { uploadController } from '../controllers/uploadController.js'

export const uploadRoutes = Router()

// New names (what the frontend expects)
uploadRoutes.post('/init', uploadController.init)
uploadRoutes.post('/complete', uploadController.complete)

// Back-compat aliases (what your server log shows)
uploadRoutes.post('/presigned-url', uploadController.init)
uploadRoutes.post('/process', uploadController.complete)