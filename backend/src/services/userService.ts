import { DatabaseService } from './prismaService.js'

export class UserService {
  /**
   * Get or create user from Clerk data
   */
  static async getOrCreateUser(clerkUser: any) {
    try {
      // Try to find existing user by Clerk ID
      let user = await DatabaseService.getUserByClerkId(clerkUser.id)
      
      if (!user) {
        // Try to find by email
        user = await DatabaseService.getUserByEmail(clerkUser.emailAddresses[0]?.emailAddress)
        
        if (!user) {
          // Create new user
          user = await DatabaseService.createUser({
            email: clerkUser.emailAddresses[0]?.emailAddress || 'unknown@example.com',
            clerkId: clerkUser.id
          })
          console.log('✅ Created new user:', user.id)
        } else {
          // Update existing user with Clerk ID
          // Note: We'd need to add an updateUser method to DatabaseService
          console.log('✅ Found existing user by email:', user.id)
        }
      }
      
      return user
    } catch (error) {
      console.error('❌ Error getting/creating user:', error)
      throw error
    }
  }

  /**
   * Get user ID from request (for authenticated routes)
   */
  static async getUserIdFromRequest(req: any): Promise<string | null> {
    try {
      // This assumes you have Clerk middleware that adds user to req
      const clerkUser = req.auth?.userId
      
      if (!clerkUser) {
        return null
      }

      const user = await DatabaseService.getUserByClerkId(clerkUser)
      return user?.id || null
    } catch (error) {
      console.error('❌ Error getting user ID from request:', error)
      return null
    }
  }

  /**
   * Check if user owns a module
   */
  static async userOwnsModule(userId: string, moduleId: string): Promise<boolean> {
    try {
      const module = await DatabaseService.getModule(moduleId)
      return module?.userId === userId
    } catch (error) {
      console.error('❌ Error checking module ownership:', error)
      return false
    }
  }
} 