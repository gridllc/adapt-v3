import { Router } from 'express'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { ModuleService } from '../services/moduleService.js'
import { ok, fail } from '../utils/http.js'

const REGION = process.env.AWS_REGION!
const BUCKET = process.env.AWS_BUCKET_NAME!
const s3 = new S3Client({ region: REGION })

export const videoRoutes = Router()

videoRoutes.get('/:moduleId/play', async (req, res) => {
  try {
    const m = await ModuleService.get(req.params.moduleId)
    if (!m?.s3Key) return fail(res, 404, 'missing s3Key')
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: m.s3Key })
    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 })
    ok(res, { url })
  } catch (e) {
    fail(res, 500, 'signing failed')
  }
})