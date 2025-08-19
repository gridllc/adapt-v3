# Port Configuration Guide

## 🎯 Port Strategy: Environment-Aware

The app automatically chooses the correct port based on the environment:

- **Local Development**: Port 8000 (default)
- **Render Production**: Port 10000 (required by Render)

## ⚙️ How It Works

### Backend (`server.ts`)
```javascript
const PORT = process.env.PORT || 8000; // default to 8000 for local
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

### Frontend (`vite.config.ts`)
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:10000', // Updated for new default
  }
}
```

## 🔧 Environment Variables

### Local Development (.env)
```bash
# Optional - defaults to 8000 if not set
PORT=8000
```

### Render Production
Render automatically sets:
```bash
PORT=10000  # Set by Render platform
```

## 🐳 Docker Configuration

### Dockerfile
```dockerfile
# Expose Render-required port (app uses process.env.PORT automatically)
EXPOSE 10000

# Health check on the port that Render expects
HEALTHCHECK CMD wget --quiet --tries=1 --spider http://localhost:10000/health || exit 1

# Start app (Render sets PORT=10000, app binds automatically)
CMD ["npm", "run", "render:start"]
```

## 🚀 Usage

### Local Development
```bash
# Backend runs on port 8000 (or whatever you set in .env)
npm run dev

# Frontend proxy forwards API calls to backend:8000
cd frontend && npm run dev
```

### Production (Render)
```bash
# Render automatically sets PORT=10000
# App binds to 10000 without any code changes
# Public traffic hits your domain → Render proxy → container:10000
```

## ✅ Benefits

1. **Zero config changes** between dev and production
2. **Render compatible** out of the box
3. **Flexible** - can override port locally if needed
4. **Health checks work** in both environments
