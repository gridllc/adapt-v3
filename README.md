# Adapt v3 - AI-Powered Interactive Training Platform

## 🎯 Overview

Adapt is an AI-powered interactive training platform where users learn how to complete real-world tasks by watching videos, following timestamped steps, and talking to an AI tutor that answers questions in real-time using context from the training.

## 🚀 Features

- **AI-Powered Video Analysis**: Automatically extracts steps from training videos
- **Interactive Chat**: Real-time AI assistance during training
- **Fallback System**: Gemini → OpenAI → Human support
- **Mobile-First**: Responsive design for all devices
- **Secure Upload**: Production-ready file upload with validation
- **No Emulators**: Simple development setup

## 📁 Project Structure

```
adapt-v3/
├── frontend/          # React + Vite + TypeScript
├── backend/           # Express + Node.js + TypeScript
├── shared/            # Shared types and utilities
├── database/          # Database migrations and seeds
├── docs/             # Documentation
└── tests/            # Test suites
```

## 🛠️ Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- AWS S3 bucket (for file storage)
- Clerk account (for authentication)
- Gemini API key
- OpenAI API key

### 1. Clone and Setup

```bash
git clone <repository-url>
cd adapt-v3
```

### 2. Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

### 3. Environment Setup

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

### 4. Start Development

```bash
# Terminal 1 - Frontend
cd frontend
npm run dev

# Terminal 2 - Backend
cd backend
npm run dev
```

Visit `http://localhost:3000` to see the app!

## 🔧 Development

### Frontend

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Authentication**: Clerk
- **Routing**: React Router

### Backend

- **Framework**: Express.js + TypeScript
- **AI Services**: Gemini + OpenAI (with fallback)
- **File Storage**: AWS S3
- **Authentication**: Clerk webhooks
- **Validation**: Zod

## 📱 Key Components

### Upload System
- Drag & drop video upload
- File validation (type, size, duration)
- Progress tracking with retry logic
- Error handling and categorization

### AI Integration
- Gemini for primary AI processing
- OpenAI as fallback
- Context-aware chat responses
- Video analysis and step extraction

### Training Interface
- Video player with step synchronization
- Real-time AI chat assistance
- Progress tracking
- Mobile-responsive design

## 🚀 Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
# Deploy to Vercel
```

### Backend (Railway/Render)
```bash
cd backend
npm run build
# Deploy to Railway or Render
```

## 🧪 Testing

```bash
# Frontend tests
cd frontend
npm test

# Backend tests
cd backend
npm test
```

## 📚 API Documentation

### Upload Endpoint
```
POST /api/upload
Content-Type: multipart/form-data

Response: {
  success: boolean,
  moduleId: string,
  videoUrl: string,
  steps: Step[]
}
```

### Chat Endpoint
```
POST /api/ai/chat
Content-Type: application/json

Body: {
  message: string,
  context: object
}

Response: {
  response: string
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details 