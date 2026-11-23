from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class Quota(Base):
    __tablename__ = "quotas"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    survey_id = Column(Integer, ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(String(64), nullable=False)
    value = Column(String(255), nullable=False)
    question_id_2 = Column(String(64), nullable=True)
    value_2 = Column(String(255), nullable=True)
    target = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    survey = relationship("Survey", back_populates="quotas")

    __table_args__ = (
        UniqueConstraint("survey_id", "question_id", "value", name="uq_survey_question_value"),
    )
