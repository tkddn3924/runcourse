FROM python:3.11-slim

WORKDIR /app

# Node.js 설치 (프론트엔드 빌드용)
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# 백엔드 의존성 설치
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# 프론트엔드 빌드
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci --silent

COPY frontend/ ./frontend/
RUN cd frontend && npx vite build

# 백엔드 복사
COPY backend/ ./backend/

EXPOSE 8001

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8001"]
