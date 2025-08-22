import { requireAuth, getAuth } from "@clerk/express";

// Re-export the Clerk middleware for backward compatibility
export { requireAuth };

export const mustBeAuthed = requireAuth();

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