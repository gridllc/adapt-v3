import { Router } from 'express'
import { initUpload, completeUpload } from '../controllers/uploadController.js'
import { mustBeAuthed } from '../middleware/auth.js'

export const uploadRoutes = Router()

// New names (what the frontend expects) - require authentication
uploadRoutes.post('/init', mustBeAuthed, initUpload)
uploadRoutes.post('/complete', mustBeAuthed, completeUpload)

// Back-compat aliases (what your server log shows) - require authentication
uploadRoutes.post('/presigned-url', mustBeAuthed, initUpload)
uploadRoutes.post('/process', mustBeAuthed, completeUpload)