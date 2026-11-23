import uuid
import secrets
import random
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import require_role
from app.models.admin_user import AdminUser
from app.models.survey import Survey
from app.models.survey_version import SurveyVersion
from app.models.respondent import Respondent
from app.models.answer import Answer
from app.models.answer_option import AnswerOption
from app.models.respondent_termination import RespondentTermination
from app.engine.logic import (
    validate_answer,
    resolve_piping,
    resolve_question_options,
    get_next_question_info,
    get_effective_questions,
)
from app.services.survey_service import (
    check_and_lazy_close,
    check_quota_available,
    complete_survey_with_lock,
)
from app.schemas.respondent import (
    AnswerSubmissionRequest,
    BatchTokensRequest,
    BatchTokensResponse,
    TokenItem,
    PublicJoinResponse,
    RespondentSessionResponse,
    QuestionView,
    LanguageUpdateRequest,
)

router = APIRouter(tags=["respondent"])

def rebuild_termination_reason(resp: Respondent, db: Session):
    """Rebuilds respondent.termination_reason from all respondent_terminations rows in order."""
    term_rows = db.query(RespondentTermination).filter(
        RespondentTermination.respondent_id == resp.id
    ).order_by(RespondentTermination.id.asc()).all()
    if term_rows:
        parts = []
        for t in term_rows:
            if t.question_id and not t.reason.startswith(f"{t.question_id}:"):
                parts.append(f"{t.question_id}: {t.reason}")
            else:
                parts.append(t.reason)
        resp.termination_reason = " | ".join(parts)
    else:
        resp.termination_reason = None

def get_or_assign_rotation_arm(resp: Respondent, ast: Dict[str, Any], db: Session) -> str:
    """Assigns balanced rotation arm AB or BA based on fewer completed + in-progress respondents (non-test only)."""
    meta = dict(resp.meta or {})
    if "rotation_arm" in meta:
        return meta["rotation_arm"]

    rotations = ast.get("rotations", [])
    if not rotations:
        return "AB"

    # Non-test respondents only
    survey_resps = db.query(Respondent).filter(
        Respondent.survey_id == resp.survey_id,
        Respondent.is_test == False,
        Respondent.status.in_(["COMPLETED", "IN_PROGRESS"])
    ).all()

    ab_count = 0
    ba_count = 0
    for r in survey_resps:
        r_arm = (r.meta or {}).get("rotation_arm")
        if r_arm == "AB":
            ab_count += 1
        elif r_arm == "BA":
            ba_count += 1

    assigned = "AB" if ab_count <= ba_count else "BA"
    meta["rotation_arm"] = assigned
    resp.meta = meta
    db.commit()
    return assigned

def format_session_response(
    resp: Respondent,
    survey: Survey,
    ast: Dict[str, Any],
    curr_q: Optional[Dict[str, Any]],
    db: Session
) -> RespondentSessionResponse:
    # 1. Reopen priority checks
    if resp.status == "COMPLETED":
        return RespondentSessionResponse(
            status="COMPLETED",
            token=resp.token,
            survey_id=survey.id,
            survey_title=survey.title,
            survey_slug=survey.slug,
            is_test=resp.is_test,
            screen="Already completed",
            termination_reason=None,
            is_silent=False,
            question=None
        )

    if resp.status == "TERMINATED":
        return RespondentSessionResponse(
            status="TERMINATED",
            token=resp.token,
            survey_id=survey.id,
            survey_title=survey.title,
            survey_slug=survey.slug,
            is_test=resp.is_test,
            screen="Not eligible",
            termination_reason=resp.termination_reason if not resp.is_silent_termination else None,
            is_silent=resp.is_silent_termination,
            question=None
        )

    if survey.status == "CLOSED" and not resp.is_test:
        return RespondentSessionResponse(
            status="CLOSED",
            token=resp.token,
            survey_id=survey.id,
            survey_title=survey.title,
            survey_slug=survey.slug,
            is_test=resp.is_test,
            screen="Survey closed",
            termination_reason=None,
            is_silent=False,
            question=None
        )

    # Active session question view
    if curr_q is None:
        return RespondentSessionResponse(
            status=resp.status,
            token=resp.token,
            survey_id=survey.id,
            survey_title=survey.title,
            survey_slug=survey.slug,
            is_test=resp.is_test,
            screen="Completed",
            question=None
        )

    answers_records = db.query(Answer).filter(Answer.respondent_id == resp.id).all()
    answers_map = {a.question_id: a.answer_value for a in answers_records}
    other_texts_map = {a.question_id: a.other_text for a in answers_records if a.other_text}
    meta = dict(resp.meta or {})
    rotation_arm = meta.get("rotation_arm")
    questions_list = get_effective_questions(ast, rotation_arm)
    questions_map = {q["id"]: q for q in questions_list}

    # Resolve piping
    resolved_text = resolve_piping(curr_q.get("text", ""), answers_map, other_texts_map, questions_map)

    # Resolve options (shuffle + options-from)
    resolved_opts = resolve_question_options(curr_q, answers_map, questions_map, respondent_id=resp.id)

    # Check if already answered
    existing_ans = answers_map.get(curr_q["id"])
    existing_other = other_texts_map.get(curr_q["id"])

    # Calculate progress
    q_ids = [q["id"] for q in questions_list]
    curr_idx = q_ids.index(curr_q["id"]) if curr_q["id"] in q_ids else 0
    progress = int((curr_idx / max(len(q_ids), 1)) * 100)

    # Matrix row shuffle with saved order
    q_rows = list(curr_q.get("rows", []))
    is_matrix_shuffle = (curr_q.get("type") == "matrix" and (
        curr_q.get("shuffle") is True or
        curr_q.get("shuffle") == "true" or
        curr_q.get("attributes", {}).get("shuffle") in (True, "true")
    ))
    if is_matrix_shuffle and q_rows:
        matrix_orders = dict(meta.get("matrix_row_order") or {})
        qid = curr_q["id"]
        if qid in matrix_orders:
            saved_order = matrix_orders[qid]
            row_map = {r.get("text"): r for r in q_rows}
            reordered = [row_map[t] for t in saved_order if t in row_map]
            for r in q_rows:
                if r not in reordered:
                    reordered.append(r)
            q_rows = reordered
        else:
            shuffled = list(q_rows)
            random.shuffle(shuffled)
            matrix_orders[qid] = [r.get("text") for r in shuffled]
            meta["matrix_row_order"] = matrix_orders
            resp.meta = meta
            db.commit()
            q_rows = shuffled

    active_lang = meta.get("language", "en")
    translations = curr_q.get("translations", {})

    q_view = QuestionView(
        id=curr_q["id"],
        type=curr_q.get("type", "text"),
        text=resolved_text,
        required=bool(curr_q.get("required", False)),
        options=resolved_opts,
        rows=q_rows,
        min=curr_q.get("min"),
        max=curr_q.get("max"),
        minlength=curr_q.get("minlength"),
        low_label=curr_q.get("low-label") or curr_q.get("low_label"),
        high_label=curr_q.get("high-label") or curr_q.get("high_label"),
        format=curr_q.get("format"),
        translations=translations,
        active_language=active_lang,
        current_answer=existing_ans,
        current_other_text=existing_other,
        can_go_back=bool(resp.path and len(resp.path) > 0),
        progress_percentage=progress
    )

    return RespondentSessionResponse(
        status=resp.status,
        token=resp.token,
        survey_id=survey.id,
        survey_title=survey.title,
        survey_slug=survey.slug,
        is_test=resp.is_test,
        screen="Question",
        question=q_view
    )

@router.get("/respondent/{token}/session", response_model=RespondentSessionResponse)
def get_session(token: str, db: Session = Depends(get_db)):
    resp = db.query(Respondent).filter(Respondent.token == token).first()
    if not resp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid participation link")

    survey = check_and_lazy_close(resp.survey_id, db)

    version_record = resp.survey_version or survey.active_version
    if not version_record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey has no published version")

    ast = version_record.questionnaire_data or {}
    meta = dict(resp.meta or {})
    rotation_arm = meta.get("rotation_arm")
    questions = get_effective_questions(ast, rotation_arm)

    curr_q = None
    if resp.current_question_id:
        curr_q = next((q for q in questions if q["id"] == resp.current_question_id), None)

    if curr_q is None and resp.status not in ("COMPLETED", "TERMINATED"):
        answers_records = db.query(Answer).filter(Answer.respondent_id == resp.id).all()
        answers_map = {a.question_id: a.answer_value for a in answers_records}
        if ast.get("rotations") and not resp.is_test and not rotation_arm:
            rotation_arm = get_or_assign_rotation_arm(resp, ast, db)
        first_q, _, _ = get_next_question_info(ast, None, None, answers_map, [], rotation_arm=rotation_arm)
        curr_q = first_q
        if curr_q:
            resp.current_question_id = curr_q["id"]
            if not resp.started_at:
                resp.started_at = datetime.utcnow()
            db.commit()

    return format_session_response(resp, survey, ast, curr_q, db)

@router.post("/respondent/{token}/answer", response_model=RespondentSessionResponse)
def submit_answer(
    token: str,
    req: AnswerSubmissionRequest,
    db: Session = Depends(get_db)
):
    resp = db.query(Respondent).filter(Respondent.token == token).first()
    if not resp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid participation link")

    survey = check_and_lazy_close(resp.survey_id, db)
    if survey.status != "LIVE" and not resp.is_test:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey is not LIVE")

    # Pin version on first answer
    if not resp.survey_version_id:
        if not survey.active_version_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey is not active")
        resp.survey_version_id = survey.active_version_id
        db.flush()

    version_record = resp.survey_version or survey.active_version
    ast = version_record.questionnaire_data or {}
    meta = dict(resp.meta or {})
    rotation_arm = meta.get("rotation_arm")
    questions = get_effective_questions(ast, rotation_arm)
    questions_map = {q["id"]: q for q in questions}

    if req.question_id not in questions_map:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Question '{req.question_id}' not in version")

    curr_q = questions_map[req.question_id]

    # Validate answer
    is_valid, err_msg = validate_answer(curr_q, req.answer_value, req.other_text)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    now = datetime.utcnow()

    # Autosave answer
    ans_record = db.query(Answer).filter(Answer.respondent_id == resp.id, Answer.question_id == req.question_id).first()
    if ans_record:
        ans_record.answer_value = req.answer_value
        ans_record.other_text = req.other_text
        ans_record.updated_at = now
    else:
        ans_record = Answer(
            respondent_id=resp.id,
            question_id=req.question_id,
            answer_value=req.answer_value,
            other_text=req.other_text,
            created_at=now,
            updated_at=now
        )
        db.add(ans_record)
    db.flush()

    # Write normalized answer_options rows
    db.query(AnswerOption).filter(AnswerOption.answer_id == ans_record.id).delete()
    q_type = curr_q.get("type")
    if q_type in ("single", "dropdown", "yesno", "consent"):
        if req.answer_value is not None and req.answer_value != "":
            db.add(AnswerOption(
                answer_id=ans_record.id,
                question_id=req.question_id,
                option_value=str(req.answer_value),
                created_at=now
            ))
    elif q_type == "multi" and isinstance(req.answer_value, list):
        for item in req.answer_value:
            db.add(AnswerOption(
                answer_id=ans_record.id,
                question_id=req.question_id,
                option_value=str(item),
                created_at=now
            ))
    db.flush()

    # Check quota at the quota question if full (single & nested supported)
    if not resp.is_test:
        opts_to_check = [str(req.answer_value)] if not isinstance(req.answer_value, list) else [str(x) for x in req.answer_value]
        is_quota_ok, quota_err = check_quota_available(survey.id, req.question_id, opts_to_check, db, respondent_id=resp.id)
        if not is_quota_ok:
            resp.status = "TERMINATED"
            term_rec = RespondentTermination(
                respondent_id=resp.id,
                question_id=req.question_id,
                reason="Quota full",
                created_at=now
            )
            db.add(term_rec)
            db.flush()
            rebuild_termination_reason(resp, db)
            db.commit()
            return format_session_response(resp, survey, ast, None, db)

    # Check screener terminate-on rule
    term_trigger = None
    if q_type == "consent" and req.answer_value == "No":
        resp.status = "TERMINATED"
        term_rec = RespondentTermination(
            respondent_id=resp.id,
            question_id=req.question_id,
            reason="Consent declined",
            created_at=now
        )
        db.add(term_rec)
        db.flush()
        rebuild_termination_reason(resp, db)
        db.commit()
        return format_session_response(resp, survey, ast, None, db)
    else:
        term_val = curr_q.get("terminate_on") or curr_q.get("terminate-on") or curr_q.get("attributes", {}).get("terminate-on")
        if term_val is not None:
            matches = False
            if isinstance(req.answer_value, list):
                matches = (term_val in req.answer_value)
            else:
                matches = (str(req.answer_value) == str(term_val))
            if matches:
                reason = curr_q.get("reason") or curr_q.get("attributes", {}).get("reason") or "Disqualified by screening criteria"
                silent = bool(curr_q.get("silent") or curr_q.get("attributes", {}).get("silent", False))
                
                existing_t = db.query(RespondentTermination).filter(
                    RespondentTermination.respondent_id == resp.id,
                    RespondentTermination.question_id == req.question_id
                ).first()
                if not existing_t:
                    term_rec = RespondentTermination(
                        respondent_id=resp.id,
                        question_id=req.question_id,
                        reason=reason,
                        created_at=now
                    )
                    db.add(term_rec)
                    db.flush()

                if silent:
                    resp.is_silent_termination = True
                term_trigger = (reason, silent)
                rebuild_termination_reason(resp, db)

    # Record in path
    path = list(resp.path or [])
    if req.question_id not in path:
        path.append(req.question_id)
        resp.path = path

    has_term_history = db.query(RespondentTermination).filter(RespondentTermination.respondent_id == resp.id).count() > 0

    answers_records = db.query(Answer).filter(Answer.respondent_id == resp.id).all()
    answers_map = {a.question_id: a.answer_value for a in answers_records}

    if ast.get("rotations") and not resp.is_test and not rotation_arm:
        rotation_arm = get_or_assign_rotation_arm(resp, ast, db)

    next_q, should_terminate, final_reason = get_next_question_info(
        ast, req.question_id, req.answer_value, answers_map, path, has_term_history, rotation_arm=rotation_arm
    )

    if should_terminate:
        resp.status = "TERMINATED"
        rebuild_termination_reason(resp, db)
        if not resp.termination_reason:
            resp.termination_reason = final_reason or "Disqualified by screening criteria"
        db.commit()
        return format_session_response(resp, survey, ast, None, db)

    if next_q is None:
        # Survey completion -> lock survey row and check target / quotas
        res_status, term_reason = complete_survey_with_lock(resp.id, db)
        if res_status == "COMPLETED":
            return RespondentSessionResponse(
                status="COMPLETED",
                token=resp.token,
                survey_title=survey.title,
                survey_slug=survey.slug,
                is_test=resp.is_test,
                screen="Completed",
                question=None
            )
        rebuild_termination_reason(resp, db)
        return format_session_response(resp, survey, ast, None, db)

    resp.current_question_id = next_q["id"]
    resp.status = "IN_PROGRESS"
    db.commit()
    return format_session_response(resp, survey, ast, next_q, db)

@router.post("/respondent/{token}/back", response_model=RespondentSessionResponse)
def go_back(token: str, db: Session = Depends(get_db)):
    resp = db.query(Respondent).filter(Respondent.token == token).first()
    if not resp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid participation link")

    survey = check_and_lazy_close(resp.survey_id, db)
    if survey.status != "LIVE" and not resp.is_test:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey is not LIVE")
    version_record = resp.survey_version or survey.active_version
    ast = version_record.questionnaire_data or {}
    meta = dict(resp.meta or {})
    rotation_arm = meta.get("rotation_arm")
    questions = get_effective_questions(ast, rotation_arm)
    questions_map = {q["id"]: q for q in questions}

    path = list(resp.path or [])
    if not path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot go back from initial question")

    # Step back: previous question was last in path
    prev_qid = path.pop()
    resp.path = path
    resp.current_question_id = prev_qid

    # Prune unreachable downstream answers
    # Any answers that were given to questions after prev_qid are deleted
    all_qids = [q["id"] for q in questions]
    if prev_qid in all_qids:
        prev_idx = all_qids.index(prev_qid)
        downstream_qids = all_qids[prev_idx:]
        db.query(Answer).filter(
            Answer.respondent_id == resp.id,
            Answer.question_id.in_(downstream_qids)
        ).delete(synchronize_session=False)

        db.query(RespondentTermination).filter(
            RespondentTermination.respondent_id == resp.id,
            RespondentTermination.question_id.in_(downstream_qids)
        ).delete(synchronize_session=False)

    rebuild_termination_reason(resp, db)
    if resp.status == "TERMINATED":
        resp.status = "IN_PROGRESS"
        resp.is_silent_termination = False

    db.commit()

    curr_q = questions_map.get(prev_qid)
    return format_session_response(resp, survey, ast, curr_q, db)

@router.post("/respondent/{token}/language", response_model=RespondentSessionResponse)
def update_respondent_language(token: str, req: LanguageUpdateRequest, db: Session = Depends(get_db)):
    resp = db.query(Respondent).filter(Respondent.token == token).first()
    if not resp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid participation link")

    survey = check_and_lazy_close(resp.survey_id, db)
    version_record = resp.survey_version or survey.active_version
    ast = version_record.questionnaire_data or {}

    meta = dict(resp.meta or {})
    meta["language"] = req.language
    resp.meta = meta
    db.commit()

    rotation_arm = meta.get("rotation_arm")
    questions = get_effective_questions(ast, rotation_arm)
    questions_map = {q["id"]: q for q in questions}
    curr_q = questions_map.get(resp.current_question_id)
    return format_session_response(resp, survey, ast, curr_q, db)

@router.post("/surveys/{survey_id}/tokens", response_model=BatchTokensResponse)
def generate_tokens(
    survey_id: int,
    req: BatchTokensRequest,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin", "researcher"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    if survey.status != "LIVE":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tokens can only be generated for LIVE surveys")

    tokens_list: List[TokenItem] = []
    now = datetime.utcnow()

    for _ in range(req.count):
        token_str = secrets.token_urlsafe(16)
        resp = Respondent(
            id=str(uuid.uuid4()),
            survey_id=survey.id,
            survey_version_id=survey.active_version_id,
            token=token_str,
            status="NOT_STARTED",
            is_test=False,
            created_at=now,
            updated_at=now
        )
        db.add(resp)
        tokens_list.append(TokenItem(
            token=token_str,
            url=f"/r/{token_str}"
        ))

    db.commit()
    return BatchTokensResponse(survey_id=survey.id, tokens=tokens_list)

@router.post("/surveys/{slug}/join", response_model=PublicJoinResponse)
def public_join(slug: str, db: Session = Depends(get_db)):
    survey = db.query(Survey).filter(Survey.slug == slug).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    survey = check_and_lazy_close(survey.id, db)
    if survey.status != "LIVE":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey is closed")

    token_str = secrets.token_urlsafe(16)
    now = datetime.utcnow()
    resp = Respondent(
        id=str(uuid.uuid4()),
        survey_id=survey.id,
        survey_version_id=survey.active_version_id,
        token=token_str,
        status="NOT_STARTED",
        is_test=False,
        created_at=now,
        updated_at=now
    )
    db.add(resp)
    db.commit()

    return PublicJoinResponse(
        token=token_str,
        survey_slug=survey.slug,
        url=f"/r/{token_str}"
    )

@router.post("/surveys/{survey_id}/test-session", response_model=PublicJoinResponse)
def create_test_session(
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin", "researcher"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    target_version_id = survey.active_version_id
    if not target_version_id:
        latest_ver = db.query(SurveyVersion).filter(SurveyVersion.survey_id == survey.id).order_by(SurveyVersion.version_number.desc()).first()
        if latest_ver:
            target_version_id = latest_ver.id
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey has no questionnaire version")

    token_str = f"test_{secrets.token_urlsafe(12)}"
    now = datetime.utcnow()
    resp = Respondent(
        id=str(uuid.uuid4()),
        survey_id=survey.id,
        survey_version_id=target_version_id,
        token=token_str,
        status="NOT_STARTED",
        is_test=True,
        created_at=now,
        updated_at=now
    )
    db.add(resp)
    db.commit()

    return PublicJoinResponse(
        token=token_str,
        survey_slug=survey.slug,
        url=f"/r/{token_str}"
    )
