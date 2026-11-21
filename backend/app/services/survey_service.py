from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.survey import Survey
from app.models.quota import Quota
from app.models.respondent import Respondent
from app.models.answer import Answer
from app.models.answer_option import AnswerOption
from app.models.respondent_termination import RespondentTermination

def check_and_lazy_close(survey_id: int, db: Session) -> Survey:
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey or survey.status != "LIVE":
        return survey

    now = datetime.utcnow()
    # 1. Check deadline
    if survey.deadline_at and survey.deadline_at <= now:
        survey.status = "CLOSED"
        survey.closed_reason = "DEADLINE"
        survey.closed_at = survey.deadline_at
        db.commit()
        return survey

    # 2. Check completed count against target
    if survey.target and survey.target > 0:
        completed_count = db.query(func.count(Respondent.id))\
            .filter(Respondent.survey_id == survey_id, Respondent.status == "COMPLETED", Respondent.is_test == False)\
            .scalar() or 0
        if completed_count >= survey.target:
            survey.status = "CLOSED"
            survey.closed_reason = "TARGET"
            survey.closed_at = now
            db.commit()
            return survey

    return survey

def get_survey_quota_counts(survey_id: int, db: Session) -> Dict[Tuple[str, str], int]:
    rows = db.query(
        AnswerOption.question_id,
        AnswerOption.option_value,
        func.count(func.distinct(Respondent.id))
    )\
    .join(Answer, AnswerOption.answer_id == Answer.id)\
    .join(Respondent, Answer.respondent_id == Respondent.id)\
    .filter(
        Respondent.survey_id == survey_id,
        Respondent.status == "COMPLETED",
        Respondent.is_test == False
    )\
    .group_by(AnswerOption.question_id, AnswerOption.option_value)\
    .all()

    return {(r[0], r[1]): r[2] for r in rows}

def check_quota_available(survey_id: int, question_id: str, option_values: List[str], db: Session) -> Tuple[bool, Optional[str]]:
    """Checks if any picked option hits an already full quota."""
    quotas = db.query(Quota).filter(Quota.survey_id == survey_id, Quota.question_id == question_id).all()
    if not quotas:
        return True, None

    counts = get_survey_quota_counts(survey_id, db)
    for q in quotas:
        if q.value in option_values:
            current_done = counts.get((q.question_id, q.value), 0)
            if current_done >= q.target:
                return False, f"Quota full for {q.question_id}={q.value}"

    return True, None

def complete_survey_with_lock(respondent_id: str, db: Session) -> Tuple[str, Optional[str]]:
    """
    Serializes capacity verification under a SELECT FOR UPDATE row lock on the Survey table.
    Eliminates race condition overshoots past quotas or survey target.
    """
    resp = db.query(Respondent).filter(Respondent.id == respondent_id).first()
    if not resp:
        return "TERMINATED", "Respondent not found"

    # Lock survey row
    survey = db.query(Survey).filter(Survey.id == resp.survey_id).with_for_update().first()
    if not survey:
        return "TERMINATED", "Survey not found"

    now = datetime.utcnow()

    # If respondent is a test preview session, skip target/quota checks
    if resp.is_test:
        resp.status = "COMPLETED"
        resp.completed_at = now
        db.commit()
        return "COMPLETED", None

    # 1. Total survey target capacity check
    completed_count = db.query(func.count(Respondent.id))\
        .filter(Respondent.survey_id == survey.id, Respondent.status == "COMPLETED", Respondent.is_test == False)\
        .scalar() or 0

    if survey.target and survey.target > 0 and completed_count >= survey.target:
        resp.status = "TERMINATED"
        resp.termination_reason = "Target full"
        term_rec = RespondentTermination(
            respondent_id=resp.id,
            question_id="TARGET",
            reason="Target full",
            created_at=now
        )
        db.add(term_rec)
        survey.status = "CLOSED"
        survey.closed_reason = "TARGET"
        survey.closed_at = now
        db.commit()
        return "TERMINATED", "Target full"

    # 2. Check all quotas against respondent's answers
    user_options = db.query(AnswerOption.question_id, AnswerOption.option_value)\
        .join(Answer, AnswerOption.answer_id == Answer.id)\
        .filter(Answer.respondent_id == resp.id)\
        .all()

    survey_quotas = db.query(Quota).filter(Quota.survey_id == survey.id).all()
    if survey_quotas:
        quota_counts = get_survey_quota_counts(survey.id, db)
        for q in survey_quotas:
            for u_qid, u_val in user_options:
                if q.question_id == u_qid and q.value == u_val:
                    done = quota_counts.get((q.question_id, q.value), 0)
                    if done >= q.target:
                        resp.status = "TERMINATED"
                        resp.termination_reason = "Quota full"
                        term_rec = RespondentTermination(
                            respondent_id=resp.id,
                            question_id=q.question_id,
                            reason=f"Quota full: {q.value}",
                            created_at=now
                        )
                        db.add(term_rec)
                        db.commit()
                        return "TERMINATED", "Quota full"

    # 3. Capacity confirmed: mark completed
    resp.status = "COMPLETED"
    resp.completed_at = now

    # Check if this completion reaches total target
    if survey.target and survey.target > 0 and (completed_count + 1) >= survey.target:
        survey.status = "CLOSED"
        survey.closed_reason = "TARGET"
        survey.closed_at = now

    db.commit()
    return "COMPLETED", None
