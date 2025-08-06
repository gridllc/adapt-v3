# 🎯 Adapt v3 - AI-Powered Interactive Training Platform

> **Transform any video into an interactive learning experience with AI-powered step extraction and real-time tutoring.**

## 🚀 Features

- **🎬 AI Video Analysis**: Automatically extracts steps from training videos
- **🤖 Interactive AI Tutor**: Real-time assistance during training sessions
- **📱 Mobile-First Design**: Responsive interface for all devices
- **🔒 Secure Authentication**: Clerk-powered user management
- **⚡ Real-time Processing**: QStash-powered job queuing
- **📊 Progress Tracking**: Monitor learning progress
- **🔄 Fallback System**: Gemini → OpenAI → Human support

## 🏗️ Architecture

```
Frontend (Vercel) ←→ Backend (Render) ←→ Database (PostgreSQL)
     ↓                    ↓                    ↓
  React + Vite      Express + TypeScript   Prisma ORM
  Clerk Auth        QStash Queue          Upstash Redis
  Tailwind CSS      AI Services           AWS S3 Storage
```

## 🛠️ Tech Stack

### Frontend
- **React 18** + TypeScript + Vite
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Clerk** for authentication
- **React Router** for navigation

### Backend
- **Express.js** + TypeScript
- **Prisma** + PostgreSQL (Render)
- **Upstash Redis** for caching
- **QStash** for job queuing
- **AWS S3** for file storage

### AI & Services
- **Gemini API** (primary AI)
- **OpenAI API** (fallback)
- **Google Cloud Speech-to-Text**
- **Render** for hosting
- **Vercel** for frontend

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### 1. Clone & Setup
```bash
git clone <repository-url>
cd adapt-v3

# Install all dependencies
npm run install:all
```

### 2. Environment Configuration

#### Frontend (.env.local)
```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

#### Backend (.env)
```bash
# Core
NODE_ENV=development
PORT=8000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/adapt_dev"

# Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
USE_REDIS=true

# AI Services
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_REGION=us-west-1
S3_BUCKET_NAME=your-bucket-name

# Authentication
CLERK_SECRET_KEY=sk_test_...
FRONTEND_URL=http://localhost:3000
```

### 3. Database Setup
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Open Prisma Studio (optional)
npm run db:studio
```

### 4. Start Development
```bash
# Start both frontend and backend
npm run dev

# Or start individually:
npm run dev:frontend  # Frontend only
npm run dev:backend   # Backend only
```

Visit `http://localhost:3000` to see the app!

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
├── docs/                   # Documentation
│   ├── deployment.md       # Deployment guide
│   ├── api.md             # API documentation
│   └── development.md     # Development guide
├── scripts/                # Build/deployment scripts
├── tests/                  # Test suites
├── shared/                 # Shared types/utilities
└── README.md
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

# Database operations
npm run db:push      # Push schema to database
npm run db:generate  # Generate Prisma client
npm run db:studio    # Open Prisma Studio
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

## 🧪 Testing

### Run All Tests
```bash
npm run test
```

### Frontend Tests
```bash
cd frontend && npm run test
```

### Backend Tests
```bash
cd backend && npm run test
```

### Database Tests
```bash
cd backend && npm run test:db
```

## 🚀 Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
# Deploy to Vercel
```

### Backend (Render)
```bash
cd backend
npm run build
# Deploy to Render
```

See [docs/deployment.md](docs/deployment.md) for detailed deployment instructions.

## 📚 Documentation

- **[Deployment Guide](docs/deployment.md)** - Complete deployment instructions
- **[API Documentation](docs/api.md)** - Full API reference
- **[Development Guide](docs/development.md)** - Development setup and workflow

## 🔍 API Endpoints

### Core Endpoints
- `GET /api/health` - Health check
- `GET /api/modules` - List training modules
- `POST /api/upload` - Upload video for processing
- `POST /api/ai/chat` - AI tutor chat
- `GET /api/steps/:moduleId` - Get module steps

### Worker Endpoints
- `POST /api/worker/process-video` - Process uploaded video
- `GET /api/worker/health` - Worker health check

See [docs/api.md](docs/api.md) for complete API documentation.

## 🗄️ Database Schema

### Core Models
- **User** - User accounts and authentication
- **Module** - Training modules and metadata
- **Step** - Individual training steps with timestamps
- **Feedback** - User feedback and ratings
- **AIInteraction** - AI chat interactions

### Relationships
```
User → Module → Step
User → Feedback
User → AIInteraction
```

## 🔐 Security

- **Authentication**: Clerk-powered user management
- **Authorization**: Role-based access control
- **File Upload**: Secure S3 storage with validation
- **API Security**: Rate limiting and input validation
- **Database**: Prisma ORM with parameterized queries

## 📊 Monitoring

### Health Checks
- Backend: `GET /api/health`
- Worker: `GET /api/worker/health`
- Database: Included in health check

### Logs
- **Render**: View logs in Render dashboard
- **Vercel**: View logs in Vercel dashboard
- **Upstash**: Monitor Redis usage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style
- Use TypeScript for all new code
- Follow existing code style and patterns
- Add tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check [docs/](docs/) for guides
- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions

## 🗺️ Roadmap

### Phase 1: Stabilization
- [ ] Database schema consolidation
- [ ] Security hardening
- [ ] Error handling improvements
- [ ] Performance optimization

### Phase 2: Enhancement
- [ ] Comprehensive testing suite
- [ ] Caching strategy implementation
- [ ] Monitoring and analytics
- [ ] Mobile app development

### Phase 3: Features
- [ ] User progress tracking
- [ ] Content management system
- [ ] Social features
- [ ] Advanced AI capabilities

---

**Built with ❤️ using React, Express, and AI** 