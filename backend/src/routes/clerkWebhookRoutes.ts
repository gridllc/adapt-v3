// routes/clerkWebhookRoutes.ts
import express, { Request, Response } from 'express'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()

// ES Module compatible __dirname
const __dirname = path.dirname(__filename)

const eventSchema = z.object({
  type: z.string(),
  data: z.object({
    id: z.string(),
    email_addresses: z.array(z.object({ email_address: z.string() })),
  }),
})

router.post('/webhooks/clerk', async (req: Request, res: Response) => {
  try {
    const event = eventSchema.parse(req.body)

    if (event.type === 'user.created') {
      const user = {
        id: event.data.id,
        email: event.data.email_addresses[0]?.email_address || '',
        createdAt: new Date().toISOString(),
      }

      const dataPath = path.resolve(__dirname, '../data/users.json')
      let users: { id: string; email: string; createdAt: string }[] = []

      try {
        const raw = await fs.readFile(dataPath, 'utf-8')
        users = JSON.parse(raw)
      } catch {
        users = []
      }

      users.push(user)
      await fs.writeFile(dataPath, JSON.stringify(users, null, 2))
      console.log(`✅ Clerk user stored: ${user.email}`)

      return res.status(200).json({ success: true })
    }

    return res.status(200).json({ ignored: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return res.status(400).json({ error: 'Invalid payload' })
  }
})

export default router
