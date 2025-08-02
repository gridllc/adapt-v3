// Test to simulate file size issue
function testFileSizes() {
  console.log('🧪 Testing file size calculations...')
  
  // Simulate different file sizes
  const fileSizes = [
    1024, // 1KB
    1024 * 1024, // 1MB
    2 * 1024 * 1024, // 2MB
    5 * 1024 * 1024, // 5MB
    10 * 1024 * 1024, // 10MB
  ]
  
  const chunkSize = 2 * 1024 * 1024 // 2MB
  
  fileSizes.forEach(size => {
    const chunks = Math.ceil(size / chunkSize)
    const totalChunks = Math.max(1, chunks) // Ensure at least 1 chunk
    
    console.log(`📦 File size: ${(size / 1024 / 1024).toFixed(2)} MB`)
    console.log(`📦 Chunks calculated: ${chunks}`)
    console.log(`📦 Total chunks (with min 1): ${totalChunks}`)
    console.log('---')
  })
  
  // Test the createChunks logic
  console.log('🔍 Testing createChunks logic...')
  
  // Simulate a small file (less than 2MB)
  const smallFileSize = 500 * 1024 // 500KB
  const smallChunks = Math.ceil(smallFileSize / chunkSize)
  console.log(`📦 Small file (${(smallFileSize / 1024).toFixed(2)} KB): ${smallChunks} chunks`)
  
  // Simulate an empty file
  const emptyFileSize = 0
  const emptyChunks = Math.ceil(emptyFileSize / chunkSize)
  console.log(`📦 Empty file: ${emptyChunks} chunks`)
  
  // Simulate a file exactly 2MB
  const exactFileSize = 2 * 1024 * 1024
  const exactChunks = Math.ceil(exactFileSize / chunkSize)
  console.log(`📦 Exact 2MB file: ${exactChunks} chunks`)
}

testFileSizes() 