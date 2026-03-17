#!/bin/bash
# RunCourse 앱 실행 스크립트 (개발 모드)

echo "🏃 RunCourse 앱을 시작합니다... (개발 모드)"

# Backend
echo "📦 백엔드 서버 시작 (포트 8001)..."
cd backend
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!
cd ..

# Frontend (dev server with HMR)
echo "🎨 프론트엔드 개발 서버 시작..."
cd frontend
npx vite --host 0.0.0.0 &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ RunCourse 개발 모드 실행 중!"
echo "   프론트엔드: http://localhost:5173"
echo "   백엔드 API: http://localhost:8001/docs"
echo ""
echo "종료하려면 Ctrl+C를 누르세요."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
