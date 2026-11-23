from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session, aliased
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

def get_survey_quota_counts(survey_id: int, db: Session) -> Dict[Any, int]:
    # 1. Single quota counts
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

    counts: Dict[Any, int] = {(r[0], r[1]): r[2] for r in rows}

    # 2. Nested quota counts through answer_options joined twice
    nested_quotas = db.query(Quota).filter(
        Quota.survey_id == survey_id,
        Quota.question_id_2.isnot(None),
        Quota.value_2.isnot(None)
    ).all()

    for nq in nested_quotas:
        ao1 = aliased(AnswerOption)
        ao2 = aliased(AnswerOption)
        a1 = aliased(Answer)
        a2 = aliased(Answer)
        n_count = db.query(func.count(func.distinct(Respondent.id)))\
            .join(a1, Respondent.id == a1.respondent_id)\
            .join(ao1, (ao1.answer_id == a1.id) & (ao1.question_id == nq.question_id) & (ao1.option_value == nq.value))\
            .join(a2, Respondent.id == a2.respondent_id)\
            .join(ao2, (ao2.answer_id == a2.id) & (ao2.question_id == nq.question_id_2) & (ao2.option_value == nq.value_2))\
            .filter(
                Respondent.survey_id == survey_id,
                Respondent.status == "COMPLETED",
                Respondent.is_test == False
            )\
            .scalar() or 0
        counts[(nq.question_id, nq.value, nq.question_id_2, nq.value_2)] = n_count

    return counts

def check_quota_available(
    survey_id: int,
    question_id: str,
    option_values: List[str],
    db: Session,
    respondent_id: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """Checks if any picked option hits an already full quota (single or nested)."""
    quotas = db.query(Quota).filter(Quota.survey_id == survey_id).all()
    if not quotas:
        return True, None

    counts = get_survey_quota_counts(survey_id, db)

    # Fetch respondent's existing answers if respondent_id provided
    user_answers_map: Dict[str, set] = {}
    if respondent_id:
        user_opts = db.query(AnswerOption.question_id, AnswerOption.option_value)\
            .join(Answer, AnswerOption.answer_id == Answer.id)\
            .filter(Answer.respondent_id == respondent_id)\
            .all()
        for uqid, uval in user_opts:
            user_answers_map.setdefault(uqid, set()).add(uval)

    for q in quotas:
        # 1. Single quota
        if not q.question_id_2:
            if q.question_id == question_id and q.value in option_values:
                current_done = counts.get((q.question_id, q.value), 0)
                if current_done >= q.target:
                    return False, f"Quota full for {q.question_id}={q.value}"
        else:
            # 2. Nested quota: (q.question_id, q.value) AND (q.question_id_2, q.value_2)
            # Quota-full check triggered when the second of the two questions is answered
            is_match = False
            if q.question_id == question_id and q.value in option_values:
                if q.value_2 in user_answers_map.get(q.question_id_2, set()):
                    is_match = True
            elif q.question_id_2 == question_id and q.value_2 in option_values:
                if q.value in user_answers_map.get(q.question_id, set()):
                    is_match = True

            if is_match:
                current_done = counts.get((q.question_id, q.value, q.question_id_2, q.value_2), 0)
                if current_done >= q.target:
                    return False, f"Quota full for {q.question_id}={q.value} and {q.question_id_2}={q.value_2}"

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

    # 2. Check all quotas (both single and nested) against respondent's answers
    user_options = db.query(AnswerOption.question_id, AnswerOption.option_value)\
        .join(Answer, AnswerOption.answer_id == Answer.id)\
        .filter(Answer.respondent_id == resp.id)\
        .all()
    user_opts_map: Dict[str, set] = {}
    for uqid, uval in user_options:
        user_opts_map.setdefault(uqid, set()).add(uval)

    survey_quotas = db.query(Quota).filter(Quota.survey_id == survey.id).all()
    if survey_quotas:
        quota_counts = get_survey_quota_counts(survey.id, db)
        for q in survey_quotas:
            if not q.question_id_2:
                if q.value in user_opts_map.get(q.question_id, set()):
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
            else:
                if (q.value in user_opts_map.get(q.question_id, set())) and (q.value_2 in user_opts_map.get(q.question_id_2, set())):
                    done = quota_counts.get((q.question_id, q.value, q.question_id_2, q.value_2), 0)
                    if done >= q.target:
                        resp.status = "TERMINATED"
                        resp.termination_reason = "Quota full"
                        term_rec = RespondentTermination(
                            respondent_id=resp.id,
                            question_id=q.question_id,
                            reason=f"Quota full: {q.value} & {q.value_2}",
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
