#!/bin/bash

# Adapt V3 Development Setup Script
# Handles port conflicts and starts both frontend and backend

echo "🚀 Starting Adapt V3 Development Environment"

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        echo "Port $port is BUSY"
        return 1
    else
        echo "Port $port is FREE"
        return 0
    fi
}

# Function to find next available port
find_next_port() {
    local base_port=$1
    local port=$base_port
    while ! check_port $port; do
        ((port++))
    done
    echo $port
}

echo "🔍 Checking port availability..."

# Check current ports
echo "Backend (8000): $(check_port 8000 && echo '✅' || echo '❌')"
echo "Frontend (5173): $(check_port 5173 && echo '✅' || echo '❌')"

# Find available ports
BACKEND_PORT=$(find_next_port 8000)
FRONTEND_PORT=$(find_next_port 5173)

echo ""
echo "📋 Port Configuration:"
echo "  Backend will use: $BACKEND_PORT"
echo "  Frontend will use: $FRONTEND_PORT"

# Export environment variables
export BACKEND_PORT=$BACKEND_PORT
export FRONTEND_PORT=$FRONTEND_PORT
export BACKEND_URL="http://localhost:$BACKEND_PORT"

echo ""
echo "🔧 Starting services..."

# Function to start backend in background
start_backend() {
    echo "📡 Starting backend on port $BACKEND_PORT..."
    cd backend && BACKEND_PORT=$BACKEND_PORT npm run dev &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
}

# Function to start frontend in background
start_frontend() {
    echo "🌐 Starting frontend on port $FRONTEND_PORT..."
    cd frontend && FRONTEND_PORT=$FRONTEND_PORT BACKEND_URL=$BACKEND_URL npm run dev &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
}

# Start services
start_backend
sleep 3
start_frontend

echo ""
echo "✅ Services starting up..."
echo "  Backend: http://localhost:$BACKEND_PORT"
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo ""
echo "💡 Useful commands:"
echo "  Kill backend: kill $BACKEND_PID"
echo "  Kill frontend: kill $FRONTEND_PID"
echo "  Check ports: npm run check-ports (in respective directories)"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for services
wait
