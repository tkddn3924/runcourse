#!/bin/bash
# Render 빌드 스크립트
set -e

# 프론트엔드 빌드
cd frontend
npm install
npx vite build
cd ..

# 백엔드 의존성
pip install -r backend/requirements.txt
