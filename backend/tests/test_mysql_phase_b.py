import os
import secrets
import threading
from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.main import app
from app.core.database import SessionLocal, get_db
from app.models.admin_user import AdminUser
from app.models.survey import Survey
from app.models.survey_version import SurveyVersion
from app.models.quota import Quota
from app.models.respondent import Respondent
from app.models.answer import Answer
from app.models.answer_option import AnswerOption
from app.models.respondent_termination import RespondentTermination
from app.services.survey_service import complete_survey_with_lock

@pytest.fixture(scope="module")
def mysql_client():
    # Use real MySQL database
    with TestClient(app) as c:
        yield c

def get_admin_token(client):
    res = client.post("/api/auth/login", json={
        "email": "admin@concave.com",
        "password": "AdminPassword123!"
    })
    return res.json()["access_token"]

def test_mysql_reopen_priority(mysql_client):
    db: Session = SessionLocal()
    survey = db.query(Survey).filter(Survey.slug == "smartphone_study").first()
    assert survey is not None

    token_completed = secrets.token_urlsafe(16)
    token_terminated = secrets.token_urlsafe(16)

    r_comp = Respondent(
        id=secrets.token_hex(16),
        survey_id=survey.id,
        survey_version_id=survey.active_version_id,
        token=token_completed,
        status="COMPLETED",
        is_test=False,
        completed_at=datetime.utcnow(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    r_term = Respondent(
        id=secrets.token_hex(16),
        survey_id=survey.id,
        survey_version_id=survey.active_version_id,
        token=token_terminated,
        status="TERMINATED",
        is_test=False,
        termination_reason="City not in scope",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(r_comp)
    db.add(r_term)
    db.commit()
    db.close()

    # 1. Check completed respondent sees "Already completed"
    res1 = mysql_client.get(f"/api/respondent/{token_completed}/session")
    assert res1.status_code == 200
    assert res1.json()["screen"] == "Already completed"

    # 2. Check terminated respondent sees "Not eligible"
    res2 = mysql_client.get(f"/api/respondent/{token_terminated}/session")
    assert res2.status_code == 200
    assert res2.json()["screen"] == "Not eligible"
    assert res2.json()["termination_reason"] == "City not in scope"

def test_mysql_version_pinned_on_first_answer(mysql_client):
    token = mysql_client.post("/api/surveys/smartphone_study/join").json()["token"]

    db: Session = SessionLocal()
    survey = db.query(Survey).filter(Survey.slug == "smartphone_study").first()
    original_version_id = survey.active_version_id
    db.close()

    # Respondent answers first question q0 (info) or q1 (consent)
    res = mysql_client.post(f"/api/respondent/{token}/answer", json={
        "question_id": "q0",
        "answer_value": "Viewed"
    })
    assert res.status_code == 200

    db = SessionLocal()
    resp = db.query(Respondent).filter(Respondent.token == token).first()
    assert resp.survey_version_id == original_version_id
    db.close()

def test_mysql_back_with_skip_to_and_pruning(mysql_client):
    token = mysql_client.post("/api/surveys/smartphone_study/join").json()["token"]

    # Step through to q12
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q0", "answer_value": "Viewed"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q1", "answer_value": "Yes"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q2", "answer_value": 25})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q3", "answer_value": "Male"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q4", "answer_value": "Mumbai"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q5", "answer_value": "Yes"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q6", "answer_value": ["Samsung"]})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q7", "answer_value": "Samsung"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q8", "answer_value": 4})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q10", "answer_value": 9})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q11", "answer_value": {
        "The battery lasts a full day": "Agree",
        "The camera takes good photos": "Agree",
        "It works smoothly without lag": "Agree",
        "It was good value for money": "Agree"
    }})

    # q12 has skip-to="q16" on "No"
    skip_res = mysql_client.post(f"/api/respondent/{token}/answer", json={
        "question_id": "q12",
        "answer_value": "No"
    })
    assert skip_res.status_code == 200
    assert skip_res.json()["question"]["id"] == "q16"

    # Answer q16
    q16_res = mysql_client.post(f"/api/respondent/{token}/answer", json={
        "question_id": "q16",
        "answer_value": "John Doe"
    })
    assert q16_res.status_code == 200
    assert q16_res.json()["question"]["id"] == "q17"

    # Click Back -> goes back to q16
    back1 = mysql_client.post(f"/api/respondent/{token}/back")
    assert back1.status_code == 200
    assert back1.json()["question"]["id"] == "q16"

    # Click Back again -> goes back to q12, prunes answer for q16
    back2 = mysql_client.post(f"/api/respondent/{token}/back")
    assert back2.status_code == 200
    assert back2.json()["question"]["id"] == "q12"

    db: Session = SessionLocal()
    resp = db.query(Respondent).filter(Respondent.token == token).first()
    q16_ans = db.query(Answer).filter(Answer.respondent_id == resp.id, Answer.question_id == "q16").first()
    assert q16_ans is None # Pruned!
    db.close()

def test_mysql_concurrent_completions_with_row_lock():
    """
    Tests SELECT FOR UPDATE survey row locking prevents race condition overshoots.
    Two threads concurrently attempt to complete when only 1 slot remains.
    """
    db: Session = SessionLocal()
    # Create an isolated survey with target=1
    s_slug = f"concurrency_study_{secrets.token_hex(4)}"
    survey = Survey(
        slug=s_slug,
        title="Concurrency Study",
        target=1,
        status="LIVE",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(survey)
    db.flush()

    # Create two respondents
    r1 = Respondent(
        id=secrets.token_hex(16),
        survey_id=survey.id,
        token=secrets.token_urlsafe(16),
        status="IN_PROGRESS",
        is_test=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    r2 = Respondent(
        id=secrets.token_hex(16),
        survey_id=survey.id,
        token=secrets.token_urlsafe(16),
        status="IN_PROGRESS",
        is_test=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(r1)
    db.add(r2)
    db.commit()
    survey_id = survey.id
    r1_id = r1.id
    r2_id = r2.id
    db.close()

    results = []

    def try_complete(resp_id):
        sess = SessionLocal()
        status_res, reason = complete_survey_with_lock(resp_id, sess)
        results.append(status_res)
        sess.close()

    t1 = threading.Thread(target=try_complete, args=(r1_id,))
    t2 = threading.Thread(target=try_complete, args=(r2_id,))

    t1.start()
    t2.start()
    t1.join()
    t2.join()

    # Verify results: Exactly one COMPLETED and one TERMINATED ("Target full")
    assert "COMPLETED" in results
    assert "TERMINATED" in results

    # Verify in DB: exactly 1 completed respondent, 0 overshoot!
    db = SessionLocal()
    comp_count = db.query(func.count(Respondent.id))\
        .filter(Respondent.survey_id == survey_id, Respondent.status == "COMPLETED")\
        .scalar()
    assert comp_count == 1

    # Verify survey is automatically closed with closed_reason="TARGET"
    surv_check = db.query(Survey).filter(Survey.id == survey_id).first()
    assert surv_check.status == "CLOSED"
    assert surv_check.closed_reason == "TARGET"
    db.close()

def test_mysql_dashboard_and_export_sample_survey(mysql_client):
    admin_token = get_admin_token(mysql_client)

    db: Session = SessionLocal()
    survey = db.query(Survey).filter(Survey.slug == "smartphone_study").first()
    assert survey is not None
    s_id = survey.id
    db.close()

    # 1. Test Dashboard endpoint
    dash_res = mysql_client.get(
        f"/api/surveys/{s_id}/dashboard",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["survey_slug"] == "smartphone_study"
    assert "quotas" in dash_data
    assert "started" in dash_data
    assert "completed" in dash_data
    assert len(dash_data["quotas"]) == 3

    # 2. Test Export CSV endpoint
    csv_res = mysql_client.get(
        f"/api/surveys/{s_id}/export?format=csv",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert csv_res.status_code == 200
    assert csv_res.headers["content-type"].startswith("text/csv")
    csv_content = csv_res.text
    header_line = csv_content.splitlines()[0]
    print(f"\nSample Survey CSV Header Row:\n{header_line}")

    # Verify required header formats
    assert header_line.startswith("Respondent ID,Version")
    # Single select / standard
    assert "Q2. What is your age?" in header_line
    assert "Q3. What is your gender?" in header_line
    # Multi select broken into one column per option
    assert "Q6. Which smartphone brands have you used in the last 3 years? (pick up to 3) - Samsung" in header_line
    assert "Q6. Which smartphone brands have you used in the last 3 years? (pick up to 3) - Apple" in header_line
    assert "Q6. Which smartphone brands have you used in the last 3 years? (pick up to 3) - Other (specify)" in header_line
    # Matrix broken into one column per row
    assert "Q11. How much do you agree with each statement about your phone? - The battery lasts a full day" in header_line
    assert "Q11. How much do you agree with each statement about your phone? - The camera takes good photos" in header_line

    # 3. Test Export XLSX endpoint
    xlsx_res = mysql_client.get(
        f"/api/surveys/{s_id}/export?format=xlsx",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert xlsx_res.status_code == 200
    assert len(xlsx_res.content) > 0


def test_mysql_back_prunes_answers_and_termination_rows(mysql_client):
    token = mysql_client.post("/api/surveys/smartphone_study/join").json()["token"]

    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q0", "answer_value": "Viewed"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q1", "answer_value": "Yes"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q2", "answer_value": 30})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q3", "answer_value": "Female"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q4", "answer_value": "Delhi"})

    # At q5, terminate-on="No" reason="Not a smartphone user"
    term_res = mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q5", "answer_value": "No"})
    assert term_res.status_code == 200
    assert term_res.json()["screen"] == "Not eligible"
    assert "Not a smartphone user" in term_res.json()["termination_reason"]

    db: Session = SessionLocal()
    resp = db.query(Respondent).filter(Respondent.token == token).first()
    assert resp.status == "TERMINATED"
    term_count = db.query(RespondentTermination).filter(RespondentTermination.respondent_id == resp.id).count()
    assert term_count > 0
    db.close()

    # Hit Back
    back_res = mysql_client.post(f"/api/respondent/{token}/back")
    assert back_res.status_code == 200
    assert back_res.json()["screen"] == "Question"
    assert back_res.json()["question"]["id"] == "q5"

    # Verify answers and termination records downstream/at q5 were pruned
    db = SessionLocal()
    resp = db.query(Respondent).filter(Respondent.token == token).first()
    assert resp.status == "IN_PROGRESS"
    assert resp.termination_reason is None
    term_after = db.query(RespondentTermination).filter(RespondentTermination.respondent_id == resp.id).count()
    assert term_after == 0
    ans_q5 = db.query(Answer).filter(Answer.respondent_id == resp.id, Answer.question_id == "q5").first()
    assert ans_q5 is None
    db.close()


def test_mysql_piping_with_other_text(mysql_client):
    token = mysql_client.post("/api/surveys/smartphone_study/join").json()["token"]

    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q0", "answer_value": "Viewed"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q1", "answer_value": "Yes"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q2", "answer_value": 28})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q3", "answer_value": "Male"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q4", "answer_value": "Mumbai"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q5", "answer_value": "Yes"})

    # Answer q6 with other_text
    mysql_client.post(f"/api/respondent/{token}/answer", json={
        "question_id": "q6",
        "answer_value": ["Other (specify)"],
        "other_text": "OnePlus Nord"
    })

    # q7 options-from=q6 -> Pick "OnePlus Nord"
    q7_res = mysql_client.post(f"/api/respondent/{token}/answer", json={
        "question_id": "q7",
        "answer_value": "OnePlus Nord"
    })
    assert q7_res.status_code == 200

    # q8 text: "How satisfied are you with [q7] overall?" -> should resolve to "How satisfied are you with OnePlus Nord overall?"
    q8_view = q7_res.json()["question"]
    assert q8_view["id"] == "q8"
    assert "OnePlus Nord" in q8_view["text"]


def test_mysql_silent_termination(mysql_client):
    admin_token = get_admin_token(mysql_client)
    slug = f"silent_{secrets.token_hex(4)}"
    raw_survey = f"""<survey id="{slug}" title="Silent Survey" target="5">
<question id="sq1" type="single" terminate-on="RejectMe" reason="Disqualified quietly" silent="true">
<text>Pick option</text>
<option>PassMe</option>
<option>RejectMe</option>
</question>
<question id="sq2" type="text">
<text>Final</text>
</question>
</survey>"""

    create_res = mysql_client.post("/api/surveys", json={"raw_content": raw_survey}, headers={"Authorization": f"Bearer {admin_token}"})
    assert create_res.status_code == 201
    s_id = create_res.json()["id"]
    v_id = create_res.json()["versions"][0]["id"]
    mysql_client.post(f"/api/surveys/{s_id}/versions/{v_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})

    join_res = mysql_client.post(f"/api/surveys/{slug}/join")
    token = join_res.json()["token"]

    ans_res = mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "sq1", "answer_value": "RejectMe"})
    assert ans_res.status_code == 200
    resp_body = ans_res.json()
    assert resp_body["screen"] == "Not eligible"
    # Silent termination must NOT reveal the reason to the respondent
    assert resp_body["termination_reason"] is None
    assert resp_body["is_silent"] is True

    # But database record must have the reason
    db: Session = SessionLocal()
    resp = db.query(Respondent).filter(Respondent.token == token).first()
    assert resp.status == "TERMINATED"
    assert resp.is_silent_termination is True
    assert "Disqualified quietly" in resp.termination_reason
    db.close()


def test_mysql_test_respondents_never_counted(mysql_client):
    admin_token = get_admin_token(mysql_client)
    db: Session = SessionLocal()
    survey = db.query(Survey).filter(Survey.slug == "smartphone_study").first()
    s_id = survey.id
    db.close()

    # Get initial dashboard
    dash_before = mysql_client.get(f"/api/surveys/{s_id}/dashboard", headers={"Authorization": f"Bearer {admin_token}"}).json()
    comp_before = dash_before["completed"]
    q_male_before = next(q["done"] for q in dash_before["quotas"] if q["value"] == "Male")

    # Create test session
    test_res = mysql_client.post(f"/api/surveys/{s_id}/test-session", headers={"Authorization": f"Bearer {admin_token}"})
    assert test_res.status_code == 200
    test_token = test_res.json()["token"]

    # Walk test respondent through survey
    mysql_client.post(f"/api/respondent/{test_token}/answer", json={"question_id": "q0", "answer_value": "Viewed"})
    mysql_client.post(f"/api/respondent/{test_token}/answer", json={"question_id": "q1", "answer_value": "Yes"})
    mysql_client.post(f"/api/respondent/{test_token}/answer", json={"question_id": "q2", "answer_value": 25})
    mysql_client.post(f"/api/respondent/{test_token}/answer", json={"question_id": "q3", "answer_value": "Male"})
    mysql_client.post(f"/api/respondent/{test_token}/answer", json={"question_id": "q4", "answer_value": "Mumbai"})
    mysql_client.post(f"/api/respondent/{test_token}/answer", json={"question_id": "q5", "answer_value": "Yes"})
    mysql_client.post(f"/api/respondent/{test_token}/answer", json={"question_id": "q6", "answer_value": ["Samsung"]})
    mysql_client.post(f"/api/respondent/{test_token}/answer", json={"question_id": "q7", "answer_value": "Samsung"})
    mysql_client.post(f"/api/respondent/{test_token}/answer", json={"question_id": "q8", "answer_value": 4})
    mysql_client.post(f"/api/respondent/{test_token}/answer", json={"question_id": "q10", "answer_value": 9})
    mysql_client.post(f"/api/respondent/{test_token}/answer", json={"question_id": "q11", "answer_value": {
        "The battery lasts a full day": "Agree",
        "The camera takes good photos": "Agree",
        "It works smoothly without lag": "Agree",
        "It was good value for money": "Agree"
    }})
    mysql_client.post(f"/api/respondent/{test_token}/answer", json={"question_id": "q12", "answer_value": "No"})
    mysql_client.post(f"/api/respondent/{test_token}/answer", json={"question_id": "q16", "answer_value": "Test User"})
    fin_res = mysql_client.post(f"/api/respondent/{test_token}/answer", json={"question_id": "q17", "answer_value": "400001"})
    assert fin_res.status_code == 200
    assert fin_res.json()["screen"] == "Completed"

    # Check dashboard counts did NOT increment
    dash_after = mysql_client.get(f"/api/surveys/{s_id}/dashboard", headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert dash_after["completed"] == comp_before
    q_male_after = next(q["done"] for q in dash_after["quotas"] if q["value"] == "Male")
    assert q_male_after == q_male_before

    # Verify export CSV does NOT contain test user
    csv_res = mysql_client.get(f"/api/surveys/{s_id}/export?format=csv", headers={"Authorization": f"Bearer {admin_token}"})
    assert "Test User" not in csv_res.text


def test_mysql_tokens_join_answers_rejected_on_non_live_surveys(mysql_client):
    admin_token = get_admin_token(mysql_client)
    slug = f"draft_{secrets.token_hex(4)}"
    raw = f"""<survey id="{slug}" title="Draft Study" target="10">
<question id="dq1" type="text"><text>Name?</text></question>
</survey>"""
    c_res = mysql_client.post("/api/surveys", json={"raw_content": raw}, headers={"Authorization": f"Bearer {admin_token}"})
    assert c_res.status_code == 201
    s_id = c_res.json()["id"]

    # 1. Non-LIVE (DRAFT) rejects batch tokens
    tok_res = mysql_client.post(f"/api/surveys/{s_id}/tokens", json={"count": 2}, headers={"Authorization": f"Bearer {admin_token}"})
    assert tok_res.status_code == 400

    # 2. Non-LIVE (DRAFT) rejects join
    join_res = mysql_client.post(f"/api/surveys/{slug}/join")
    assert join_res.status_code == 400

    # Approve to make LIVE, then close it
    v_id = c_res.json()["versions"][0]["id"]
    mysql_client.post(f"/api/surveys/{s_id}/versions/{v_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})
    # Create respondent while LIVE
    live_join = mysql_client.post(f"/api/surveys/{slug}/join")
    assert live_join.status_code == 200
    live_token = live_join.json()["token"]

    # Close survey
    mysql_client.patch(f"/api/surveys/{s_id}/status", json={"status": "CLOSED"}, headers={"Authorization": f"Bearer {admin_token}"})

    # 3. Non-LIVE (CLOSED) rejects answers
    ans_res = mysql_client.post(f"/api/respondent/{live_token}/answer", json={"question_id": "dq1", "answer_value": "Hello"})
    assert ans_res.status_code == 400


def test_mysql_export_values_for_other_multi_and_matrix(mysql_client):
    admin_token = get_admin_token(mysql_client)
    db: Session = SessionLocal()
    survey = db.query(Survey).filter(Survey.slug == "smartphone_study").first()
    s_id = survey.id
    db.close()

    # Complete a real respondent with Other text, multi-select, and matrix
    join_res = mysql_client.post("/api/surveys/smartphone_study/join")
    token = join_res.json()["token"]

    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q0", "answer_value": "Viewed"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q1", "answer_value": "Yes"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q2", "answer_value": 26})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q3", "answer_value": "Female"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q4", "answer_value": "Delhi"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q5", "answer_value": "Yes"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={
        "question_id": "q6",
        "answer_value": ["Apple", "Other (specify)"],
        "other_text": "Sony Xperia"
    })
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q7", "answer_value": "Apple"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q8", "answer_value": 5})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q10", "answer_value": 10})
    mysql_client.post(f"/api/respondent/{token}/answer", json={
        "question_id": "q11",
        "answer_value": {
            "The battery lasts a full day": "Neutral",
            "The camera takes good photos": "Strongly agree",
            "It works smoothly without lag": "Agree",
            "It was good value for money": "Disagree"
        }
    })
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q12", "answer_value": "No"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q16", "answer_value": "Jane Smith"})
    comp_res = mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q17", "answer_value": "560001"})
    assert comp_res.status_code == 200
    assert comp_res.json()["screen"] == "Completed"

    # Export CSV
    csv_res = mysql_client.get(f"/api/surveys/{s_id}/export?format=csv", headers={"Authorization": f"Bearer {admin_token}"})
    assert csv_res.status_code == 200
    lines = csv_res.text.strip().split("\n")
    headers = [h.strip() for h in lines[0].split(",")]

    # Find the row for Jane Smith
    jane_row = None
    for line in lines[1:]:
        if "Jane Smith" in line:
            jane_row = [c.strip() for c in line.split(",")]
            break
    assert jane_row is not None

    # Verify column values
    apple_col_idx = next(i for i, h in enumerate(headers) if "Q6." in h and "Apple" in h)
    other_col_idx = next(i for i, h in enumerate(headers) if "Q6." in h and "Other (specify)" in h)
    samsung_col_idx = next(i for i, h in enumerate(headers) if "Q6." in h and "Samsung" in h)

    assert jane_row[apple_col_idx] == "Apple"
    assert "Other-Sony Xperia" in jane_row[other_col_idx]
    assert jane_row[samsung_col_idx] == ""

    # Check matrix columns
    battery_col_idx = next(i for i, h in enumerate(headers) if "Q11." in h and "battery" in h)
    camera_col_idx = next(i for i, h in enumerate(headers) if "Q11." in h and "camera" in h)
    assert jane_row[battery_col_idx] == "Neutral"
    assert jane_row[camera_col_idx] == "Strongly agree"

