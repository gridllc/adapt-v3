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
  }
}; 