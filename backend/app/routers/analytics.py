import statistics
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import require_role
from app.models.admin_user import AdminUser
from app.models.survey import Survey
from app.models.survey_version import SurveyVersion
from app.models.quota import Quota
from app.models.respondent import Respondent
from app.models.respondent_termination import RespondentTermination
from app.models.answer import Answer
from app.services.survey_service import get_survey_quota_counts
from app.services.export_service import compute_quality_flags
from app.schemas.dashboard import (
    TerminationReasonItem,
    QualityFlagsSummary,
    DropoffItem
)
from app.schemas.analytics import (
    DailyCountItem,
    DeadlineItem,
    QuotaAlertItem,
    RecentEventItem,
    OverviewResponse,
    AnalyticsDailyTrendItem,
    AnalyticsAlerts,
    SurveyAnalyticsResponse,
    RespondentListItem,
    SurveyRespondentsResponse
)

router = APIRouter(tags=["analytics"])

@router.get("/overview", response_model=OverviewResponse)
def get_portfolio_overview(
    days: int = Query(14, ge=7, le=365),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin", "researcher"]))
):
    now = datetime.utcnow()
    
    # Status counts and live count
    surveys = db.query(Survey).all()
    status_counts = {"ALL": len(surveys), "LIVE": 0, "DRAFT": 0, "CLOSED": 0}
    total_target = 0
    for s in surveys:
        st = (s.status or "DRAFT").upper()
        status_counts[st] = status_counts.get(st, 0) + 1
        total_target += (s.target or 0)
        
    live_studies = status_counts["LIVE"]

    # Respondent counts (non-test only)
    total_completes = db.query(func.count(Respondent.id)).filter(
        Respondent.is_test == False,
        Respondent.status == "COMPLETED"
    ).scalar() or 0

    in_progress = db.query(func.count(Respondent.id)).filter(
        Respondent.is_test == False,
        Respondent.status == "IN_PROGRESS"
    ).scalar() or 0

    terminated = db.query(func.count(Respondent.id)).filter(
        Respondent.is_test == False,
        Respondent.status == "TERMINATED"
    ).scalar() or 0

    overall_progress_percent = round((total_completes / total_target * 100.0), 1) if total_target > 0 else 0.0

    # Completes per day for requested timeframe (default 14 days)
    today = now.date()
    start_date = today - timedelta(days=days - 1)
    
    completes_rows = db.query(
        func.date(Respondent.completed_at),
        func.count(Respondent.id)
    ).filter(
        Respondent.is_test == False,
        Respondent.status == "COMPLETED",
        Respondent.completed_at != None,
        Respondent.completed_at >= datetime.combine(start_date, datetime.min.time())
    ).group_by(func.date(Respondent.completed_at)).all()
    
    completes_map = {str(r[0]): r[1] for r in completes_rows if r[0]}
    completes_per_day: List[DailyCountItem] = []
    for i in range(days):
        d_str = (start_date + timedelta(days=i)).isoformat()
        completes_per_day.append(DailyCountItem(date=d_str, count=completes_map.get(d_str, 0)))

    # Soonest deadlines (top 5 LIVE surveys with deadline)
    deadline_surveys = [s for s in surveys if s.status == "LIVE" and s.deadline_at is not None]
    deadline_surveys.sort(key=lambda s: s.deadline_at)
    soonest_deadlines: List[DeadlineItem] = []
    for s in deadline_surveys[:5]:
        d_left = (s.deadline_at - now).days
        h_left = max(0, int((s.deadline_at - now).total_seconds() / 3600))
        soonest_deadlines.append(DeadlineItem(
            id=s.id,
            title=s.title,
            slug=s.slug,
            status=s.status,
            deadline_at=s.deadline_at.isoformat(),
            days_left=d_left,
            hours_left=h_left
        ))

    # Quota alerts across all LIVE surveys (any quota at >= 90%)
    quota_alerts: List[QuotaAlertItem] = []
    live_survey_objs = [s for s in surveys if s.status == "LIVE"]
    for s in live_survey_objs:
        q_counts = get_survey_quota_counts(s.id, db)
        for q in s.quotas:
            if not q.question_id_2:
                done = q_counts.get((q.question_id, q.value), 0)
            else:
                done = q_counts.get((q.question_id, q.value, q.question_id_2, q.value_2), 0)
            if q.target > 0 and done >= (0.9 * q.target):
                pct = round((done / q.target * 100.0), 1)
                quota_alerts.append(QuotaAlertItem(
                    survey_id=s.id,
                    survey_title=s.title,
                    survey_slug=s.slug,
                    question_id=q.question_id,
                    value=q.value,
                    question_id_2=q.question_id_2,
                    value_2=q.value_2,
                    target=q.target,
                    done=done,
                    percent=pct
                ))

    # 10 Most recent events (completed, terminated, approved, closed)
    recent_events_raw = []
    # 1. Recent completes
    c_resps = db.query(Respondent).join(Survey, Respondent.survey_id == Survey.id)\
        .filter(Respondent.is_test == False, Respondent.status == "COMPLETED", Respondent.completed_at != None)\
        .order_by(Respondent.completed_at.desc()).limit(10).all()
    for r in c_resps:
        recent_events_raw.append({
            "event_type": "completed",
            "survey_id": r.survey.id,
            "survey_title": r.survey.title,
            "survey_slug": r.survey.slug,
            "message": f"Response {r.token[:8]} completed",
            "timestamp": r.completed_at
        })

    # 2. Recent terminations
    t_resps = db.query(Respondent).join(Survey, Respondent.survey_id == Survey.id)\
        .filter(Respondent.is_test == False, Respondent.status == "TERMINATED", Respondent.updated_at != None)\
        .order_by(Respondent.updated_at.desc()).limit(10).all()
    for r in t_resps:
        reason_txt = r.termination_reason or "Demographic criteria not met"
        recent_events_raw.append({
            "event_type": "terminated",
            "survey_id": r.survey.id,
            "survey_title": r.survey.title,
            "survey_slug": r.survey.slug,
            "message": f"Response {r.token[:8]} terminated: {reason_txt}",
            "timestamp": r.updated_at
        })

    # 3. Recent version approvals
    v_rows = db.query(SurveyVersion).join(Survey, SurveyVersion.survey_id == Survey.id)\
        .filter(SurveyVersion.status == "APPROVED", SurveyVersion.approved_at != None)\
        .order_by(SurveyVersion.approved_at.desc()).limit(10).all()
    for v in v_rows:
        recent_events_raw.append({
            "event_type": "survey_approved",
            "survey_id": v.survey.id,
            "survey_title": v.survey.title,
            "survey_slug": v.survey.slug,
            "message": f"Survey version v{v.version_number} approved and live",
            "timestamp": v.approved_at
        })

    # 4. Recent closed surveys
    s_closed = db.query(Survey).filter(Survey.status == "CLOSED", Survey.closed_at != None)\
        .order_by(Survey.closed_at.desc()).limit(10).all()
    for sc in s_closed:
        recent_events_raw.append({
            "event_type": "survey_closed",
            "survey_id": sc.id,
            "survey_title": sc.title,
            "survey_slug": sc.slug,
            "message": f"Study closed ({sc.closed_reason or 'Target/Deadline reached'})",
            "timestamp": sc.closed_at
        })

    recent_events_raw.sort(key=lambda x: x["timestamp"] or datetime.min, reverse=True)
    recent_events = [
        RecentEventItem(
            event_type=e["event_type"],
            survey_id=e["survey_id"],
            survey_title=e["survey_title"],
            survey_slug=e["survey_slug"],
            message=e["message"],
            timestamp=e["timestamp"].isoformat() if e["timestamp"] else now.isoformat()
        )
        for e in recent_events_raw[:10]
    ]

    return OverviewResponse(
        live_studies=live_studies,
        total_completes=total_completes,
        total_target=total_target,
        overall_progress_percent=overall_progress_percent,
        in_progress=in_progress,
        terminated=terminated,
        completes_per_day=completes_per_day,
        status_counts=status_counts,
        soonest_deadlines=soonest_deadlines,
        quota_alerts=quota_alerts,
        recent_events=recent_events
    )

@router.get("/surveys/{survey_id}/analytics", response_model=SurveyAnalyticsResponse)
def get_survey_analytics(
    survey_id: int,
    days: int = Query(14, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin", "researcher"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    now = datetime.utcnow()
    version = survey.active_version
    if not version and survey.versions:
        version = sorted(survey.versions, key=lambda v: v.version_number, reverse=True)[0]

    ast = version.questionnaire_data if version else {}
    questions = ast.get("questions", [])
    version_num = version.version_number if version else 1

    # Non-test respondents
    respondents = db.query(Respondent).filter(
        Respondent.survey_id == survey_id,
        Respondent.is_test == False
    ).all()

    started = sum(1 for r in respondents if r.status in ("IN_PROGRESS", "COMPLETED", "TERMINATED"))
    completed = sum(1 for r in respondents if r.status == "COMPLETED")
    terminated = sum(1 for r in respondents if r.status == "TERMINATED")
    in_progress = sum(1 for r in respondents if r.status == "IN_PROGRESS")

    completion_rate = round((completed / started), 4) if started > 0 else 0.0
    incidence_rate = round((completed / (completed + terminated)), 4) if (completed + terminated) > 0 else 0.0

    # Completion times in seconds
    durations = [
        (r.completed_at - r.started_at).total_seconds()
        for r in respondents
        if r.status == "COMPLETED" and r.completed_at and r.started_at and r.completed_at >= r.started_at
    ]
    median_time = round(float(statistics.median(durations)), 1) if durations else None
    avg_time = round(float(statistics.mean(durations)), 1) if durations else None

    # Daily trends and straight target pace line
    today = now.date()
    start_date = today - timedelta(days=days - 1)
    
    # Calculate study timeline for pace
    study_start = (survey.created_at or now).date()
    study_deadline = (survey.deadline_at or (now + timedelta(days=15))).date()
    total_study_days = max(1, (study_deadline - study_start).days)

    daily_trends: List[AnalyticsDailyTrendItem] = []
    
    # Pre-aggregate date counts
    started_map: Dict[str, int] = {}
    completed_map: Dict[str, int] = {}
    terminated_map: Dict[str, int] = {}

    for r in respondents:
        if r.started_at:
            s_d = r.started_at.date().isoformat()
            started_map[s_d] = started_map.get(s_d, 0) + 1
        if r.status == "COMPLETED" and r.completed_at:
            c_d = r.completed_at.date().isoformat()
            completed_map[c_d] = completed_map.get(c_d, 0) + 1
        if r.status == "TERMINATED" and r.updated_at:
            t_d = r.updated_at.date().isoformat()
            terminated_map[t_d] = terminated_map.get(t_d, 0) + 1

    for i in range(days):
        cur_date = start_date + timedelta(days=i)
        d_str = cur_date.isoformat()
        
        # Cumulative completes up to cur_date end of day
        cum_completes = sum(
            1 for r in respondents
            if r.status == "COMPLETED" and r.completed_at and r.completed_at.date() <= cur_date
        )

        # Target pace line
        elapsed = max(0, (cur_date - study_start).days)
        expected_pace = min(survey.target, round((elapsed / total_study_days) * survey.target, 1))

        daily_trends.append(AnalyticsDailyTrendItem(
            date=d_str,
            started=started_map.get(d_str, 0),
            completed=completed_map.get(d_str, 0),
            terminated=terminated_map.get(d_str, 0),
            cumulative_completes=cum_completes,
            target_pace=expected_pace
        ))

    # Projected finish date from last 3 days' pace
    last_3_days_threshold = now - timedelta(days=3)
    completes_last_3_days = sum(
        1 for r in respondents
        if r.status == "COMPLETED" and r.completed_at and r.completed_at >= last_3_days_threshold
    )
    pace_per_day = completes_last_3_days / 3.0

    if completed >= survey.target and survey.target > 0:
        projected_finish_date = now.isoformat()
    elif pace_per_day > 0 and survey.target > completed:
        days_needed = (survey.target - completed) / pace_per_day
        proj_dt = now + timedelta(days=days_needed)
        projected_finish_date = proj_dt.isoformat()
    else:
        projected_finish_date = None

    days_left = max(0, (survey.deadline_at - now).days) if survey.deadline_at else None

    # Answers distribution per question
    answers = db.query(Answer).join(Respondent, Answer.respondent_id == Respondent.id)\
        .filter(Respondent.survey_id == survey_id, Respondent.is_test == False).all()
    
    answers_by_qid: Dict[str, List[Any]] = {}
    for a in answers:
        answers_by_qid.setdefault(a.question_id, []).append(a.answer_value)

    question_analytics: List[Dict[str, Any]] = []

    for q in questions:
        qid = q.get("id")
        qtype = q.get("type", "single")
        qtext = q.get("text", "")
        q_ans_list = answers_by_qid.get(qid, [])
        base = len(q_ans_list)

        q_item: Dict[str, Any] = {
            "question_id": qid,
            "text": qtext,
            "type": qtype,
            "base": base
        }

        if qtype == "nps":
            scores = []
            for v in q_ans_list:
                try:
                    scores.append(int(v))
                except (ValueError, TypeError):
                    pass
            promoters = sum(1 for s in scores if s >= 9)
            passives = sum(1 for s in scores if s in (7, 8))
            detractors = sum(1 for s in scores if s <= 6)
            nps_score = round(((promoters - detractors) / len(scores) * 100.0), 1) if scores else 0.0
            dist = {str(i): scores.count(i) for i in range(11)}
            q_item.update({
                "promoters": promoters,
                "passives": passives,
                "detractors": detractors,
                "nps_score": nps_score,
                "distribution": dist
            })

        elif qtype == "rating":
            ratings = []
            for v in q_ans_list:
                try:
                    ratings.append(int(v))
                except (ValueError, TypeError):
                    pass
            avg_rating = round(statistics.mean(ratings), 2) if ratings else 0.0
            dist = {str(i): ratings.count(i) for i in range(1, 6)}
            q_item.update({
                "average": avg_rating,
                "low_label": q.get("low-label") or q.get("low_label") or "Low",
                "high_label": q.get("high-label") or q.get("high_label") or "High",
                "distribution": dist
            })

        elif qtype in ("single", "dropdown", "yesno", "consent"):
            opts = [o.get("text") for o in q.get("options", [])]
            counts = {opt: 0 for opt in opts}
            other_cnt = 0
            for v in q_ans_list:
                s_val = str(v)
                if s_val in counts:
                    counts[s_val] += 1
                else:
                    other_cnt += 1
            breakdown = [
                {
                    "option": opt,
                    "count": counts[opt],
                    "percent": round((counts[opt] / base * 100.0), 1) if base > 0 else 0.0
                }
                for opt in opts
            ]
            if other_cnt > 0:
                breakdown.append({
                    "option": "Other",
                    "count": other_cnt,
                    "percent": round((other_cnt / base * 100.0), 1) if base > 0 else 0.0
                })
            q_item["options"] = breakdown

        elif qtype == "multi":
            opts = [o.get("text") for o in q.get("options", [])]
            counts = {opt: 0 for opt in opts}
            other_cnt = 0
            for v in q_ans_list:
                if isinstance(v, list):
                    for item in v:
                        s_item = str(item)
                        if s_item in counts:
                            counts[s_item] += 1
                        else:
                            other_cnt += 1
            breakdown = [
                {
                    "option": opt,
                    "count": counts[opt],
                    "percent": round((counts[opt] / base * 100.0), 1) if base > 0 else 0.0
                }
                for opt in opts
            ]
            if other_cnt > 0:
                breakdown.append({
                    "option": "Other",
                    "count": other_cnt,
                    "percent": round((other_cnt / base * 100.0), 1) if base > 0 else 0.0
                })
            q_item["options"] = breakdown

        elif qtype == "matrix":
            rows = [r.get("text") for r in q.get("rows", [])]
            opts = [o.get("text") for o in q.get("options", [])]
            q_item["scale_options"] = opts
            matrix_breakdown = []
            for r_text in rows:
                r_counts = {opt: 0 for opt in opts}
                r_total = 0
                for v in q_ans_list:
                    if isinstance(v, dict) and r_text in v:
                        chosen = str(v[r_text])
                        if chosen in r_counts:
                            r_counts[chosen] += 1
                            r_total += 1
                matrix_breakdown.append({
                    "row": r_text,
                    "counts": r_counts,
                    "percents": {
                        opt: round((r_counts[opt] / r_total * 100.0), 1) if r_total > 0 else 0.0
                        for opt in opts
                    }
                })
            q_item["rows"] = matrix_breakdown

        question_analytics.append(q_item)

    # Top termination reasons
    term_counts = db.query(
        RespondentTermination.reason,
        func.count(func.distinct(RespondentTermination.respondent_id))
    )\
    .join(Respondent, RespondentTermination.respondent_id == Respondent.id)\
    .filter(Respondent.survey_id == survey_id, Respondent.is_test == False)\
    .group_by(RespondentTermination.reason)\
    .order_by(func.count(func.distinct(RespondentTermination.respondent_id)).desc())\
    .all()

    top_termination_reasons = [TerminationReasonItem(reason=r[0], count=r[1]) for r in term_counts]

    # Dropoff items
    dropoff_items: List[DropoffItem] = []
    total_resp_count = len(respondents)
    for q in questions:
        qid = q.get("id")
        qtext = q.get("text", "")
        qtype = q.get("type", "single")
        reached = 0
        stopped = 0
        for r in respondents:
            path = r.path or []
            has_reached = (qid in path) or (r.current_question_id == qid)
            if has_reached:
                reached += 1
                if r.status in ("TERMINATED", "IN_PROGRESS"):
                    if r.current_question_id == qid:
                        stopped += 1
                    elif not r.current_question_id and path and path[-1] == qid:
                        stopped += 1
        d_rate = round((stopped / reached * 100.0), 1) if reached > 0 else 0.0
        dropoff_items.append(DropoffItem(
            question_id=qid,
            question_text=qtext,
            question_type=qtype,
            reached=reached,
            stopped=stopped,
            dropoff_rate=d_rate
        ))

    # Quality flags & speeder calculation
    flags_map = compute_quality_flags(survey_id, db)
    speeders_cnt = sum(1 for f in flags_map.values() if "speeder" in f)
    straight_cnt = sum(1 for f in flags_map.values() if "straight-liner" in f)
    total_flg = sum(1 for f in flags_map.values() if len(f) > 0)
    quality_summary = QualityFlagsSummary(
        speeders=speeders_cnt,
        straight_liners=straight_cnt,
        total_flagged=total_flg
    )

    speeder_rate_pct = round((speeders_cnt / completed * 100.0), 1) if completed >= 5 else 0.0

    # Alerts (Requirement 1d)
    q_counts = get_survey_quota_counts(survey_id, db)
    quota_alerts_survey: List[QuotaAlertItem] = []
    for q in survey.quotas:
        if not q.question_id_2:
            done = q_counts.get((q.question_id, q.value), 0)
        else:
            done = q_counts.get((q.question_id, q.value, q.question_id_2, q.value_2), 0)
        if q.target > 0 and done >= (0.9 * q.target):
            quota_alerts_survey.append(QuotaAlertItem(
                survey_id=survey.id,
                survey_title=survey.title,
                survey_slug=survey.slug,
                question_id=q.question_id,
                value=q.value,
                question_id_2=q.question_id_2,
                value_2=q.value_2,
                target=q.target,
                done=done,
                percent=round((done / q.target * 100.0), 1)
            ))

    deadline_within_48h = False
    if survey.status == "LIVE" and survey.deadline_at:
        seconds_left = (survey.deadline_at - now).total_seconds()
        if 0 <= seconds_left <= 48 * 3600:
            deadline_within_48h = True

    projected_finish_after_deadline = False
    if survey.status == "LIVE" and projected_finish_date and survey.deadline_at:
        try:
            proj_dt = datetime.fromisoformat(projected_finish_date)
            if proj_dt > survey.deadline_at:
                projected_finish_after_deadline = True
        except Exception:
            pass

    speeder_alert = (completed >= 5 and (speeders_cnt / completed) > 0.15)

    alert_summary: List[str] = []
    for qa in quota_alerts_survey:
        label = f"{qa.question_id}={qa.value}"
        if qa.question_id_2:
            label += f" & {qa.question_id_2}={qa.value_2}"
        alert_summary.append(f"Quota '{label}' is at {qa.percent}% ({qa.done}/{qa.target})")
    if deadline_within_48h:
        alert_summary.append("Survey deadline is approaching within 48 hours")
    if projected_finish_after_deadline:
        alert_summary.append("Current completion pace projects finish after study deadline")
    if speeder_alert:
        alert_summary.append(f"High speeder rate detected: {speeder_rate_pct}% of completes")

    alerts_obj = AnalyticsAlerts(
        quota_at_or_above_90=quota_alerts_survey,
        deadline_within_48h=deadline_within_48h,
        projected_finish_after_deadline=projected_finish_after_deadline,
        speeder_rate_above_15=speeder_alert,
        speeder_rate_percent=speeder_rate_pct,
        summary=alert_summary
    )

    return SurveyAnalyticsResponse(
        survey_id=survey.id,
        survey_title=survey.title,
        survey_slug=survey.slug,
        survey_status=survey.status,
        closed_reason=survey.closed_reason,
        version_number=version_num,
        target=survey.target,
        started=started,
        completed=completed,
        terminated=terminated,
        in_progress=in_progress,
        completion_rate=completion_rate,
        incidence_rate=incidence_rate,
        median_completion_time_seconds=median_time,
        average_completion_time_seconds=avg_time,
        projected_finish_date=projected_finish_date,
        days_left_to_deadline=days_left,
        daily_trends=daily_trends,
        question_analytics=question_analytics,
        top_termination_reasons=top_termination_reasons,
        dropoff=dropoff_items,
        alerts=alerts_obj,
        quality_flags=quality_summary
    )

@router.get("/surveys/{survey_id}/respondents", response_model=SurveyRespondentsResponse)
def get_survey_respondents(
    survey_id: int,
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role(["admin", "researcher"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    query = db.query(Respondent).filter(
        Respondent.survey_id == survey_id,
        Respondent.is_test == False
    )

    if status and status.strip().upper() != "ALL":
        query = query.filter(Respondent.status == status.strip().upper())

    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)

    respondents = query.order_by(Respondent.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    flags_map = compute_quality_flags(survey_id, db)

    version_map = {v.id: v.version_number for v in survey.versions}

    items: List[RespondentListItem] = []
    for r in respondents:
        dur = None
        if r.completed_at and r.started_at and r.completed_at >= r.started_at:
            dur = int((r.completed_at - r.started_at).total_seconds())

        q_flags = flags_map.get(r.id, [])
        q_flag_str = ", ".join(q_flags) if q_flags else None

        items.append(RespondentListItem(
            id=r.id,
            masked_id=r.token[:8] if r.token else f"resp_{r.id}",
            token=r.token,
            status=r.status,
            version=version_map.get(r.survey_version_id, 1),
            started_at=r.started_at.isoformat() if r.started_at else None,
            completed_at=r.completed_at.isoformat() if r.completed_at else None,
            duration_seconds=dur,
            quality_flag=q_flag_str,
            termination_reason=r.termination_reason,
            current_question_id=r.current_question_id
        ))

    return SurveyRespondentsResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        items=items
    )
