#!/bin/bash

echo "🔍 StreamMates Diagnostic Tool"
echo "=============================="
echo ""

# Check if servers are running
echo "📊 Checking if servers are running..."
echo ""

# Check backend
BACKEND_RUNNING=$(lsof -i :3001 | grep LISTEN)
if [ -n "$BACKEND_RUNNING" ]; then
    echo "✅ Backend server is running on port 3001"
else
    echo "❌ Backend server is NOT running on port 3001"
    echo "   Run: cd server && node server.js"
fi

# Check frontend
FRONTEND_RUNNING=$(lsof -i :3000 | grep LISTEN)
if [ -n "$FRONTEND_RUNNING" ]; then
    echo "✅ Frontend server is running on port 3000"
else
    echo "❌ Frontend server is NOT running on port 3000"
    echo "   Run: npm run dev"
fi

echo ""
echo "🌐 Testing API connection..."
API_RESPONSE=$(curl -s http://localhost:3001/health)
if [ -n "$API_RESPONSE" ]; then
    echo "✅ Backend API is responding"
    echo "   Response: $API_RESPONSE"
else
    echo "❌ Backend API is not responding"
fi

echo ""
echo "📝 Environment Configuration:"
echo ""
echo "Backend (.env in server/):"
grep "MONGODB_URI\|PORT\|CORS_ORIGIN" server/.env | head -3

echo ""
echo "Frontend (.env in root):"
grep "VITE_" .env

echo ""
echo "=============================="
echo "🎯 Next Steps:"
echo "=============================="
echo "1. Make sure both servers are running (see above)"
echo "2. Open http://localhost:3000/ in your browser"
echo "3. Open browser console (F12)"
echo "4. Try to create a room"
echo "5. Look for error messages in:"
echo "   - Browser console"
echo "   - Backend terminal"
echo ""
echo "Common Issues:"
echo "- Socket connection failed → Check if backend is running"
echo "- CORS errors → Check CORS_ORIGIN matches frontend port"
echo "- 'Failed to create room' → Check MongoDB connection"
echo ""
