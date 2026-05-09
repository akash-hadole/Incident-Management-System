#!/bin/bash
echo "🚀 Starting IMS..."
cd backend && node src/index.js &
BACKEND_PID=$!
echo "✅ Backend PID: $BACKEND_PID"
echo "🌐 Open http://localhost:3000 in your browser"
echo "📡 Backend API: http://localhost:3001"
echo "🔍 Health: http://localhost:3001/health"
echo ""
echo "Press Ctrl+C to stop"
wait $BACKEND_PID
