// routes/clerkWebhookRoutes.ts
import express, { Request, Response } from 'express'
import { Webhook } from 'svix' // Clerk uses Svix for webhooks
import { prisma } from '../config/database.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

router.post('/clerk', async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
    if (!webhookSecret) {
      logger.error('❌ CLERK_WEBHOOK_SECRET not configured')
      return res.status(500).json({ error: 'Webhook secret not configured' })
    }

    const wh = new Webhook(webhookSecret)
    const payload = wh.verify(
      req.body as Buffer,
      {
        'svix-id': req.headers['svix-id'] as string,
        'svix-timestamp': req.headers['svix-timestamp'] as string,
        'svix-signature': req.headers['svix-signature'] as string
      }
    ) as any

    logger.info(`📨 Clerk webhook received: ${payload.type}`)

    if (payload.type === 'user.created') {
      const { id: clerkId, email_addresses } = payload.data
      const email = email_addresses[0]?.email_address

      if (!email) {
        logger.warn('⚠️ User created without email address')
        return res.status(400).json({ error: 'No email address' })
      }

      // Upsert user in DB (create if doesn't exist, update if does)
      const user = await prisma.user.upsert({
        where: { clerkId },
        update: { email },
        create: { 
          clerkId, 
          email,
          // Generate a unique ID for Prisma
          id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        },
      })

      logger.info(`✅ User synced to database: ${user.email} (Clerk: ${clerkId})`)
    }

    if (payload.type === 'user.updated') {
      const { id: clerkId, email_addresses } = payload.data
      const email = email_addresses[0]?.email_address

      if (email) {
        await prisma.user.updateMany({
          where: { clerkId },
          data: { email }
        })
        logger.info(`✅ User updated in database: ${email}`)
      }
    }

    if (payload.type === 'user.deleted') {
      const { id: clerkId } = payload.data
      
      // Delete user and all their modules (cascade)
      await prisma.user.deleteMany({
        where: { clerkId }
      })
      logger.info(`✅ User deleted from database: ${clerkId}`)
    }

    res.json({ success: true })
  } catch (err) {
    logger.error('❌ Clerk webhook error:', err)
    res.status(400).json({ error: 'Invalid webhook' })
  }
})

// Temporary test route to manually create users (remove in production)
router.post('/test/create-user', async (req, res) => {
  try {
    const { clerkId, email } = req.body
    
    if (!clerkId || !email) {
      return res.status(400).json({ error: 'clerkId and email required' })
    }

    // Create user in DB
    const user = await prisma.user.upsert({
      where: { clerkId },
      update: { email },
      create: { 
        clerkId, 
        email,
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
    })

    logger.info(`✅ Test user created: ${user.email} (ID: ${user.id})`)
    res.json({ success: true, user })
  } catch (err) {
    logger.error('❌ Test user creation error:', err)
    res.status(500).json({ error: 'Failed to create test user' })
  }
})

// Temporary test route to check database state (remove in production)
router.get('/test/db-state', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, clerkId: true, createdAt: true }
    })
    
    const modules = await prisma.module.findMany({
      select: { id: true, title: true, userId: true, createdAt: true }
    })
    
    res.json({
      success: true,
      users: users.length,
      modules: modules.length,
      modulesWithUserId: modules.filter(m => m.userId).length,
      modulesWithoutUserId: modules.filter(m => !m.userId).length,
      sampleUsers: users.slice(0, 3),
      sampleModules: modules.slice(0, 3)
    })
  } catch (err) {
    logger.error('❌ Test DB state error:', err)
    res.status(500).json({ error: 'Failed to check DB state' })
  }
})

export default router
