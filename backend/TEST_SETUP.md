# 🧪 Testing Setup Guide

## Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Copy test environment config
cp env.test.example .env.test

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Structure

```
src/__tests__/
├── setup.ts                 # Global test configuration
├── unit/                    # Unit tests for individual modules
│   ├── moduleService.test.ts
│   └── ...
└── integration/             # Integration tests for API endpoints
    ├── upload.test.ts
    └── ...
```

## What We're Testing

### ✅ **Critical Upload Flow**
- Presigned URL generation (`/api/upload/init`)
- Upload completion notification (`/api/upload/complete`)
- File validation (type, size)
- Processing pipeline initiation

### ✅ **Module Management**
- Module creation and status tracking
- Database interactions
- Error handling and fallbacks

### ✅ **Security & Validation**
- Input validation with Zod schemas
- Rate limiting functionality
- Authentication middleware

## Running Individual Tests

```bash
# Run specific test file
npx jest upload.test.ts

# Run tests matching pattern
npx jest --testNamePattern="upload"

# Run with debug output
npx jest --verbose
```

## Test Database Setup

For integration tests that need a database:

1. **Create test database:**
   ```sql
   CREATE DATABASE adapt_v3_test;
   ```

2. **Update `.env.test`:**
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/adapt_v3_test"
   ```

3. **Run migrations:**
   ```bash
   NODE_ENV=test npx prisma migrate deploy
   ```

## Mocking Strategy

- **External APIs**: OpenAI, Clerk, AWS S3 are mocked
- **Database**: Uses test database or in-memory SQLite
- **File System**: Temporary directories for test files
- **Time**: Consistent timestamps for reproducible tests

## Coverage Goals

- **Critical paths**: 90%+ coverage
- **Upload flow**: 100% coverage
- **Security middleware**: 95%+ coverage
- **Error handling**: 85%+ coverage

## CI Integration

Tests run automatically on:
- Pull requests
- Main branch pushes
- Nightly builds

## Debugging Tests

```bash
# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand upload.test.ts

# Run with maximum debug output
DEBUG=* npm test

# Test specific function
npx jest --testNamePattern="should generate presigned URL"
```

## Performance Testing

```bash
# Run performance benchmarks
npm run test:performance

# Memory leak detection
npm run test:memory
```

## Next Steps

1. **Add E2E Tests**: Frontend integration with Playwright
2. **Load Testing**: Stress test upload pipeline with Artillery
3. **Visual Regression**: Screenshot testing for UI components
4. **Security Scanning**: Automated vulnerability detection
