// Clerk types for global window object
declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken(): Promise<string | null>;
        id?: string;
        userId?: string;
      };
      user?: {
        id: string;
        emailAddresses?: Array<{ emailAddress: string }>;
        firstName?: string;
        lastName?: string;
      };
      isReady?: boolean;
    };
  }
}

export {};
