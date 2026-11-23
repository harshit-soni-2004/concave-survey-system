from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class QuotaProgressItem(BaseModel):
    id: int
    question_id: str
    value: str
    question_id_2: Optional[str] = None
    value_2: Optional[str] = None
    target: int
    done: int
    left: int

    model_config = ConfigDict(from_attributes=True)

class QualityFlagsSummary(BaseModel):
    speeders: int = 0
    straight_liners: int = 0
    total_flagged: int = 0

class DropoffItem(BaseModel):
    question_id: str
    question_text: str
    question_type: str
    reached: int
    stopped: int
    dropoff_rate: float

class DropoffReportResponse(BaseModel):
    survey_id: int
    survey_title: str
    total_respondents: int
    questions: List[DropoffItem]

class TerminationReasonItem(BaseModel):
    reason: str
    count: int

class DashboardResponse(BaseModel):
    survey_id: int
    survey_title: str
    survey_slug: str
    survey_status: str
    closed_reason: Optional[str] = None
    target: int
    started: int
    completed: int
    terminated: int
    in_progress: int
    quotas: List[QuotaProgressItem]
    terminations: List[TerminationReasonItem]
    quality_flags: Optional[QualityFlagsSummary] = None
