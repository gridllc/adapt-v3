# 🛠️ Development Guide - Adapt v3

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Setup
```bash
# Clone repository
git clone <repository-url>
cd adapt-v3

# Install dependencies
npm run install:all

# Start development servers
npm run dev
```

## 📁 Project Structure

```
adapt-v3/
├── frontend/                 # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   ├── stores/         # Zustand stores
│   │   ├── services/       # API services
│   │   ├── utils/          # Utilities
│   │   └── types/          # TypeScript types
│   ├── public/             # Static assets
│   └── package.json
├── backend/                 # Express + TypeScript
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── services/       # Business logic
│   │   ├── routes/         # Route definitions
│   │   ├── middleware/     # Express middleware
│   │   ├── config/         # Configuration
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utilities
│   ├── prisma/             # Database schema
│   └── package.json
├── shared/                  # Shared types/utilities
├── docs/                   # Documentation
├── scripts/                # Build/deployment scripts
└── tests/                  # Test suites
```

## 🔧 Development Commands

### Root Level
```bash
# Install all dependencies
npm run install:all

# Start both frontend and backend
npm run dev

# Build both projects
npm run build

# Run tests
npm run test

# Clean build artifacts
npm run clean
```

### Frontend
```bash
cd frontend

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Preview production build
npm run preview
```

### Backend
```bash
cd backend

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Database operations
npm run db:push      # Push schema to database
npm run db:generate  # Generate Prisma client
npm run db:studio    # Open Prisma Studio
```

## 🗄️ Database Development

### Prisma Schema
The database schema is defined in `backend/prisma/schema.prisma`:

```prisma
model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  email     String
  name      String?
  modules   Module[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Module {
  id          String   @id @default(cuid())
  title       String
  description String?
  videoUrl    String
  status      String   @default("pending")
  progress    Int      @default(0)
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  steps       Step[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Step {
  id          String   @id @default(cuid())
  title       String
  description String
  timestamp   Int
  duration    Int?
  order       Int
  moduleId    String
  module      Module   @relation(fields: [moduleId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Database Operations
```bash
# Generate Prisma client
npx prisma generate

# Push schema changes to database
npx prisma db push

# Create migration
npx prisma migrate dev --name add_new_field

# Reset database (development only)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

## 🔐 Environment Variables

### Frontend (.env.local)
```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### Backend (.env)
```bash
# Server
NODE_ENV=development
PORT=8000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/adapt_dev"

# Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
USE_REDIS=true

# QStash
QSTASH_TOKEN=your-qstash-token
QSTASH_ENDPOINT=https://qstash.upstash.io/v1/publish
QSTASH_WORKER_URL=http://localhost:8000/api/worker/process-video

# AI Services
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# Google Cloud
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=your-project-id

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_REGION=us-west-1
S3_BUCKET_NAME=your-bucket-name

# Authentication
CLERK_SECRET_KEY=sk_test_...
FRONTEND_URL=http://localhost:3000
```

## 🧪 Testing

### Frontend Testing
```bash
cd frontend

# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Backend Testing
```bash
cd backend

# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run tests in watch mode
npm run test:watch
```

### E2E Testing
```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests in watch mode
npm run test:e2e:watch
```

## 🔍 Debugging

### Frontend Debugging
```bash
# Start with debugging
npm run dev:debug

# Open browser dev tools
# Check console for API configuration logs
```

### Backend Debugging
```bash
# Start with debugging
npm run dev:debug

# Check logs for:
# - Database connection status
# - Redis connection status
# - API request logs
# - Error stack traces
```

### Database Debugging
```bash
# Test database connection
npm run test:db

# Check Prisma client
npx prisma studio

# View database logs
# Check your database client
```

## 📝 Code Style

### TypeScript
- Use strict mode
- Prefer interfaces over types
- Use proper typing for all functions
- Avoid `any` type

### React
- Use functional components with hooks
- Prefer composition over inheritance
- Use proper prop typing
- Implement error boundaries

### Express
- Use async/await for all async operations
- Implement proper error handling
- Use middleware for common functionality
- Validate input data

## 🔄 Git Workflow

### Branch Naming
```
feature/user-authentication
bugfix/api-error-handling
hotfix/security-vulnerability
```

### Commit Messages
```
feat: add user authentication
fix: resolve API error handling
docs: update deployment guide
test: add unit tests for auth service
```

### Pull Request Process
1. Create feature branch
2. Make changes
3. Add tests
4. Update documentation
5. Create pull request
6. Code review
7. Merge to main

## 🚀 Deployment

### Development Deployment
```bash
# Build both projects
npm run build

# Test locally
npm run test

# Deploy to staging
npm run deploy:staging
```

### Production Deployment
```bash
# Build for production
npm run build:prod

# Run production tests
npm run test:prod

# Deploy to production
npm run deploy:prod
```

## 📊 Monitoring

### Development Monitoring
- Check browser console for errors
- Monitor network requests
- Use React DevTools
- Use Redux DevTools (if applicable)

### Production Monitoring
- Set up error tracking (Sentry)
- Monitor API performance
- Track user analytics
- Monitor database performance

## 🔧 Troubleshooting

### Common Issues

#### Frontend Issues
```bash
# Clear cache
rm -rf frontend/node_modules/.vite
rm -rf frontend/dist

# Reinstall dependencies
cd frontend && npm install

# Check for TypeScript errors
npm run type-check
```

#### Backend Issues
```bash
# Clear build artifacts
rm -rf backend/dist
rm -rf backend/node_modules

# Reinstall dependencies
cd backend && npm install

# Check database connection
npm run test:db

# Check Redis connection
npm run test:redis
```

#### Database Issues
```bash
# Reset database (development only)
npx prisma migrate reset

# Regenerate Prisma client
npx prisma generate

# Check schema
npx prisma validate
```

## 📚 Resources

### Documentation
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Express Documentation](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

### Tools
- [Postman](https://www.postman.com/) - API testing
- [Prisma Studio](https://www.prisma.io/studio) - Database GUI
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [Redux DevTools](https://github.com/reduxjs/redux-devtools)

### Services
- [Vercel](https://vercel.com/) - Frontend hosting
- [Render](https://render.com/) - Backend hosting
- [Upstash](https://upstash.com/) - Redis & QStash
- [Clerk](https://clerk.com/) - Authentication 