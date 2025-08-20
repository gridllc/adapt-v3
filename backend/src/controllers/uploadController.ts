import type { Request, Response } from 'express'
import { ModuleService } from '../services/moduleService.js'
import { presignedUploadService } from '../services/presignedUploadService.js'
import { queueOrInline } from '../services/qstashQueue.js'
import { ok, fail } from '../utils/http.js'

export const uploadController = {
  async init(req: Request, res: Response) {
    try {
      const { filename, contentType } = req.body || {}
      if (!filename || !contentType) return fail(res, 400, 'filename and contentType required')
      if (!contentType.startsWith('video/')) return fail(res, 400, 'Only video/* allowed')

      const module = await ModuleService.createForFilename(filename) // returns {id,...}
      const key = `training/${module.id}.mp4`
      const { url: presignedUrl } = await presignedUploadService.presignPut({ key, contentType })
      return ok(res, { moduleId: module.id, key, presignedUrl })
    } catch (err) {
      console.error('upload.init error', err)
      return fail(res, 500, 'init failed')
    }
  },

  async complete(req: Request, res: Response) {
    try {
      const { moduleId, key } = req.body || {};
      if (!moduleId || !key) return res.status(400).json({ success:false, error:'moduleId and key required' });

      const exists = await presignedUploadService.confirmHead(key);
      if (!exists) return res.status(404).json({ success:false, error:'file not found in S3' });

      // Mark as uploaded first
      await ModuleService.markUploaded(moduleId, key);

      // Queue or run processing inline
      await queueOrInline(moduleId);

      return res.json({ success:true, status:'UPLOADED', moduleId });
    } catch (err) {
      console.error('upload.complete error', err);
      return res.status(500).json({ success:false, error:'complete failed' });
    }
  }
}
