import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { SignIn, SignUp } from '@clerk/clerk-react'
import { ProtectedRoute } from '@components/common/ProtectedRoute'
import { Layout } from '@components/common/Layout'
import { HomePage } from '@pages/HomePage'
import { DashboardPage } from '@pages/DashboardPage'
import { TrainingPage } from '@pages/TrainingPage'
import { UploadPage } from '@pages/UploadPage'
import EditStepsPage from '@pages/EditStepsPage'
import SharePage from '@pages/SharePage'
import DebugPage from '@pages/DebugPage'
import { SignInPage } from '@pages/SignInPage'
import { SignUpPage } from '@pages/SignUpPage'
import { ApiDebug } from '@components/ApiDebug'
import { GlobalErrorBoundary, NavigationErrorBoundary, UploadErrorBoundary } from '@components/common/ErrorBoundaries'

// Conditional Home Component
const ConditionalHome = () => {
  const { isSignedIn, isLoaded } = useAuth()
  
  // Debug logging
  console.log('🔍 ConditionalHome Debug:')
  console.log('🔐 isSignedIn:', isSignedIn)
  console.log('📦 isLoaded:', isLoaded)
  console.log('🌐 Current URL:', window.location.href)
  
  if (!isLoaded) {
    return <div>Loading...</div>
  }
  
  // For testing: allow direct access to dashboard if URL contains 'test'
  if (window.location.search.includes('test=true') || window.location.search.includes('bypass=true')) {
    console.log('🔧 Test mode enabled, bypassing auth')
    return (
      <Layout>
        <DashboardPage />
      </Layout>
    )
  }
  
  if (isSignedIn) {
    return (
      <Layout>
        <DashboardPage />
      </Layout>
    )
  }
  
  return <HomePage />
}

function App() {
  return (
    <GlobalErrorBoundary>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<ConditionalHome />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Layout><DashboardPage /></Layout>} />
          <Route path="/upload" element={<Layout><UploadPage /></Layout>} />
          <Route path="/training/:moduleId" element={<Layout><TrainingPage /></Layout>} />
          <Route path="/edit/:moduleId" element={<Layout><EditStepsPage /></Layout>} />
          <Route path="/share/:moduleId" element={<Layout><SharePage /></Layout>} />
          <Route path="/debug" element={<Layout><DebugPage /></Layout>} />
        </Route>
        
        {/* Error Boundaries */}
        <Route path="*" element={<NavigationErrorBoundary />} />
      </Routes>
    </GlobalErrorBoundary>
  )
}

export default App 