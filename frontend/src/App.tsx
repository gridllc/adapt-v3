import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { SignIn, SignUp } from '@clerk/clerk-react'
import { ProtectedRoute } from '@components/common/ProtectedRoute'
import { Layout } from '@components/common/Layout'
import { HomePage } from '@pages/HomePage'
import { DashboardPage } from '@pages/DashboardPage'
import TrainingPage from '@pages/TrainingPage'
import { UploadPage } from '@pages/UploadPage'
import EditStepsPage from '@pages/EditStepsPage'
import SharePage from '@pages/SharePage'
import DebugPage from '@pages/DebugPage'
import { SignInPage } from '@pages/SignInPage'
import { SignUpPage } from '@pages/SignUpPage'
import { ApiDebug } from '@components/ApiDebug'
import { GlobalErrorBoundary, NavigationErrorBoundary, UploadErrorBoundary } from '@components/common/ErrorBoundaries'
import { LoadingSpinner } from '@components/common/LoadingSpinner'

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
      {/* Debug panel temporarily disabled */}
      {/* <ApiDebug /> */}
      
      {/* TEMPORARY: Test spinner visibility - remove this after testing */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 right-4 z-50 bg-white p-4 border rounded-lg shadow-lg">
          <p className="text-sm text-gray-600 mb-2">Test Spinner:</p>
          <LoadingSpinner />
        </div>
      )}
      
      <Routes>
        {/* Always show home page at root */}
        <Route path="/" element={<HomePage />} />
        
        {/* Clerk authentication routes - using path-based routing */}
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route path="/sso-callback" element={<div>Loading...</div>} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/dashboard"
            element={
              <Layout>
                <DashboardPage />
              </Layout>
            }
          />
          <Route
            path="/upload"
            element={
              <Layout>
                <UploadErrorBoundary>
                  <UploadPage />
                </UploadErrorBoundary>
              </Layout>
            }
          />
          <Route
            path="/edit-steps/:moduleId"
            element={
              <Layout>
                <EditStepsPage />
              </Layout>
            }
          />
        </Route>
        
        {/* Public routes for development - NO AUTH REQUIRED */}
        <Route
          path="/training/:moduleId"
          element={
            <Layout>
              <TrainingPage />
            </Layout>
          }
        />
        
        {/* Test route for spinner debugging */}
        <Route
          path="/test-spinner"
          element={
            <div className="min-h-screen bg-gray-100 p-8">
              <h1 className="text-2xl font-bold mb-4">Spinner Test Page</h1>
              <p className="mb-4">This page tests the LoadingSpinner component in isolation.</p>
              <LoadingSpinner />
            </div>
          }
        />
      
       {/* Debug page for development/testing - NO AUTH REQUIRED */}
       <Route
         path="/debug"
         element={
           <Layout>
             <DebugPage />
           </Layout>
         }
       />
       
       {/* Public share route - NO AUTH REQUIRED */}
       <Route
         path="/share/:moduleId"
         element={<SharePage />}
       />
      
      {/* Catch-all route for unknown paths */}
      <Route path="*" element={<HomePage />} />
    </Routes>
    </GlobalErrorBoundary>
  )
}

export default App 