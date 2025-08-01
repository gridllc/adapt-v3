import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { ProtectedRoute } from '@components/common/ProtectedRoute'
import { Layout } from '@components/common/Layout'
import { CenteredSignIn } from '@components/common/CenteredSignIn'
import { CenteredSignUp } from '@components/common/CenteredSignUp'
import { HomePage } from '@pages/HomePage'
import { DashboardPage } from '@pages/DashboardPage'
import { TrainingPage } from '@pages/TrainingPage'
import { UploadPage } from '@pages/UploadPage'
import EditStepsPage from '@pages/EditStepsPage'
import { ApiDebug } from '@components/ApiDebug'

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
    <>
      {/* Debug panel temporarily disabled */}
      {/* <ApiDebug /> */}
      
      <Routes>
      {/* Always show home page at root */}
      <Route path="/" element={<HomePage />} />
      
      {/* Clerk authentication routes */}
      <Route path="/sign-in/*" element={<CenteredSignIn />} />
      <Route path="/sign-up/*" element={<CenteredSignUp />} />
      <Route path="/sso-callback" element={<div>Loading...</div>} />

             {/* Protected routes */}
       <Route element={<ProtectedRoute />}>
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
             <UploadPage />
           </Layout>
         }
       />
       <Route
         path="/training/:moduleId"
         element={
           <Layout>
             <TrainingPage />
           </Layout>
         }
       />
      
      {/* Catch-all route for unknown paths */}
      <Route path="*" element={<HomePage />} />
    </Routes>
    </>
  )
}

export default App 