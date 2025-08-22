import { prisma } from '../config/database.js';

export const UserService = {
  // Get or create a user from Clerk ID
  async getOrCreateClerkUser(clerkUserId: string, email?: string) {
    try {
      // First try to find existing user
      let user = await prisma.user.findUnique({
        where: { id: clerkUserId }
      });

      // If not found, create one
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: clerkUserId,
            email: email || `user-${clerkUserId}@clerk.local`,
            clerkId: clerkUserId, // Keep for backward compatibility
          }
        });
      }

      return user;
    } catch (error) {
      console.error('Failed to get or create Clerk user:', error);
      throw error;
    }
  },

  // Get user by Clerk ID
  async getByClerkId(clerkUserId: string) {
    return prisma.user.findUnique({
      where: { id: clerkUserId }
    });
  },

  // Update user email if needed
  async updateEmail(clerkUserId: string, email: string) {
    return prisma.user.update({
      where: { id: clerkUserId },
      data: { email }
    });
  },

  // Get user ID from request (for authenticated routes)
  async getUserIdFromRequest(req: any): Promise<string | null> {
    try {
      // The auth middleware adds userId to the request
      if (req.userId) {
        return req.userId;
      }
      
      // Fallback to Clerk user ID if available
      const clerkUser = req.auth?.userId;
      
      if (!clerkUser) {
        return null;
      }

      const user = await this.getByClerkId(clerkUser);
      return user?.id || null;
    } catch (error) {
      console.error('❌ Error getting user ID from request:', error);
      return null;
    }
  },

  // Check if user owns a module
  async userOwnsModule(userId: string, moduleId: string): Promise<boolean> {
    try {
      const module = await prisma.module.findUnique({
        where: { id: moduleId }
      });
      return module?.userId === userId;
    } catch (error) {
      console.error('❌ Error checking module ownership:', error);
      return false;
    }
  }
}; 