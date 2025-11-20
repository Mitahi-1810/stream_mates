#!/bin/bash

# StreamMates Quick Start Script

echo "🚀 StreamMates Quick Start"
echo "=========================="
echo ""

# Check if MongoDB is running
echo "📊 Checking MongoDB..."
if pgrep -x "mongod" > /dev/null; then
    echo "✅ MongoDB is running"
else
    echo "⚠️  MongoDB is not running. Starting MongoDB..."
    if command -v brew &> /dev/null; then
        brew services start mongodb-community
    else
        echo "❌ Please start MongoDB manually"
        echo "   macOS: brew services start mongodb-community"
        echo "   Linux: sudo systemctl start mongod"
        exit 1
    fi
fi

echo ""
echo "🔧 Starting Backend Server..."
cd server

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file..."
    cp .env.example .env
    echo "✅ Created .env file. Please review server/.env if needed."
fi

# Start backend in background
npm start &
BACKEND_PID=$!
echo "✅ Backend server started (PID: $BACKEND_PID)"

cd ..

echo ""
echo "🎨 Starting Frontend..."

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file..."
    cp .env.example .env
    echo "✅ Created .env file."
fi

echo ""
echo "=========================="
echo "🎉 StreamMates is starting!"
echo "=========================="
echo ""
echo "📱 Frontend: http://localhost:5173"
echo "🔌 Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start frontend (this will block)
npm run dev

# Cleanup on exit
trap "kill $BACKEND_PID 2>/dev/null" EXIT
