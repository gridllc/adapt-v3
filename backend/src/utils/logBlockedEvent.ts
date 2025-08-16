import { prisma } from '../config/database.js'

export const logBlockedEvent = async ({
  ip,
  userId,
  reason
}: {
  ip: string
  userId?: string
  reason: string
}) => {
  try {
    // For now, just log to console since we don't have the BlockedEvent model yet
    console.log(`🚫 Blocked event logged: ${reason} (IP: ${ip}, User: ${userId || 'anonymous'})`)
    
    // TODO: Uncomment when BlockedEvent model is added to Prisma schema
    // await prisma.blockedEvent.create({
    //   data: {
    //     ip,
    //     userId,
    //     reason
    //   }
    // })
    
  } catch (error) {
    console.error('❌ Failed to log blocked event:', error)
  }
} 
