from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.admin_user import AdminUser
from app.models.survey import Survey
from app.models.survey_version import SurveyVersion
from app.models.quota import Quota
from app.models.respondent import Respondent
from app.parser.parser import parse_questionnaire
from app.parser.validator import validate_questionnaire_text, validate_questionnaire_ast
from app.schemas.survey import (
    ValidateRequest,
    ValidateResponse,
    SurveyCreateRequest,
    VersionUploadRequest,
    SurveyStatusUpdateRequest,
    SurveyDeadlineUpdateRequest,
    SurveyListItem,
    SurveyDetailResponse,
    VersionItem,
    QuotaItem,
)

router = APIRouter(prefix="/surveys", tags=["surveys"])

@router.post("/validate", response_model=ValidateResponse)
def validate_questionnaire(req: ValidateRequest):
    errors = validate_questionnaire_text(req.raw_content)
    return {
        "valid": len(errors) == 0,
        "errors": errors
    }

@router.post("", response_model=SurveyDetailResponse, status_code=status.HTTP_201_CREATED)
def create_survey(
    req: SurveyCreateRequest,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin", "researcher"]))
):
    ast = parse_questionnaire(req.raw_content)
    errors = validate_questionnaire_ast(ast)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Questionnaire validation failed", "errors": errors}
        )

    slug = ast.get("id")
    if not slug:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey missing id")

    existing = db.query(Survey).filter(Survey.slug == slug).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Survey with slug '{slug}' already exists")

    now = datetime.utcnow()
    survey = Survey(
        slug=slug,
        title=ast.get("title", ""),
        target=ast.get("target", 0),
        status="DRAFT",
        created_by=current_user.id,
        created_at=now,
        updated_at=now
    )
    db.add(survey)
    db.flush()

    version = SurveyVersion(
        survey_id=survey.id,
        version_number=1,
        questionnaire_data=ast,
        raw_content=req.raw_content,
        status="DRAFT",
        uploaded_by=current_user.id,
        created_at=now
    )
    db.add(version)
    db.commit()
    db.refresh(survey)

    return get_survey_detail(survey.id, db)

@router.post("/{survey_id}/versions/upload", response_model=VersionItem, status_code=status.HTTP_201_CREATED)
def upload_version(
    survey_id: int,
    req: VersionUploadRequest,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin", "researcher"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    ast = parse_questionnaire(req.raw_content)
    errors = validate_questionnaire_ast(ast)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Questionnaire validation failed", "errors": errors}
        )

    max_version = db.query(SurveyVersion.version_number)\
        .filter(SurveyVersion.survey_id == survey_id)\
        .order_by(SurveyVersion.version_number.desc())\
        .first()

    next_version = (max_version[0] + 1) if max_version else 1

    version = SurveyVersion(
        survey_id=survey_id,
        version_number=next_version,
        questionnaire_data=ast,
        raw_content=req.raw_content,
        status="DRAFT",
        uploaded_by=current_user.id,
        created_at=datetime.utcnow()
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version

@router.get("", response_model=List[SurveyListItem])
def list_surveys(
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin", "researcher"]))
):
    surveys = db.query(Survey).order_by(Survey.created_at.desc()).all()
    res = []
    for s in surveys:
        cnt = db.query(Respondent).filter(
            Respondent.survey_id == s.id,
            Respondent.status == "COMPLETED",
            Respondent.is_test == False
        ).count()
        setattr(s, "completed_count", cnt)
        res.append(s)
    return res

@router.get("/{survey_id}", response_model=SurveyDetailResponse)
def get_survey(
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin", "researcher"]))
):
    return get_survey_detail(survey_id, db)

def get_survey_detail(survey_id: int, db: Session) -> SurveyDetailResponse:
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    versions = db.query(SurveyVersion)\
        .filter(SurveyVersion.survey_id == survey_id)\
        .order_by(SurveyVersion.version_number.asc())\
        .all()

    quotas = db.query(Quota)\
        .filter(Quota.survey_id == survey_id)\
        .all()

    active_data = None
    if survey.active_version_id:
        active_ver = db.query(SurveyVersion).filter(SurveyVersion.id == survey.active_version_id).first()
        if active_ver:
            active_data = active_ver.questionnaire_data

    return SurveyDetailResponse(
        id=survey.id,
        slug=survey.slug,
        title=survey.title,
        status=survey.status,
        closed_reason=survey.closed_reason,
        target=survey.target,
        active_version_id=survey.active_version_id,
        created_by=survey.created_by,
        deadline_at=survey.deadline_at,
        closed_at=survey.closed_at,
        created_at=survey.created_at,
        updated_at=survey.updated_at,
        versions=versions,
        quotas=quotas,
        active_version_data=active_data
    )

@router.post("/{survey_id}/versions/{version_id}/approve", response_model=SurveyDetailResponse)
def approve_version(
    survey_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    version = db.query(SurveyVersion)\
        .filter(SurveyVersion.id == version_id, SurveyVersion.survey_id == survey_id)\
        .first()
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found for this survey")

    now = datetime.utcnow()
    # Freeze version
    version.status = "APPROVED"
    version.approved_by = current_user.id
    version.approved_at = now

    # Update survey status and target
    survey.active_version_id = version.id
    survey.status = "LIVE"
    survey.closed_at = None
    survey.closed_reason = None
    survey.updated_at = now

    ast = version.questionnaire_data or {}
    if "target" in ast and isinstance(ast["target"], int) and ast["target"] > 0:
        survey.target = ast["target"]

    # Restart 15-day project clock if no future deadline explicitly set
    if not survey.deadline_at or survey.deadline_at <= now:
        survey.deadline_at = now + timedelta(days=15)

    # Sync quotas table
    db.query(Quota).filter(Quota.survey_id == survey.id).delete()
    for q in ast.get("quotas", []):
        new_quota = Quota(
            survey_id=survey.id,
            question_id=q["question_id"],
            value=str(q["value"]),
            target=int(q["target"]),
            created_at=now
        )
        db.add(new_quota)

    db.commit()
    db.refresh(survey)
    return get_survey_detail(survey.id, db)

@router.patch("/{survey_id}/status", response_model=SurveyDetailResponse)
def update_survey_status(
    survey_id: int,
    req: SurveyStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    allowed = {"DRAFT", "LIVE", "CLOSED"}
    new_status = req.status.upper()
    if new_status not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid status '{req.status}'")

    now = datetime.utcnow()
    if new_status == "CLOSED":
        survey.status = "CLOSED"
        survey.closed_at = now
        survey.closed_reason = req.closed_reason.upper() if req.closed_reason else "ADMIN"
    elif new_status == "LIVE":
        survey.status = "LIVE"
        survey.closed_at = None
        survey.closed_reason = None
    else:
        survey.status = "DRAFT"

    survey.updated_at = now
    db.commit()
    return get_survey_detail(survey.id, db)

@router.patch("/{survey_id}/deadline", response_model=SurveyDetailResponse)
def update_survey_deadline(
    survey_id: int,
    req: SurveyDeadlineUpdateRequest,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    survey.deadline_at = req.deadline_at
    survey.updated_at = datetime.utcnow()
    db.commit()
    return get_survey_detail(survey.id, db)
