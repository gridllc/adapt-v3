#!/bin/sh

echo "🚀 Starting Adapt v3 Backend..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

echo "✅ DATABASE_URL is configured"

# Function to test database connectivity
test_database_connection() {
    echo "🔍 Testing database connection..."
    timeout 10s npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1
    return $?
}

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

# Test database connection first
if test_database_connection; then
    echo "✅ Database connection successful"
    # Run migrations with retry
    run_migrations_with_retry
else
    echo "⚠️ Database connection failed, but continuing..."
    echo "⚠️ Migrations will be retried when database becomes available"
fi

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