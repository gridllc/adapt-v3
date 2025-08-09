#!/bin/bash

# 🧹 Adapt v3 Project Cleanup Script
# This script removes obsolete files and reorganizes the project structure

echo "🧹 Starting Adapt v3 cleanup..."

# 1. Remove obsolete documentation files
echo "📄 Removing obsolete documentation..."
rm -f API_FIX_SUMMARY.md
rm -f QUICK_FIX_GUIDE.md
rm -f DEPLOYMENT_CHECKLIST.md
rm -f DEPLOYMENT_GUIDE.md
rm -f FINAL_API_FIX_SUMMARY.md
rm -f DATABASE_CONNECTION_UPDATES.md
rm -f ASYNC_PROCESSING_IMPLEMENTATION.md
rm -f VERCEL_BUILD_FIX.md
rm -f CRITICAL_FIXES_IMPLEMENTED.md
rm -f BACKEND_FIXES_SUMMARY.md
rm -f UPLOAD_TROUBLESHOOTING.md
rm -f RENDER_DEPLOYMENT_GUIDE.md

# 2. Remove test files (keep only essential ones)
echo "🧪 Removing obsolete test files..."
rm -f test-*.js
rm -f test-*.txt
rm -f debug-status-path.js
rm -f migrate-db.js
rm -f test-db-connection.js
rm -f test-redis-*.js
rm -f test-prisma.js
rm -f test-status-service.js
rm -f test-critical-fixes.js
rm -f test-backend-fixes.js
rm -f test-async-upload.js
rm -f test-upload-*.js
rm -f test-path-*.js
rm -f test-complete-upload.js
rm -f test-small-file.js
rm -f test-minimal-finalize.js

# 3. Remove backend duplicates
echo "🔧 Removing backend duplicates..."
rm -f backend/Dockerfile.txt
rm -f backend/.dockerignore.txt
rm -f backend/gcp-key.json
rm -f backend/test.txt

# 4. Remove old data storage (migrate to database)
echo "🗄️ Removing old JSON storage..."
rm -rf backend/data/
rm -rf backend/src/data/
rm -rf backend/processed/
rm -rf backend/uploads/
rm -rf uploads/
rm -rf backend/temp/

# 5. Remove git artifacts
echo "🗑️ Removing git artifacts..."
rm -rf adapt-v3.git/
rm -rf adapt-v3.git.bfg-report/
rm -f bfg-1.15.0.jar

# 6. Remove root level node_modules and package files
echo "📦 Cleaning root level files..."
rm -rf node_modules/
rm -f package.json
rm -f package-lock.json
rm -f npm

# 7. Create new documentation structure
echo "📚 Creating new documentation structure..."
mkdir -p docs
mkdir -p scripts
mkdir -p tests/e2e
mkdir -p tests/integration
mkdir -p tests/unit
mkdir -p .github/workflows

# 8. Move essential files to docs
echo "📄 Moving essential documentation..."
if [ -f "README.md" ]; then
    cp README.md docs/README.md
fi

# 9. Create new root package.json
echo "📦 Creating new root package.json..."
cat > package.json << 'EOF'
{
  "name": "adapt-v3",
  "version": "1.0.0",
  "description": "AI-Powered Interactive Training Platform",
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm run dev",
    "build": "npm run build:backend && npm run build:frontend",
    "build:backend": "cd backend && npm run build",
    "build:frontend": "cd frontend && npm run build",
    "test": "npm run test:backend && npm run test:frontend",
    "test:backend": "cd backend && npm test",
    "test:frontend": "cd frontend && npm test",
    "clean": "npm run clean:backend && npm run clean:frontend",
    "clean:backend": "cd backend && rm -rf dist node_modules",
    "clean:frontend": "cd frontend && rm -rf dist node_modules",
    "install:all": "npm install && cd backend && npm install && cd ../frontend && npm install"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  },
  "workspaces": [
    "frontend",
    "backend"
  ]
}
EOF

echo "✅ Cleanup completed!"
echo "📁 New structure created:"
echo "  ├── frontend/          # React app"
echo "  ├── backend/           # Express API"
echo "  ├── docs/             # Documentation"
echo "  ├── scripts/          # Build scripts"
echo "  ├── tests/            # Test suites"
echo "  └── shared/           # Shared types"
echo ""
echo "🚀 Next steps:"
echo "  1. Run: npm run install:all"
echo "  2. Run: npm run dev"
echo "  3. Review and update documentation in docs/" 