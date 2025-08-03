import fs from 'fs'
import path from 'path'

// Test the complete upload flow
async function testUploadFlow() {
  console.log('🧪 Testing complete upload flow...')
  
  // Check if backend is running
  try {
    const response = await fetch('http://localhost:8000/api/health')
    if (response.ok) {
      console.log('✅ Backend is running')
    } else {
      console.log('❌ Backend health check failed')
      return
    }
  } catch (error) {
    console.log('❌ Backend is not running:', error.message)
    return
  }
  
  // Check uploads directory
  const uploadsDir = path.join(process.cwd(), 'uploads')
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir)
    console.log(`📁 Uploads directory contains ${files.length} files:`, files)
  } else {
    console.log('❌ Uploads directory not found')
  }
  
  // Check data directories
  const dataDir = path.join(process.cwd(), 'backend', 'src', 'data')
  if (fs.existsSync(dataDir)) {
    const subdirs = fs.readdirSync(dataDir)
    console.log(`📁 Data directory contains:`, subdirs)
    
    for (const subdir of subdirs) {
      const subdirPath = path.join(dataDir, subdir)
      if (fs.statSync(subdirPath).isDirectory()) {
        const files = fs.readdirSync(subdirPath)
        console.log(`  📁 ${subdir}: ${files.length} files`)
      }
    }
  } else {
    console.log('❌ Data directory not found')
  }
  
  console.log('🧪 Test completed')
}

testUploadFlow().catch(console.error) 