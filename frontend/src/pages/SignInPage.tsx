import { SignIn } from '@clerk/clerk-react'

export default function SignInPage() {
  return (
    <div className="flex justify-center mt-20">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
    </div>
  )
}