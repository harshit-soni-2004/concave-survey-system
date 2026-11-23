from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, JSON, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

class Respondent(Base):
    __tablename__ = "respondents"

    id = Column(String(36), primary_key=True) # UUID
    survey_id = Column(Integer, ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    survey_version_id = Column(Integer, ForeignKey("survey_versions.id", ondelete="SET NULL"), nullable=True)
    token = Column(String(64), unique=True, nullable=False, index=True)
    status = Column(String(16), nullable=False, default="NOT_STARTED") # NOT_STARTED, IN_PROGRESS, COMPLETED, TERMINATED
    is_test = Column(Boolean, nullable=False, default=False)
    is_silent_termination = Column(Boolean, nullable=False, default=False)
    termination_reason = Column(Text, nullable=True)
    current_question_id = Column(String(64), nullable=True)
    path = Column(JSON, nullable=True) # JSON list of question ids visited
    meta = Column(JSON, nullable=False, default=dict) # Display order, rotation arm, language
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    survey = relationship("Survey", back_populates="respondents")
    survey_version = relationship("SurveyVersion")
    answers = relationship("Answer", back_populates="respondent", cascade="all, delete-orphan")
    terminations = relationship("RespondentTermination", back_populates="respondent", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_respondents_survey_status_test", "survey_id", "status", "is_test"),
    )
