from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    respondent_id = Column(String(36), ForeignKey("respondents.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(String(64), nullable=False)
    answer_value = Column(JSON, nullable=False)
    other_text = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    respondent = relationship("Respondent", back_populates="answers")
    options = relationship("AnswerOption", back_populates="answer", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("respondent_id", "question_id", name="uq_respondent_question"),
        Index("idx_answers_question", "question_id"),
    )
