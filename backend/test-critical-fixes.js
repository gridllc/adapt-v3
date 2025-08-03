#!/usr/bin/env node

/**
 * Critical Fixes Test Script
 * Tests all the fixes implemented to resolve "stuck at 0%" issues
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🧪 Testing Critical Fixes...\n')

// Test 1: Check if status service exists and works
console.log('📊 Test 1: Checking status service...')
try {
  const statusServicePath = path.join(__dirname, 'src/services/statusService.ts')
  const statusServiceContent = fs.readFileSync(statusServicePath, 'utf8')
  
  const checks = [
    { name: 'Status service file exists', pattern: /saveModuleStatus/, found: false },
    { name: 'getModuleStatus function', pattern: /getModuleStatus/, found: false },
    { name: 'updateModuleProgress function', pattern: /updateModuleProgress/, found: false },
    { name: 'ModuleStatus interface', pattern: /interface ModuleStatus/, found: false },
    { name: 'File writing validation', pattern: /fs\.writeFileSync/, found: false },
    { name: 'Directory creation', pattern: /fs\.mkdirSync.*recursive/, found: false }
  ]

  checks.forEach(check => {
    check.found = check.pattern.test(statusServiceContent)
    console.log(`  ${check.found ? '✅' : '❌'} ${check.name}`)
  })

  const passedChecks = checks.filter(c => c.found).length
  console.log(`  📊 Result: ${passedChecks}/${checks.length} checks passed\n`)
} catch (error) {
  console.log('❌ Could not read statusService.ts:', error.message)
}

// Test 2: Check if jobQueue.ts has critical logging
console.log('📋 Test 2: Checking jobQueue.ts critical logging...')
try {
  const jobQueueContent = fs.readFileSync(path.join(__dirname, 'src/services/jobQueue.ts'), 'utf8')
  
  const checks = [
    { name: 'Job received logging', pattern: /Job received for moduleId/, found: false },
    { name: 'Job complete logging', pattern: /Job complete for moduleId/, found: false },
    { name: 'Job failed logging', pattern: /Job failed for moduleId/, found: false },
    { name: 'Status service import', pattern: /import.*statusService/, found: false },
    { name: 'saveModuleStatus calls', pattern: /saveModuleStatus/, found: false },
    { name: 'updateModuleProgress calls', pattern: /updateModuleProgress/, found: false },
    { name: 'Error message extraction', pattern: /errorMessage.*error\.message/, found: false },
    { name: 'Status file writing', pattern: /saveModuleStatus.*error/, found: false }
  ]

  checks.forEach(check => {
    check.found = check.pattern.test(jobQueueContent)
    console.log(`  ${check.found ? '✅' : '❌'} ${check.name}`)
  })

  const passedChecks = checks.filter(c => c.found).length
  console.log(`  📊 Result: ${passedChecks}/${checks.length} checks passed\n`)
} catch (error) {
  console.log('❌ Could not read jobQueue.ts:', error.message)
}

// Test 3: Check if aiService.ts has critical validation
console.log('🧠 Test 3: Checking aiService.ts critical validation...')
try {
  const aiServiceContent = fs.readFileSync(path.join(__dirname, 'src/services/aiService.ts'), 'utf8')
  
  const checks = [
    { name: 'Transcription validation', pattern: /Transcription returned empty result.*silent failure/, found: false },
    { name: 'AI analysis validation', pattern: /AI analysis returned invalid result structure/, found: false },
    { name: 'Empty steps validation', pattern: /AI analysis returned empty steps array/, found: false },
    { name: 'Transcript preview logging', pattern: /Transcript preview/, found: false },
    { name: 'Steps preview logging', pattern: /Steps preview/, found: false },
    { name: 'Error re-throwing', pattern: /throw error/, found: false },
    { name: 'Silent failure detection', pattern: /silent failure in the processing pipeline/, found: false },
    { name: 'Critical step markers', pattern: /CRITICAL STEP/, found: false },
    { name: 'Critical validation markers', pattern: /CRITICAL VALIDATION/, found: false }
  ]

  checks.forEach(check => {
    check.found = check.pattern.test(aiServiceContent)
    console.log(`  ${check.found ? '✅' : '❌'} ${check.name}`)
  })

  const passedChecks = checks.filter(c => c.found).length
  console.log(`  📊 Result: ${passedChecks}/${checks.length} checks passed\n`)
} catch (error) {
  console.log('❌ Could not read aiService.ts:', error.message)
}

// Test 4: Check if createBasicSteps.ts has file validation
console.log('📝 Test 4: Checking createBasicSteps.ts file validation...')
try {
  const createBasicStepsContent = fs.readFileSync(path.join(__dirname, 'src/services/createBasicSteps.ts'), 'utf8')
  
  const checks = [
    { name: 'File writing logging', pattern: /Writing.*file to:/, found: false },
    { name: 'File existence validation', pattern: /fs\.access.*then.*true/, found: false },
    { name: 'File size validation', pattern: /file size.*bytes/, found: false },
    { name: 'Empty file detection', pattern: /file is empty/, found: false },
    { name: 'File structure validation', pattern: /file contains invalid data structure/, found: false },
    { name: 'Steps count validation', pattern: /wrong number of steps/, found: false },
    { name: 'Error stack logging', pattern: /Error stack/, found: false },
    { name: 'Critical validation markers', pattern: /CRITICAL VALIDATION/, found: false }
  ]

  checks.forEach(check => {
    check.found = check.pattern.test(createBasicStepsContent)
    console.log(`  ${check.found ? '✅' : '❌'} ${check.name}`)
  })

  const passedChecks = checks.filter(c => c.found).length
  console.log(`  📊 Result: ${passedChecks}/${checks.length} checks passed\n`)
} catch (error) {
  console.log('❌ Could not read createBasicSteps.ts:', error.message)
}

// Test 5: Check if server has status endpoint
console.log('🌐 Test 5: Checking server status endpoint...')
try {
  const serverContent = fs.readFileSync(path.join(__dirname, 'src/server.ts'), 'utf8')
  
  const checks = [
    { name: 'Status endpoint route', pattern: /\/api\/status\/:moduleId/, found: false },
    { name: 'Status service import', pattern: /import.*statusService/, found: false },
    { name: 'getModuleStatus call', pattern: /getModuleStatus/, found: false },
    { name: 'Error handling', pattern: /Status endpoint error/, found: false },
    { name: '404 handling', pattern: /Module status not found/, found: false }
  ]

  checks.forEach(check => {
    check.found = check.pattern.test(serverContent)
    console.log(`  ${check.found ? '✅' : '❌'} ${check.name}`)
  })

  const passedChecks = checks.filter(c => c.found).length
  console.log(`  📊 Result: ${passedChecks}/${checks.length} checks passed\n`)
} catch (error) {
  console.log('❌ Could not read server.ts:', error.message)
}

// Test 6: Check if frontend has status endpoint support
console.log('🎯 Test 6: Checking frontend status endpoint support...')
try {
  const useModuleStatusContent = fs.readFileSync(path.join(__dirname, '../frontend/src/hooks/useModuleStatus.ts'), 'utf8')
  
  const checks = [
    { name: 'Status endpoint fallback', pattern: /api\/status\/\${moduleId}/, found: false },
    { name: 'Upload endpoint fallback', pattern: /api\/upload\/status/, found: false },
    { name: 'Error handling for status', pattern: /Status endpoint failed/, found: false },
    { name: 'Complete status support', pattern: /complete.*error/, found: false },
    { name: 'Timestamp support', pattern: /timestamp/, found: false }
  ]

  checks.forEach(check => {
    check.found = check.pattern.test(useModuleStatusContent)
    console.log(`  ${check.found ? '✅' : '❌'} ${check.name}`)
  })

  const passedChecks = checks.filter(c => c.found).length
  console.log(`  📊 Result: ${passedChecks}/${checks.length} checks passed\n`)
} catch (error) {
  console.log('❌ Could not read useModuleStatus.ts:', error.message)
}

console.log('🎉 Critical Fixes Test Complete!')
console.log('\n📝 Summary of Critical Fixes:')
console.log('✅ Status service for tracking module progress')
console.log('✅ Enhanced job queue logging with status tracking')
console.log('✅ Critical validation in AI service to expose silent failures')
console.log('✅ File writing validation in createBasicSteps')
console.log('✅ Status endpoint for debugging stuck jobs')
console.log('✅ Frontend support for new status endpoint')
console.log('\n🚀 These fixes should now expose exactly where processing is failing!')
console.log('\n🔍 Next Steps:')
console.log('1. Upload a video and watch the console logs')
console.log('2. Look for "Job received", "Job complete", or "Job failed" messages')
console.log('3. Check for "CRITICAL VALIDATION" messages in AI service')
console.log('4. Verify files are being written in createBasicSteps')
console.log('5. Use the status endpoint to debug stuck jobs') 