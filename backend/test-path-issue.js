// Test to check path issues
async function testPathIssue() {
  console.log('🧪 Testing path issues...')
  
  try {
    const fs = await import('fs')
    const path = await import('path')
    
    console.log('📁 Current working directory:', process.cwd())
    console.log('📁 __dirname equivalent:', path.dirname(new URL(import.meta.url).pathname))
    
    // Test different path combinations
    const paths = [
      path.join(process.cwd(), 'backend', 'uploads', 'temp', 'test-123'),
      path.join(process.cwd(), 'uploads', 'temp', 'test-123'),
      path.join(process.cwd(), 'backend', 'uploads'),
      path.join(process.cwd(), 'uploads'),
    ]
    
    paths.forEach((p, i) => {
      console.log(`📁 Path ${i}: ${p}`)
      console.log(`📁 Exists: ${fs.existsSync(p)}`)
    })
    
    // Test file operations
    const testDir = path.join(process.cwd(), 'backend', 'uploads', 'temp', 'test-123')
    const testFile = path.join(testDir, 'test.txt')
    
    try {
      await fs.promises.mkdir(testDir, { recursive: true })
      console.log('✅ Created test directory')
      
      await fs.promises.writeFile(testFile, 'test data')
      console.log('✅ Created test file')
      
      const content = await fs.promises.readFile(testFile, 'utf8')
      console.log('✅ Read test file:', content)
      
      await fs.promises.unlink(testFile)
      await fs.promises.rmdir(testDir)
      console.log('✅ Cleaned up test files')
      
    } catch (error) {
      console.log('❌ File operation failed:', error.message)
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message)
  }
}

testPathIssue() 