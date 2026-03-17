import os
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
from typing import Optional

from database import Base, engine, get_db
from models import User, Run
from auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
)
from course_generator import generate_course

Base.metadata.create_all(bind=engine)

app = FastAPI(title="RunCourse - GPS 러닝 코스 앱")

# 프론트엔드 빌드 경로
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Schemas ───


class SignUpRequest(BaseModel):
    email: EmailStr
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class CourseRequest(BaseModel):
    lat: float
    lng: float
    distance_km: float
    course_type: str  # uphill, flat, sprint, interval, zone2


class RunStartRequest(BaseModel):
    course_type: Optional[str] = None
    planned_route: Optional[list] = None


class RunUpdateRequest(BaseModel):
    route: list
    distance_km: float
    duration_seconds: int
    status: str = "in_progress"


class RunFinishRequest(BaseModel):
    route: list
    distance_km: float
    duration_seconds: int
    avg_pace: Optional[float] = None
    calories: Optional[float] = None
    elevation_gain: Optional[float] = 0.0


# ─── Auth Endpoints ───


@app.post("/api/auth/signup", response_model=TokenResponse)
def signup(req: SignUpRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="이미 등록된 이메일입니다")
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="이미 사용중인 닉네임입니다")

    user = User(
        email=req.email,
        username=req.username,
        hashed_password=get_password_hash(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, username=user.username)


@app.post("/api/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, username=user.username)


@app.get("/api/auth/me")
def get_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "username": user.username}


# ─── Course Generation ───


@app.post("/api/course/generate")
async def generate_running_course(
    req: CourseRequest,
    user: User = Depends(get_current_user),
):
    if req.distance_km < 0.5 or req.distance_km > 50:
        raise HTTPException(status_code=400, detail="거리는 0.5km ~ 50km 사이로 설정해주세요")
    if req.course_type not in ("uphill", "flat", "sprint", "interval", "zone2"):
        raise HTTPException(status_code=400, detail="올바른 코스 타입을 선택해주세요")

    course = await generate_course(req.lat, req.lng, req.distance_km, req.course_type)
    return course


# ─── Run Tracking ───


@app.post("/api/runs/start")
def start_run(
    req: RunStartRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = Run(
        user_id=user.id,
        started_at=datetime.now(timezone.utc),
        course_type=req.course_type,
        planned_route=req.planned_route,
        status="in_progress",
        route=[],
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return {"run_id": run.id, "started_at": run.started_at.isoformat()}


@app.put("/api/runs/{run_id}/update")
def update_run(
    run_id: int,
    req: RunUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = db.query(Run).filter(Run.id == run_id, Run.user_id == user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="러닝 기록을 찾을 수 없습니다")

    run.route = req.route
    run.distance_km = req.distance_km
    run.duration_seconds = req.duration_seconds
    run.status = req.status
    db.commit()
    return {"status": "updated"}


@app.put("/api/runs/{run_id}/finish")
def finish_run(
    run_id: int,
    req: RunFinishRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = db.query(Run).filter(Run.id == run_id, Run.user_id == user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="러닝 기록을 찾을 수 없습니다")

    run.route = req.route
    run.distance_km = req.distance_km
    run.duration_seconds = req.duration_seconds
    run.finished_at = datetime.now(timezone.utc)
    run.avg_pace = req.avg_pace
    run.calories = req.calories
    run.elevation_gain = req.elevation_gain
    run.status = "completed"
    db.commit()
    db.refresh(run)

    return {
        "run_id": run.id,
        "distance_km": run.distance_km,
        "duration_seconds": run.duration_seconds,
        "avg_pace": run.avg_pace,
        "status": "completed",
    }


@app.get("/api/runs")
def get_runs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    runs = (
        db.query(Run)
        .filter(Run.user_id == user.id)
        .order_by(Run.started_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": r.id,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "distance_km": r.distance_km,
            "duration_seconds": r.duration_seconds,
            "avg_pace": r.avg_pace,
            "calories": r.calories,
            "course_type": r.course_type,
            "elevation_gain": r.elevation_gain,
            "status": r.status,
            "route": r.route,
            "planned_route": r.planned_route,
        }
        for r in runs
    ]


@app.get("/api/runs/{run_id}")
def get_run(
    run_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = db.query(Run).filter(Run.id == run_id, Run.user_id == user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="러닝 기록을 찾을 수 없습니다")
    return {
        "id": run.id,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "distance_km": run.distance_km,
        "duration_seconds": run.duration_seconds,
        "avg_pace": run.avg_pace,
        "calories": run.calories,
        "course_type": run.course_type,
        "elevation_gain": run.elevation_gain,
        "status": run.status,
        "route": run.route,
        "planned_route": run.planned_route,
    }


@app.delete("/api/runs/{run_id}")
def delete_run(
    run_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = db.query(Run).filter(Run.id == run_id, Run.user_id == user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="러닝 기록을 찾을 수 없습니다")
    db.delete(run)
    db.commit()
    return {"status": "deleted"}


@app.get("/api/stats")
def get_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    runs = db.query(Run).filter(Run.user_id == user.id, Run.status == "completed").all()
    total_distance = sum(r.distance_km or 0 for r in runs)
    total_duration = sum(r.duration_seconds or 0 for r in runs)
    total_runs = len(runs)

    return {
        "total_runs": total_runs,
        "total_distance_km": round(total_distance, 2),
        "total_duration_seconds": total_duration,
        "avg_pace": round(total_duration / 60 / total_distance, 2) if total_distance > 0 else 0,
    }


# ─── 프론트엔드 정적 파일 서빙 (프로덕션) ───

if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """SPA fallback: /api 외 모든 경로는 index.html 반환"""
        file_path = FRONTEND_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIR / "index.html")
