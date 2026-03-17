# 🏃 RunCourse - GPS 러닝 코스 플래너

## 프로젝트 리포트

**프로젝트명:** RunCourse
**생성일:** 2026-03-17
**유형:** 풀스택 웹 애플리케이션
**총 코드량:** 2,732 LOC (백엔드 663 + 프론트엔드 2,069)

---

## 1. 프로젝트 개요

GPS 위치 기반으로 사용자 주변에 러닝 코스를 자동 생성해주는 웹앱입니다.
나이키런 앱처럼 실시간 러닝 트래킹 기능을 제공하며, 훈련 목적에 맞는 다양한 코스 타입을 지원합니다.

### 핵심 기능
- **AI 코스 자동 생성** — 5가지 훈련 타입 + 거리 설정, 신호등 회피 경로
- **실시간 러닝 트래킹** — GPS 기반 거리/페이스/시간/칼로리 실시간 측정
- **러닝 기록 관리** — 히스토리 조회, 미니맵 경로 시각화, 통계
- **회원 시스템** — JWT 기반 회원가입/로그인

---

## 2. 기술 스택

### 백엔드 (Python)
| 구분 | 기술 |
|------|------|
| 프레임워크 | FastAPI |
| 서버 | Uvicorn (ASGI) |
| 데이터베이스 | SQLite + SQLAlchemy ORM |
| 인증 | JWT (python-jose) + bcrypt |
| HTTP 클라이언트 | httpx (비동기) |

### 프론트엔드 (JavaScript)
| 구분 | 기술 |
|------|------|
| UI 라이브러리 | React 19 |
| 빌드 도구 | Vite 8 |
| 라우팅 | React Router DOM 7 |
| 지도 | Leaflet + React Leaflet |
| HTTP | Axios |

### 외부 API
| API | 용도 |
|-----|------|
| OpenStreetMap Overpass API | 신호등 위치 조회 |
| OSRM (Project-OSRM) | 실제 도로 기반 경로 생성 |
| OpenStreetMap Tile Server | 지도 타일 렌더링 |

---

## 3. 프로젝트 구조

```
running-app/
├── start.sh                         # 실행 스크립트 (백엔드+프론트 동시 실행)
│
├── backend/                          # FastAPI 백엔드 (663 LOC)
│   ├── main.py                      # API 엔드포인트 정의 (292줄)
│   ├── course_generator.py          # 코스 생성 알고리즘 (256줄)
│   ├── auth.py                      # JWT 인증 처리 (60줄)
│   ├── models.py                    # DB 모델 (User, Run) (36줄)
│   ├── database.py                  # SQLite 연결 설정 (19줄)
│   ├── requirements.txt             # Python 의존성
│   └── running.db                   # SQLite 데이터베이스
│
└── frontend/                         # React 프론트엔드 (2,069 LOC)
    ├── vite.config.js               # Vite 설정 + API 프록시
    ├── index.html                   # SPA 엔트리
    └── src/
        ├── main.jsx                 # React 엔트리 (10줄)
        ├── App.jsx                  # 라우터 + Protected/Public Route (41줄)
        ├── api.js                   # Axios 설정 + 401 인터셉터 (27줄)
        ├── index.css                # 글로벌 스타일 + CSS 변수 (59줄)
        ├── contexts/
        │   └── AuthContext.jsx      # 인증 상태 관리 (73줄)
        └── pages/
            ├── LoginPage.jsx        # 로그인 (168줄)
            ├── SignupPage.jsx       # 회원가입 (202줄)
            ├── HomePage.jsx         # 메인 대시보드 (355줄)
            ├── CoursePage.jsx       # 코스 미리보기 + 지도 (263줄)
            ├── RunPage.jsx          # 실시간 러닝 트래킹 (429줄)
            └── HistoryPage.jsx      # 러닝 기록 (258줄)
```

---

## 4. API 엔드포인트 (총 10개)

### 인증 (3개)
| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|:----:|
| POST | `/api/auth/signup` | 회원가입 (이메일, 닉네임, 비밀번호) | - |
| POST | `/api/auth/login` | 로그인 → JWT 토큰 발급 | - |
| GET | `/api/auth/me` | 현재 로그인 사용자 정보 | ✅ |

### 코스 생성 (1개)
| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|:----:|
| POST | `/api/course/generate` | GPS 좌표 + 거리 + 타입 → 코스 생성 | ✅ |

### 러닝 트래킹 (5개)
| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|:----:|
| POST | `/api/runs/start` | 러닝 시작 (세션 생성) | ✅ |
| PUT | `/api/runs/{id}/update` | 러닝 중 실시간 업데이트 | ✅ |
| PUT | `/api/runs/{id}/finish` | 러닝 종료 + 최종 기록 저장 | ✅ |
| GET | `/api/runs` | 전체 러닝 기록 조회 (최근 50개) | ✅ |
| DELETE | `/api/runs/{id}` | 러닝 기록 삭제 | ✅ |

### 통계 (1개)
| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|:----:|
| GET | `/api/stats` | 총 러닝 수, 총 거리, 평균 페이스 | ✅ |

---

## 5. 데이터베이스 모델

### User 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer (PK) | 고유 ID |
| email | String (Unique) | 이메일 |
| username | String (Unique) | 닉네임 |
| hashed_password | String | bcrypt 해시 비밀번호 |
| created_at | DateTime | 가입일 |

### Run 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer (PK) | 고유 ID |
| user_id | Integer (FK) | User 참조 |
| started_at | DateTime | 시작 시간 |
| finished_at | DateTime | 종료 시간 |
| distance_km | Float | 총 거리 (km) |
| duration_seconds | Integer | 총 시간 (초) |
| avg_pace | Float | 평균 페이스 (분/km) |
| calories | Float | 소모 칼로리 |
| course_type | String | 코스 타입 (uphill/flat/sprint/interval/zone2/free) |
| route | JSON | 실제 이동 경로 [{lat, lng, timestamp}] |
| planned_route | JSON | 계획된 코스 좌표 |
| elevation_gain | Float | 누적 고도 상승 |
| status | String | 상태 (in_progress/completed/paused) |

---

## 6. 핵심 알고리즘: 코스 자동 생성

### 동작 순서
```
1. GPS 좌표 수신 (사용자 현재 위치)
2. Overpass API로 주변 신호등 위치 조회
3. 목표 거리에 맞는 원형 웨이포인트 생성
   - 코스 타입별 반경/웨이포인트 수 조정
   - 신호등 50m 이내 웨이포인트 자동 우회
4. OSRM API로 실제 도로 기반 경로 생성
5. 거리 오차 확인 → 0.5km 초과 시 스케일 조정 후 재생성 (최대 10회)
6. 경로 위 신호등 위치 계산 → 프론트에 전달
```

### 코스 타입별 설정
| 타입 | 평균 페이스 | 특징 |
|------|:----------:|------|
| ⛰️ 업힐 | 7:30/km | 반경 축소, 오르막 선호 |
| 🏃 평지 | 6:18/km | 기본 원형 루프 |
| ⚡ 스프린트 | 5:00/km | 4개 웨이포인트, 짧고 직선적 |
| 🔄 인터벌 | 6:00/km | 웨이포인트 많음, 다양한 구간 |
| ❤️ 존2 | 7:00/km | 편안한 페이스, 긴 루프 |

### 거리 정밀도 (테스트 결과)
| 목표 | 실제 생성 | 오차 |
|:----:|:--------:|:----:|
| 3km | 2.99km | 0.01km ✅ |
| 5km | 5.43km | 0.43km ✅ |
| 10km | 10.1km | 0.10km ✅ |

---

## 7. 페이지별 기능 상세

### 로그인/회원가입
- 이메일 + 비밀번호 기반 인증
- JWT 토큰 1주일 유효
- 401 응답 시 자동 토큰 클리어 + 로그인 리다이렉트

### 홈 (메인 대시보드)
- GPS 연결 상태 표시
- 누적 통계 (총 러닝, 총 거리, 평균 페이스)
- 5가지 훈련 타입 선택 버튼
- 6가지 프리셋 거리 (3/5/7/10/15/21km) + 직접 입력
- "코스 생성" 또는 "프리런 시작" 버튼

### 코스 미리보기
- Leaflet 지도에 경로 표시 (코스 타입별 색상)
- 출발점 마커 (초록), 신호등 마커 (빨강)
- 범례 표시
- 코스 정보: 거리, 예상 시간, 경로 위 신호등 수
- "이 코스로 러닝 시작" 버튼

### 실시간 러닝 트래킹
- 전체 화면 지도 + 현재 위치 자동 추적
- 계획 경로 (점선) vs 실제 경로 (실선) 동시 표시
- 실시간 표시: 거리, 시간, 페이스, 칼로리
- GPS 노이즈 필터링 (3m 이상 이동 + 30m 이내 정확도)
- 30초마다 서버 자동 저장
- 일시정지/재개/종료 제어

### 러닝 기록
- 시간순 히스토리 목록
- 각 기록마다 미니맵 + 통계 표시
- 코스 타입별 컬러 태그
- 기록 삭제 (확인 후)

---

## 8. 실행 방법

```bash
cd running-app

# 1. 백엔드 의존성 설치
cd backend && uv venv .venv && source .venv/bin/activate && uv pip install -r requirements.txt && cd ..

# 2. 프론트엔드 의존성 설치
cd frontend && npm install && cd ..

# 3. 앱 실행
./start.sh
```

| 서비스 | URL |
|--------|-----|
| 프론트엔드 | http://localhost:5173 |
| 백엔드 API | http://localhost:8001 |
| API 문서 (Swagger) | http://localhost:8001/docs |

---

## 9. 컴포넌트 데이터 흐름

```
AuthProvider (전역 인증 상태)
└── BrowserRouter
    ├── /login → LoginPage
    │   └── api.post('/auth/login') → setToken → navigate('/')
    │
    ├── /signup → SignupPage
    │   └── api.post('/auth/signup') → setToken → navigate('/')
    │
    ├── / → HomePage [ProtectedRoute]
    │   ├── api.get('/stats') → 통계 표시
    │   ├── navigator.geolocation → GPS 위치
    │   └── api.post('/course/generate') → navigate('/course', {course})
    │
    ├── /course → CoursePage [ProtectedRoute]
    │   ├── state로 course 데이터 수신
    │   ├── Leaflet 지도에 경로 + 신호등 렌더링
    │   └── navigate('/run', {plannedRoute})
    │
    ├── /run → RunPage [ProtectedRoute]
    │   ├── api.post('/runs/start') → runId 획득
    │   ├── geolocation.watchPosition() → 실시간 트래킹
    │   ├── api.put('/runs/{id}/update') → 30초 자동 저장
    │   └── api.put('/runs/{id}/finish') → 러닝 종료
    │
    └── /history → HistoryPage [ProtectedRoute]
        ├── api.get('/runs') → 기록 목록
        └── api.delete('/runs/{id}') → 기록 삭제
```

---

## 10. UI/UX 특징

- **다크 테마** — 검정 배경 + 녹색(#00C853) 포인트 컬러
- **한국어 UI** — 모든 텍스트 한국어
- **Noto Sans KR** 폰트
- **모바일 우선** — max-width 600px 레이아웃
- **코스 타입별 색상 코딩**
  - 업힐: 🟠 #FF6D00
  - 평지: 🟢 #00C853
  - 스프린트: 🔴 #F44336
  - 인터벌: 🟣 #9C27B0
  - 존2: 🔵 #2196F3
