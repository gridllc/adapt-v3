import fs from 'fs'
import path from 'path'

const moduleId = 'module_1754191805341_eavm8isxf'
const videoPath = path.join(process.cwd(), 'uploads', `${moduleId}.mp4`)

console.log('🔍 Path test:')
console.log(`  process.cwd(): ${process.cwd()}`)
console.log(`  videoPath: ${videoPath}`)
console.log(`  file exists: ${fs.existsSync(videoPath)}`)

if (fs.existsSync(videoPath)) {
  const stats = fs.statSync(videoPath)
  console.log(`  file size: ${stats.size} bytes`)
} else {
  console.log('❌ File not found')
  
  // List uploads directory
  const uploadsDir = path.join(process.cwd(), 'uploads')
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir)
    console.log(`  uploads directory contains: ${files.length} files`)
    files.slice(0, 10).forEach(file => console.log(`    ${file}`))
  } else {
    console.log('❌ uploads directory not found')
  }
} 