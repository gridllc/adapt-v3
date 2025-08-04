#!/usr/bin/env node

import path from 'path'
import fs from 'fs/promises'

console.log('🔍 Debugging Status Service Path...\n')

const moduleId = 'test-module'
const statusPath = path.join(process.cwd(), 'backend', 'data', 'status', `${moduleId}.json`)

console.log('Current working directory:', process.cwd())
console.log('Status path:', statusPath)
console.log('Status path exists:', await fs.access(statusPath).then(() => true).catch(() => false))

// Check if the directory exists
const statusDir = path.dirname(statusPath)
console.log('Status directory:', statusDir)
console.log('Status directory exists:', await fs.access(statusDir).then(() => true).catch(() => false))

// List files in the status directory
try {
  const files = await fs.readdir(statusDir)
  console.log('Files in status directory:', files)
} catch (err) {
  console.log('Error reading status directory:', err.message)
}

// Try to read the file directly
try {
  const content = await fs.readFile(statusPath, 'utf-8')
  console.log('File content:', content)
} catch (err) {
  console.log('Error reading file:', err.message)
} 