#!/bin/bash
# RunCourse 프로덕션 배포 스크립트
# 단일 서버로 프론트엔드 + 백엔드 동시 서빙

set -e

PORT=${1:-8001}
HOST=${2:-0.0.0.0}

echo "🏃 RunCourse 프로덕션 배포 시작..."
echo ""

# 1. 프론트엔드 빌드
echo "📦 프론트엔드 빌드 중..."
cd frontend
npm install --silent
npx vite build
cd ..
echo "✅ 프론트엔드 빌드 완료"

# 2. 백엔드 의존성 확인
echo "📦 백엔드 의존성 확인..."
cd backend
if [ ! -d ".venv" ]; then
    echo "   가상 환경 생성 중..."
    uv venv .venv
fi
source .venv/bin/activate
uv pip install -r requirements.txt --quiet
cd ..
echo "✅ 백엔드 준비 완료"

# 3. 프로덕션 서버 시작
echo ""
echo "🚀 프로덕션 서버 시작..."
echo "=========================================="
echo "  RunCourse 앱이 실행 중입니다!"
echo "  http://${HOST}:${PORT}"
echo ""
echo "  모바일에서 접속하려면:"
echo "  같은 WiFi에서 http://$(hostname -I | awk '{print $1}'):${PORT}"
echo "=========================================="
echo ""

cd backend
source .venv/bin/activate
exec uvicorn main:app --host $HOST --port $PORT --workers 2
