import express from 'express'
import { handleUpload } from '../controllers/uploadController.js'

const router = express.Router()

// Upload endpoint using the new middleware array pattern
router.post('/', handleUpload)

export { router as uploadRoutes } 