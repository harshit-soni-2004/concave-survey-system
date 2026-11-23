from datetime import datetime, timedelta
import secrets
import io
import zipfile
import xml.etree.ElementTree as ET
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import func
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

@router.post("/extract-file")
async def extract_questionnaire_file(
    file: UploadFile = File(...),
    current_user: AdminUser = Depends(require_role(["admin", "researcher"]))
):
    try:
        content_bytes = await file.read()
        filename = (file.filename or "").lower()
        
        if filename.endswith(".docx"):
            with zipfile.ZipFile(io.BytesIO(content_bytes)) as z:
                xml_content = z.read("word/document.xml")
                tree = ET.fromstring(xml_content)
                texts = []
                for p in tree.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
                    p_text = "".join(node.text for node in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t") if node.text)
                    if p_text:
                        texts.append(p_text)
                extracted = "\n".join(texts)
        else:
            try:
                extracted = content_bytes.decode("utf-8")
            except UnicodeDecodeError:
                extracted = content_bytes.decode("latin-1")
                
        return {
            "filename": file.filename,
            "size": len(content_bytes),
            "content": extracted
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read or extract file: {str(e)}"
        )

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

    slug = (req.slug or ast.get("id") or "").strip()
    if not slug:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey missing id")

    title = (req.title or ast.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey missing title")

    target = req.target if req.target is not None else ast.get("target", 0)

    # Constraint: Check duplicate slug (case-insensitive)
    existing_slug = db.query(Survey).filter(func.lower(Survey.slug) == func.lower(slug)).first()
    if existing_slug:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Survey with slug '{slug}' already exists")

    # Constraint: Check duplicate name/title (case-insensitive)
    existing_title = db.query(Survey).filter(func.lower(Survey.title) == func.lower(title)).first()
    if existing_title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"A survey with the name '{title}' already exists. Survey names must be unique across the organization."
        )

    now = datetime.utcnow()
    survey = Survey(
        slug=slug,
        title=title,
        target=target,
        status="DRAFT",
        deadline_at=req.deadline_at,
        created_by=current_user.id,
        created_at=now,
        updated_at=now
    )
    db.add(survey)
    db.flush()

    ast["id"] = slug
    ast["title"] = title
    ast["target"] = target

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
    from sqlalchemy import func
    surveys = db.query(Survey).order_by(Survey.created_at.desc()).all()
    res = []
    for s in surveys:
        counts = db.query(
            Respondent.status, func.count(Respondent.id)
        ).filter(
            Respondent.survey_id == s.id,
            Respondent.is_test == False
        ).group_by(Respondent.status).all()
        c_map = dict(counts)
        completed = c_map.get("COMPLETED", 0)
        in_prog = c_map.get("IN_PROGRESS", 0)
        term = c_map.get("TERMINATED", 0)

        setattr(s, "completed_count", completed)
        setattr(s, "started_count", completed + in_prog + term)
        setattr(s, "terminated_count", term)

        last_resp = db.query(func.max(Respondent.updated_at)).filter(
            Respondent.survey_id == s.id,
            Respondent.is_test == False
        ).scalar()
        setattr(s, "last_activity", last_resp or s.updated_at)
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
            question_id_2=q.get("question_id_2"),
            value_2=str(q["value_2"]) if q.get("value_2") is not None else None,
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

@router.post("/{survey_id}/clone", response_model=SurveyDetailResponse, status_code=status.HTTP_201_CREATED)
def clone_survey(
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin", "researcher"]))
):
    source_survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not source_survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    latest_v = db.query(SurveyVersion).filter(
        SurveyVersion.survey_id == source_survey.id
    ).order_by(SurveyVersion.version_number.desc()).first()

    if not latest_v:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey has no versions to clone")

    now = datetime.utcnow()
    base_slug = f"{source_survey.slug}_copy"
    new_slug = f"{base_slug}_{secrets.token_hex(3)}"
    while db.query(Survey).filter(func.lower(Survey.slug) == func.lower(new_slug)).first():
        new_slug = f"{base_slug}_{secrets.token_hex(3)}"

    base_title = f"Copy of {source_survey.title}"
    new_title = base_title
    copy_idx = 2
    while db.query(Survey).filter(func.lower(Survey.title) == func.lower(new_title)).first():
        new_title = f"{base_title} ({copy_idx})"
        copy_idx += 1

    new_ast = dict(latest_v.questionnaire_data) if latest_v.questionnaire_data else {}
    new_ast["id"] = new_slug
    new_ast["title"] = new_title

    new_survey = Survey(
        slug=new_slug,
        title=new_title,
        status="DRAFT",
        target=source_survey.target,
        created_by=current_user.id,
        created_at=now,
        updated_at=now
    )
    db.add(new_survey)
    db.flush()

    new_version = SurveyVersion(
        survey_id=new_survey.id,
        version_number=1,
        questionnaire_data=new_ast,
        raw_content=latest_v.raw_content,
        status="DRAFT",
        uploaded_by=current_user.id,
        created_at=now
    )
    db.add(new_version)
    db.commit()

    return get_survey_detail(new_survey.id, db)
