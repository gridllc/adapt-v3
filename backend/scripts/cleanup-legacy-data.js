#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Paths to clean up
const dataDir = path.join(__dirname, '../src/data')
const uploadsDir = path.join(__dirname, '../uploads')

console.log('🧹 Cleaning up legacy data files...')

// Function to safely remove directory
function removeDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    console.log(`🗑️ Removing directory: ${dirPath}`)
    fs.rmSync(dirPath, { recursive: true, force: true })
    console.log(`✅ Removed: ${dirPath}`)
  } else {
    console.log(`⚠️ Directory not found: ${dirPath}`)
  }
}

// Function to safely remove file
function removeFile(filePath) {
  if (fs.existsSync(filePath)) {
    console.log(`🗑️ Removing file: ${filePath}`)
    fs.unlinkSync(filePath)
    console.log(`✅ Removed: ${filePath}`)
  } else {
    console.log(`⚠️ File not found: ${filePath}`)
  }
}

try {
  // Remove legacy data directory
  removeDirectory(dataDir)
  
  // Remove uploads directory (optional - keep for development fallback)
  console.log('\n📁 Uploads directory cleanup:')
  console.log('   This directory is kept for development fallback')
  console.log('   Files will be cleaned up automatically by the new storage service')
  
  console.log('\n✅ Legacy data cleanup completed!')
  console.log('\n📋 Summary:')
  console.log('   - Removed: backend/src/data/ (legacy JSON files)')
  console.log('   - Kept: backend/uploads/ (development fallback)')
  console.log('   - New storage: S3 + PostgreSQL only')
  
} catch (error) {
  console.error('❌ Cleanup failed:', error)
  process.exit(1)
} 