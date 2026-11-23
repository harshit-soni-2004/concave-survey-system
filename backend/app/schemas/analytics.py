from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, ConfigDict
from app.schemas.dashboard import QuotaProgressItem, TerminationReasonItem, QualityFlagsSummary, DropoffItem

class DailyCountItem(BaseModel):
    date: str
    count: int

class DeadlineItem(BaseModel):
    id: int
    title: str
    slug: str
    status: str
    deadline_at: str
    days_left: Optional[int] = None
    hours_left: Optional[int] = None

class QuotaAlertItem(BaseModel):
    survey_id: int
    survey_title: str
    survey_slug: str
    question_id: str
    value: str
    question_id_2: Optional[str] = None
    value_2: Optional[str] = None
    target: int
    done: int
    percent: float

class RecentEventItem(BaseModel):
    event_type: str # completed, terminated, survey_approved, survey_closed
    survey_id: int
    survey_title: str
    survey_slug: str
    message: str
    timestamp: str

class OverviewResponse(BaseModel):
    live_studies: int
    total_completes: int
    total_target: int
    overall_progress_percent: float
    in_progress: int
    terminated: int
    completes_per_day: List[DailyCountItem]
    status_counts: Dict[str, int]
    soonest_deadlines: List[DeadlineItem]
    quota_alerts: List[QuotaAlertItem]
    recent_events: List[RecentEventItem]

class AnalyticsDailyTrendItem(BaseModel):
    date: str
    started: int
    completed: int
    terminated: int
    cumulative_completes: int
    target_pace: float

class AnalyticsAlerts(BaseModel):
    quota_at_or_above_90: List[QuotaAlertItem] = []
    deadline_within_48h: bool = False
    projected_finish_after_deadline: bool = False
    speeder_rate_above_15: bool = False
    speeder_rate_percent: float = 0.0
    summary: List[str] = []

class SurveyAnalyticsResponse(BaseModel):
    survey_id: int
    survey_title: str
    survey_slug: str
    survey_status: str
    closed_reason: Optional[str] = None
    version_number: int
    target: int
    started: int
    completed: int
    terminated: int
    in_progress: int
    completion_rate: float
    incidence_rate: float
    median_completion_time_seconds: Optional[float] = None
    average_completion_time_seconds: Optional[float] = None
    projected_finish_date: Optional[str] = None
    days_left_to_deadline: Optional[int] = None
    daily_trends: List[AnalyticsDailyTrendItem]
    question_analytics: List[Dict[str, Any]]
    top_termination_reasons: List[TerminationReasonItem]
    dropoff: List[DropoffItem]
    alerts: AnalyticsAlerts
    quality_flags: QualityFlagsSummary

class RespondentListItem(BaseModel):
    id: str
    masked_id: str
    token: str
    status: str
    version: int
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_seconds: Optional[int] = None
    quality_flag: Optional[str] = None
    termination_reason: Optional[str] = None
    current_question_id: Optional[str] = None

class SurveyRespondentsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: List[RespondentListItem]
