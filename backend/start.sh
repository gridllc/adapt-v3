#!/bin/sh

echo "🚀 Starting Adapt v3 Backend..."
echo "=== Environment Check ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "DATABASE_URL: $(if [ -n "$DATABASE_URL" ]; then echo 'SET'; else echo 'NOT SET'; fi)"
echo "AWS_BUCKET_NAME: $(if [ -n "$AWS_BUCKET_NAME" ]; then echo 'SET'; else echo 'NOT SET'; fi)"
echo "CLERK_SECRET_KEY: $(if [ -n "$CLERK_SECRET_KEY" ]; then echo 'SET'; else echo 'NOT SET'; fi)"
echo "PWD: $(pwd)"
echo "========================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

echo "✅ DATABASE_URL is configured"

# Function to run migrations with retry
run_migrations_with_retry() {
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "🔄 Running database migrations (attempt $attempt/$max_attempts)..."
        
        if npx prisma migrate deploy; then
            echo "✅ Database migrations completed successfully"
            return 0
        else
            echo "❌ Database migrations failed (attempt $attempt/$max_attempts)"
            
            if [ $attempt -eq $max_attempts ]; then
                echo "⚠️ All migration attempts failed. Starting server anyway..."
                return 1
            fi
            
            echo "⏳ Waiting 10 seconds before retry..."
            sleep 10
            attempt=$((attempt + 1))
        fi
    done
}

# Run migrations with retry
run_migrations_with_retry

# Generate Prisma client (this should work even without DB connection)
echo "🔄 Generating Prisma client..."
if npx prisma generate; then
    echo "✅ Prisma client generated successfully"
else
    echo "⚠️ Prisma client generation failed, but continuing..."
fi

# Start the application
echo "🚀 Starting Node.js application..."
exec node dist/server.js