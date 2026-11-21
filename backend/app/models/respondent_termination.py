from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

class RespondentTermination(Base):
    __tablename__ = "respondent_terminations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    respondent_id = Column(String(36), ForeignKey("respondents.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(String(64), nullable=False)
    reason = Column(String(255), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    respondent = relationship("Respondent", back_populates="terminations")

    __table_args__ = (
        Index("idx_terminations_reason", "reason"),
        Index("idx_terminations_question", "question_id"),
    )
