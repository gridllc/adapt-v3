import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { SignUp, SignIn } from '@clerk/clerk-react'
import { ProtectedRoute } from '@components/common/ProtectedRoute'
import { Layout } from '@components/common/Layout'
import { HomePage } from '@pages/HomePage'
import { DashboardPage } from '@pages/DashboardPage'
import { TrainingPage } from '@pages/TrainingPage'
import { UploadPage } from '@pages/UploadPage'
import EditStepsPage from '@pages/EditStepsPage'
import { ApiDebug } from '@components/ApiDebug'

function App() {
  return (
    <>
      {/* Debug panel temporarily disabled */}
      {/* <ApiDebug /> */}
      
      <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      
      {/* Clerk authentication routes */}
      <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" redirectUrl="/dashboard" />} />
      <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" redirectUrl="/dashboard" />} />
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
          path="/training/:moduleId"
          element={
            <Layout>
              <TrainingPage />
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
          path="/edit-steps/:moduleId"
          element={
            <Layout>
              <EditStepsPage />
            </Layout>
          }
        />
      </Route>
      
      {/* Catch-all route for unknown paths */}
      <Route path="*" element={<HomePage />} />
    </Routes>
    </>
  )
}

export default App 