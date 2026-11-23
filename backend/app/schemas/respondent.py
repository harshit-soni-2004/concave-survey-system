from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict

class AnswerSubmissionRequest(BaseModel):
    question_id: str
    answer_value: Any
    other_text: Optional[str] = None

class BatchTokensRequest(BaseModel):
    count: int = 10

class TokenItem(BaseModel):
    token: str
    url: str

class BatchTokensResponse(BaseModel):
    survey_id: int
    tokens: List[TokenItem]

class PublicJoinResponse(BaseModel):
    token: str
    survey_slug: str
    url: str

class QuestionView(BaseModel):
    id: str
    type: str
    text: str
    required: bool
    options: List[Dict[str, Any]] = []
    rows: List[Dict[str, Any]] = []
    min: Optional[Any] = None
    max: Optional[Any] = None
    minlength: Optional[int] = None
    low_label: Optional[str] = None
    high_label: Optional[str] = None
    format: Optional[str] = None
    translations: Optional[Dict[str, str]] = None
    active_language: Optional[str] = "en"
    current_answer: Optional[Any] = None
    current_other_text: Optional[str] = None
    can_go_back: bool = False
    progress_percentage: int = 0

class LanguageUpdateRequest(BaseModel):
    language: str

class RespondentSessionResponse(BaseModel):
    status: str # NOT_STARTED, IN_PROGRESS, COMPLETED, TERMINATED, CLOSED
    token: str
    survey_id: Optional[int] = None
    survey_title: str
    survey_slug: str
    is_test: bool
    screen: str # Question, Completed, Not eligible, Survey closed, Already completed
    termination_reason: Optional[str] = None
    is_silent: bool = False
    question: Optional[QuestionView] = None

    model_config = ConfigDict(from_attributes=True)
