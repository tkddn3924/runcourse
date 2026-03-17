from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    runs = relationship("Run", back_populates="user")


class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    started_at = Column(DateTime, nullable=False)
    finished_at = Column(DateTime, nullable=True)
    distance_km = Column(Float, default=0.0)
    duration_seconds = Column(Integer, default=0)
    avg_pace = Column(Float, nullable=True)  # min/km
    calories = Column(Float, nullable=True)
    course_type = Column(String, nullable=True)  # uphill, flat, sprint, interval, zone2
    route = Column(JSON, nullable=True)  # [{lat, lng, timestamp, ...}]
    planned_route = Column(JSON, nullable=True)  # planned course coordinates
    elevation_gain = Column(Float, default=0.0)
    status = Column(String, default="completed")  # in_progress, completed, paused

    user = relationship("User", back_populates="runs")
