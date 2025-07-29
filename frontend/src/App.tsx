import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { SignIn, SignUp } from '@clerk/clerk-react'
import { useAuth } from '@features/auth/hooks/useAuth'
import { ProtectedRoute } from '@components/common/ProtectedRoute'
import { Layout } from '@components/common/Layout'
import { HomePage } from '@pages/HomePage'
import { DashboardPage } from '@pages/DashboardPage'
import { TrainingPage } from '@pages/TrainingPage'
import { UploadPage } from '@pages/UploadPage'
import { LoadingSpinner } from '@components/common/LoadingSpinner'

function App() {
  const { isLoaded } = useAuth()

  if (!isLoaded) {
    return <LoadingSpinner />
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/sign-up" element={<SignUp />} />
      
      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/training/:moduleId" element={<TrainingPage />} />
          <Route path="/upload" element={<UploadPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App 