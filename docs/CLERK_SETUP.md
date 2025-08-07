# Clerk Authentication Setup

## Environment Variables

### Frontend (.env)
```bash
# Clerk Authentication (Required)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-publishable-key-here

# Alternative environment variable name (for Next.js compatibility)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-publishable-key-here

# API Configuration
VITE_API_BASE_URL=http://localhost:8000

# Development Configuration
VITE_DEV_MODE=true
```

### Backend (.env)
```bash
# Authentication (Required)
CLERK_SECRET_KEY=sk_test_your-clerk-secret-key-here
FRONTEND_URL=http://localhost:3000
```

## Current Integration Status

✅ **Already Implemented:**

1. **ClerkProvider** - Wrapped in `main.tsx` with proper configuration
2. **SignIn/SignUp Components** - Custom styled components in `CenteredSignIn.tsx` and `CenteredSignUp.tsx`
3. **Navigation Integration** - Updated `Navigation.tsx` with conditional SignInButton/UserButton
4. **Protected Routes** - Using `ProtectedRoute.tsx` with Clerk's `useAuth`
5. **Custom Auth Hook** - `useAuth.ts` properly wraps Clerk's authentication
6. **HomePage Integration** - Conditional rendering based on auth state

## Usage Examples

### Basic Sign In/Out Components
```tsx
import { SignInButton, UserButton, useAuth } from '@clerk/clerk-react'

const Header = () => {
  const { isSignedIn } = useAuth()
  
  return (
    <header>
      {isSignedIn ? (
        <UserButton afterSignOutUrl="/" />
      ) : (
        <SignInButton mode="modal">
          <button className="bg-blue-600 text-white px-4 py-2 rounded">
            Sign In
          </button>
        </SignInButton>
      )}
    </header>
  )
}
```

### Protected Routes
```tsx
import { useAuth } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'

const ProtectedRoute = ({ children }) => {
  const { isLoaded, isSignedIn } = useAuth()
  
  if (!isLoaded) return <div>Loading...</div>
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  
  return children
}
```

### Custom Auth Hook
```tsx
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react'

export const useAuth = () => {
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { user } = useUser()

  return {
    isLoaded,
    isSignedIn,
    user,
  }
}
```

## Key Features

1. **Modal Sign-In**: Uses `mode="modal"` for seamless UX
2. **Automatic Redirects**: Configured in `ClerkProvider` with `afterSignInUrl` and `afterSignUpUrl`
3. **Error Handling**: Configuration error component for missing keys
4. **Development Mode**: Fallback for when Clerk isn't configured
5. **Responsive Design**: Works on mobile and desktop
6. **Custom Styling**: Tailwind CSS integration with Clerk's appearance API

## Next Steps

1. Set up your Clerk account and get your publishable/secret keys
2. Add the environment variables to your `.env` files
3. Test the authentication flow
4. Customize the appearance using Clerk's appearance API if needed
