// Global test setup
import dotenv from 'dotenv'

// Load test environment variables
dotenv.config({ path: '.env.test' })

// Setup test database cleanup
beforeEach(() => {
  // Clear all mocks before each test
  if (typeof jest !== 'undefined') {
    jest.clearAllMocks()
  }
})

afterEach(() => {
  // Clean up any test data if needed
})
