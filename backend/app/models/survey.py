from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

class Survey(Base):
    __tablename__ = "surveys"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    slug = Column(String(64), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    status = Column(String(16), nullable=False, default="DRAFT") # DRAFT, LIVE, CLOSED
    closed_reason = Column(String(16), nullable=True) # TARGET, DEADLINE, ADMIN
    target = Column(Integer, nullable=False, default=0)
    active_version_id = Column(Integer, ForeignKey("survey_versions.id", ondelete="SET NULL", use_alter=True), nullable=True)
    created_by = Column(Integer, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    deadline_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    versions = relationship("SurveyVersion", back_populates="survey", foreign_keys="SurveyVersion.survey_id", cascade="all, delete-orphan")
    active_version = relationship("SurveyVersion", foreign_keys=[active_version_id], post_update=True)
    quotas = relationship("Quota", back_populates="survey", cascade="all, delete-orphan")
    respondents = relationship("Respondent", back_populates="survey", cascade="all, delete-orphan")
    creator = relationship("AdminUser", foreign_keys=[created_by])

    __table_args__ = (
        Index("idx_surveys_status_deadline", "status", "deadline_at"),
    )
