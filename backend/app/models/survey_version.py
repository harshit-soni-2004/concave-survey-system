from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class SurveyVersion(Base):
    __tablename__ = "survey_versions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    survey_id = Column(Integer, ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    questionnaire_data = Column(JSON, nullable=False)
    raw_content = Column(Text, nullable=False)
    status = Column(String(16), nullable=False, default="DRAFT") # DRAFT, APPROVED
    uploaded_by = Column(Integer, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    approved_by = Column(Integer, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    survey = relationship("Survey", back_populates="versions", foreign_keys=[survey_id])
    uploader = relationship("AdminUser", foreign_keys=[uploaded_by])
    approver = relationship("AdminUser", foreign_keys=[approved_by])

    __table_args__ = (
        UniqueConstraint("survey_id", "version_number", name="uq_survey_version"),
    )
