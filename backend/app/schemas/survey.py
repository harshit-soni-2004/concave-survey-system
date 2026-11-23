from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict

class ValidateRequest(BaseModel):
    raw_content: str

class ValidationErrorItem(BaseModel):
    line: int
    message: str

class ValidateResponse(BaseModel):
    valid: bool
    errors: List[ValidationErrorItem]

class SurveyCreateRequest(BaseModel):
    raw_content: str
    title: Optional[str] = None
    slug: Optional[str] = None
    target: Optional[int] = None
    deadline_at: Optional[datetime] = None

class VersionUploadRequest(BaseModel):
    raw_content: str

class SurveyStatusUpdateRequest(BaseModel):
    status: str # DRAFT, LIVE, CLOSED
    closed_reason: Optional[str] = None # TARGET, DEADLINE, ADMIN

class SurveyDeadlineUpdateRequest(BaseModel):
    deadline_at: Optional[datetime] = None

class QuotaItem(BaseModel):
    id: int
    question_id: str
    value: str
    question_id_2: Optional[str] = None
    value_2: Optional[str] = None
    target: int

    model_config = ConfigDict(from_attributes=True)

class VersionItem(BaseModel):
    id: int
    version_number: int
    status: str
    uploaded_by: Optional[int] = None
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SurveyListItem(BaseModel):
    id: int
    slug: str
    title: str
    status: str
    closed_reason: Optional[str] = None
    target: int
    completed_count: int = 0
    started_count: int = 0
    terminated_count: int = 0
    last_activity: Optional[datetime] = None
    active_version_id: Optional[int] = None
    created_by: Optional[int] = None
    deadline_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SurveyDetailResponse(SurveyListItem):
    versions: List[VersionItem] = []
    quotas: List[QuotaItem] = []
    active_version_data: Optional[Dict[str, Any]] = None
