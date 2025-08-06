#!/bin/sh

echo "🚀 Starting Adapt v3 Backend..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

echo "✅ DATABASE_URL is configured"

# Run database migrations at startup (when DATABASE_URL is available)
echo "🔄 Running database migrations..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Database migrations completed successfully"
else
    echo "❌ Database migrations failed"
    exit 1
fi

# Optional: Generate Prisma client again (in case of version mismatches)
echo "🔄 Generating Prisma client..."
npx prisma generate

if [ $? -eq 0 ]; then
    echo "✅ Prisma client generated successfully"
else
    echo "⚠️ Prisma client generation failed, but continuing..."
fi

# Start the application
echo "🚀 Starting Node.js application..."
exec node dist/server.js