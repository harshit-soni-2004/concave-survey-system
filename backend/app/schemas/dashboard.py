from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class QuotaProgressItem(BaseModel):
    id: int
    question_id: str
    value: str
    target: int
    done: int
    left: int

    model_config = ConfigDict(from_attributes=True)

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
