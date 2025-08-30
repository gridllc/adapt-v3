# Adapt V3 Development Setup

This guide helps you set up and manage your local development environment with automatic port conflict resolution.

## 🚀 Quick Start

### Option 1: Automatic Port Management (Recommended)
```bash
# Linux/Mac
./dev-setup.sh

# Windows
dev-setup.bat
```

This script automatically:
- Checks for available ports
- Finds next available ports if defaults are busy
- Starts both frontend and backend with correct proxy configuration
- Displays the URLs where services are running

### Option 2: Manual Commands

#### Start Backend
```bash
cd backend
npm run dev              # Uses port 8000
npm run dev:port         # Uses port 8001
npm run dev:next         # Tries 8001, then 8002 if needed
```

#### Start Frontend
```bash
cd frontend
npm run dev              # Uses port 5173, auto-finds next if busy
npm run dev:port         # Uses port 5174
npm run dev:next         # Tries 5174, then 5175, then 5176
```

## 🔧 Environment Variables

### Frontend
- `FRONTEND_PORT`: Override default port (5173)
- `BACKEND_URL`: Override backend URL for proxy

### Backend
- `BACKEND_PORT`: Override default port (8000)

## 📊 Port Checking

Check which ports are available:

```bash
# In frontend directory
npm run check-ports

# In backend directory
npm run check-ports
```

## 🐛 Troubleshooting Port Conflicts

### Problem: "Port already in use"
**Solution**: The system automatically finds the next available port. Vite does this by default with `strictPort: false`.

### Problem: Proxy not working with custom ports
**Solution**: The scripts automatically set the correct `BACKEND_URL` environment variable.

### Problem: Services can't communicate
**Solution**: Check that both services are using the same backend port.

## 🛠️ Manual Port Management

If you need to run specific ports:

```bash
# Backend on port 8001
BACKEND_PORT=8001 npm run dev

# Frontend on port 5174 with backend on 8001
cd frontend
FRONTEND_PORT=5174 BACKEND_URL=http://localhost:8001 npm run dev
```

## 🔍 Default Ports

- **Frontend (Vite)**: 5173 (auto-increments: 5174, 5175, 5176...)
- **Backend (Express)**: 8000 (can be set via BACKEND_PORT)

## 📝 Development Workflow

1. Run `./dev-setup.sh` or `dev-setup.bat`
2. Note the ports displayed
3. Open the frontend URL in your browser
4. Both services will proxy correctly

## 🎯 Production vs Development

- **Development**: Uses relative URLs → Vite proxy → backend
- **Production**: Uses full URLs to adapt-v3.onrender.com
- **Environment variables** control the URLs automatically

## 💡 Pro Tips

- Use the automatic setup script for the best experience
- Check `npm run check-ports` before starting if you suspect conflicts
- The frontend will automatically proxy all `/api/*` requests to the backend
- No CORS issues in development - proxy handles everything
