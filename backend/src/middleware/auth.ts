import { requireAuth, getAuth } from "@clerk/express";

// Re-export the Clerk middleware for backward compatibility
export { requireAuth };

// Custom auth middleware that returns JSON errors instead of redirects
export const mustBeAuthed = (req: any, res: any, next: any) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      console.log('❌ [AUTH] No userId found in request')
      return res.status(401).json({ 
        success: false, 
        error: 'authentication_required',
        message: 'You must be signed in to access this resource'
      });
    }
    console.log('✅ [AUTH] User authenticated:', userId)
    next();
  } catch (error: any) {
    console.error('❌ [AUTH] Authentication error:', error.message)
    return res.status(401).json({ 
      success: false, 
      error: 'authentication_failed',
      message: 'Authentication failed'
    });
  }
};

export function currentUserId(req: any): string {
  const { userId } = getAuth(req);
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  return userId;
}

export function authorizeModule(ownerId: string, userId: string): void {
  if (ownerId !== userId) {
    const error = new Error("Forbidden");
    (error as any).status = 403;
    throw error;
  }
}

export function optionalAuth(req: any): string | null {
  try {
    const { userId } = getAuth(req);
    return userId || null;
  } catch {
    return null;
  }
} 