import { Router } from 'express'
import { uploadController } from '../controllers/uploadController.js'

export const uploadRoutes = Router()
uploadRoutes.post('/init', uploadController.init)
uploadRoutes.post('/complete', uploadController.complete)