from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.security import require_role
from app.models.admin_user import AdminUser
from app.models.survey import Survey
from app.models.quota import Quota
from app.models.respondent import Respondent
from app.models.respondent_termination import RespondentTermination
from app.services.survey_service import get_survey_quota_counts
from app.services.export_service import export_survey_csv, export_survey_xlsx
from app.schemas.dashboard import DashboardResponse, QuotaProgressItem, TerminationReasonItem

router = APIRouter(prefix="/surveys", tags=["dashboard-export"])

@router.get("/{survey_id}/dashboard", response_model=DashboardResponse)
def get_survey_dashboard(
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin", "researcher"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    # Started: IN_PROGRESS, COMPLETED, TERMINATED (non-test)
    started_count = db.query(func.count(Respondent.id))\
        .filter(
            Respondent.survey_id == survey_id,
            Respondent.is_test == False,
            Respondent.status.in_(["IN_PROGRESS", "COMPLETED", "TERMINATED"])
        )\
        .scalar() or 0

    completed_count = db.query(func.count(Respondent.id))\
        .filter(Respondent.survey_id == survey_id, Respondent.is_test == False, Respondent.status == "COMPLETED")\
        .scalar() or 0

    terminated_count = db.query(func.count(Respondent.id))\
        .filter(Respondent.survey_id == survey_id, Respondent.is_test == False, Respondent.status == "TERMINATED")\
        .scalar() or 0

    in_progress_count = db.query(func.count(Respondent.id))\
        .filter(Respondent.survey_id == survey_id, Respondent.is_test == False, Respondent.status == "IN_PROGRESS")\
        .scalar() or 0

    # Quotas progress
    quota_counts = get_survey_quota_counts(survey_id, db)
    quotas_db = db.query(Quota).filter(Quota.survey_id == survey_id).all()
    quota_items: List[QuotaProgressItem] = []
    for q in quotas_db:
        done = quota_counts.get((q.question_id, q.value), 0)
        left = max(0, q.target - done)
        quota_items.append(QuotaProgressItem(
            id=q.id,
            question_id=q.question_id,
            value=q.value,
            target=q.target,
            done=done,
            left=left
        ))

    # Termination reasons counts
    term_counts = db.query(
        RespondentTermination.reason,
        func.count(func.distinct(RespondentTermination.respondent_id))
    )\
    .join(Respondent, RespondentTermination.respondent_id == Respondent.id)\
    .filter(Respondent.survey_id == survey_id, Respondent.is_test == False)\
    .group_by(RespondentTermination.reason)\
    .all()

    term_items = [TerminationReasonItem(reason=r[0], count=r[1]) for r in term_counts]

    return DashboardResponse(
        survey_id=survey.id,
        survey_title=survey.title,
        survey_slug=survey.slug,
        survey_status=survey.status,
        closed_reason=survey.closed_reason,
        target=survey.target,
        started=started_count,
        completed=completed_count,
        terminated=terminated_count,
        in_progress=in_progress_count,
        quotas=quota_items,
        terminations=term_items
    )

@router.get("/{survey_id}/export")
def export_survey(
    survey_id: int,
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin", "researcher"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    if format == "csv":
        csv_data = export_survey_csv(survey, db)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={survey.slug}_responses.csv"}
        )
    else:
        xlsx_data = export_survey_xlsx(survey, db)
        return Response(
            content=xlsx_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={survey.slug}_responses.xlsx"}
        )
