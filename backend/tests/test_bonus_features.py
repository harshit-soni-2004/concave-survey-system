import secrets
import pytest
from starlette.testclient import TestClient
from app.main import app
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.survey import Survey
from app.models.respondent import Respondent
from app.models.respondent_termination import RespondentTermination
from app.models.quota import Quota
from app.models.answer import Answer
from app.parser.parser import parse_questionnaire
from app.parser.validator import validate_questionnaire_text

@pytest.fixture(scope="module")
def mysql_client():
    with TestClient(app) as c:
        yield c

def get_admin_token(mysql_client) -> str:
    res = mysql_client.post("/api/auth/login", json={"email": "admin@concave.com", "password": "AdminPassword123!"})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_bonus_1_multi_reason_termination_and_back(mysql_client):
    """
    1. CORE FIX, multi-reason termination:
    respondents.termination_reason holds every failed screener reason in order as
    'q4: City not in scope | q5: Not a smartphone user', one entry per failed question;
    keep one respondent_terminations row per reason;
    rebuild the string when Back prunes a termination row.
    """
    token = mysql_client.post("/api/surveys/smartphone_study/join").json()["token"]

    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q0", "answer_value": "Viewed"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q1", "answer_value": "Yes"})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q2", "answer_value": 30})
    mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q3", "answer_value": "Male"})

    # Fail q4: "Other city" triggers terminate-on="Other city" reason="City not in scope"
    # But next question q5 is also a screener (terminate-on="No"), so consecutive screener continues!
    res_q4 = mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q4", "answer_value": "Other city"})
    assert res_q4.status_code == 200
    assert res_q4.json()["screen"] == "Question"
    assert res_q4.json()["question"]["id"] == "q5"

    # Now fail q5: "No" triggers terminate-on="No" reason="Not a smartphone user"
    res_q5 = mysql_client.post(f"/api/respondent/{token}/answer", json={"question_id": "q5", "answer_value": "No"})
    assert res_q5.status_code == 200
    assert res_q5.json()["screen"] == "Not eligible"

    # Verify both reasons are held in respondents.termination_reason
    db: Session = SessionLocal()
    resp = db.query(Respondent).filter(Respondent.token == token).first()
    assert resp.status == "TERMINATED"
    assert resp.termination_reason == "q4: City not in scope | q5: Not a smartphone user"

    # Verify separate respondent_terminations rows exist
    terms = db.query(RespondentTermination).filter(RespondentTermination.respondent_id == resp.id).order_by(RespondentTermination.id.asc()).all()
    assert len(terms) == 2
    assert terms[0].question_id == "q4"
    assert terms[0].reason == "City not in scope"
    assert terms[1].question_id == "q5"
    assert terms[1].reason == "Not a smartphone user"
    db.close()

    # Hit Back from q5 -> returns to q5, pruning q5 termination
    back_1 = mysql_client.post(f"/api/respondent/{token}/back")
    assert back_1.status_code == 200
    assert back_1.json()["screen"] == "Question"
    assert back_1.json()["question"]["id"] == "q5"

    db = SessionLocal()
    resp = db.query(Respondent).filter(Respondent.token == token).first()
    assert resp.status == "IN_PROGRESS"
    assert resp.termination_reason == "q4: City not in scope"
    terms = db.query(RespondentTermination).filter(RespondentTermination.respondent_id == resp.id).all()
    assert len(terms) == 1
    assert terms[0].question_id == "q4"
    db.close()

    # Hit Back again from q5 -> returns to q4, pruning q4 termination
    back_2 = mysql_client.post(f"/api/respondent/{token}/back")
    assert back_2.status_code == 200
    assert back_2.json()["screen"] == "Question"
    assert back_2.json()["question"]["id"] == "q4"

    db = SessionLocal()
    resp = db.query(Respondent).filter(Respondent.token == token).first()
    assert resp.status == "IN_PROGRESS"
    assert resp.termination_reason is None
    terms = db.query(RespondentTermination).filter(RespondentTermination.respondent_id == resp.id).all()
    assert len(terms) == 0
    db.close()


def test_bonus_2_dropoff_report(mysql_client):
    """
    2. Drop-off report:
    for every question in the active version, how many respondents reached it,
    how many stopped there (terminated or still in progress at that question) and the percentage lost.
    GET /api/surveys/{id}/dropoff
    """
    admin_token = get_admin_token(mysql_client)
    db: Session = SessionLocal()
    survey = db.query(Survey).filter(Survey.slug == "smartphone_study").first()
    s_id = survey.id
    db.close()

    res = mysql_client.get(f"/api/surveys/{s_id}/dropoff", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["survey_id"] == s_id
    assert "questions" in data
    assert len(data["questions"]) > 0

    first_q = data["questions"][0]
    assert "question_id" in first_q
    assert "reached" in first_q
    assert "stopped" in first_q
    assert "dropoff_rate" in first_q
    assert isinstance(first_q["dropoff_rate"], float)


def test_bonus_3_clone_survey(mysql_client):
    """
    3. Clone survey:
    POST /api/surveys/{id}/clone creates a new DRAFT survey from the latest version
    with a new unique slug and the title "Copy of <title>", no respondents, answers or tokens.
    """
    admin_token = get_admin_token(mysql_client)
    db: Session = SessionLocal()
    survey = db.query(Survey).filter(Survey.slug == "smartphone_study").first()
    s_id = survey.id
    original_title = survey.title
    db.close()

    res = mysql_client.post(f"/api/surveys/{s_id}/clone", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 201
    cloned = res.json()
    assert cloned["title"] == f"Copy of {original_title}"
    assert cloned["status"] == "DRAFT"
    assert cloned["slug"].startswith("smartphone_study_copy_")
    assert cloned["id"] != s_id

    # Verify no respondents
    db = SessionLocal()
    resp_count = db.query(Respondent).filter(Respondent.survey_id == cloned["id"]).count()
    assert resp_count == 0
    db.close()


def test_bonus_4_quality_flags(mysql_client):
    """
    4. Quality flags, computed on the fly:
    - 'speeder': completed in under 1/3 of the median completion time (only when at least 5 completes exist)
    - 'straight-liner': same answer on every row of any matrix
    Show flag counts on the dashboard and add a 'Quality flag' column at the end of the export.
    """
    admin_token = get_admin_token(mysql_client)
    slug = f"quality_{secrets.token_hex(4)}"
    raw = f"""<survey id="{slug}" title="Quality Survey" target="20">
<question id="mq1" type="matrix" required>
<text>Rate aspects</text>
<row>Design</row>
<row>Speed</row>
<row>Value</row>
<option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
</question>
</survey>"""

    create_res = mysql_client.post("/api/surveys", json={"raw_content": raw}, headers={"Authorization": f"Bearer {admin_token}"})
    assert create_res.status_code == 201
    s_id = create_res.json()["id"]
    v_id = create_res.json()["versions"][0]["id"]
    mysql_client.post(f"/api/surveys/{s_id}/versions/{v_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})

    # Create straight-liner respondent: identical rating across all 3 rows
    token_sl = mysql_client.post(f"/api/surveys/{slug}/join").json()["token"]
    ans_res = mysql_client.post(f"/api/respondent/{token_sl}/answer", json={
        "question_id": "mq1",
        "answer_value": {"Design": "5", "Speed": "5", "Value": "5"}
    })
    assert ans_res.status_code == 200
    assert ans_res.json()["screen"] == "Completed"

    # Check dashboard quality flags
    dash = mysql_client.get(f"/api/surveys/{s_id}/dashboard", headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert "quality_flags" in dash
    assert dash["quality_flags"]["straight_liners"] >= 1
    assert dash["quality_flags"]["total_flagged"] >= 1

    # Check CSV export has Quality flag column
    csv_res = mysql_client.get(f"/api/surveys/{s_id}/export?format=csv", headers={"Authorization": f"Bearer {admin_token}"})
    assert csv_res.status_code == 200
    lines = csv_res.text.strip().splitlines()
    headers = [h.strip() for h in lines[0].split(",")]
    assert "Quality flag" in headers
    # Verify straight-liner appears in the exported row
    assert "straight-liner" in csv_res.text


def test_bonus_5_nested_quotas(mysql_client):
    """
    5. Nested quotas:
    A quota on two answers together (e.g. Mumbai and Male, target 1).
    Validation, approve-time sync, and quota-full rejection when second question answered.
    """
    admin_token = get_admin_token(mysql_client)

    # 1. Validator checks
    broken_nested = """<survey id="broken_nested" title="Broken" target="10">
<question id="nq1" type="single"><text>City</text><option>Mumbai</option></question>
<quota question="nq1" value="Mumbai" question2="nonexistent_q" value2="Male" target="10"/>
</survey>"""
    errs = validate_questionnaire_text(broken_nested)
    assert any("nonexistent question 'nonexistent_q'" in e["message"] for e in errs)

    # 2. Valid nested survey
    slug = f"nested_{secrets.token_hex(4)}"
    raw = f"""<survey id="{slug}" title="Nested Quota Survey" target="10">
<question id="nq1" type="dropdown" required>
<text>City?</text>
<option>Mumbai</option><option>Delhi</option>
</question>
<question id="nq2" type="single" required>
<text>Gender?</text>
<option>Male</option><option>Female</option>
</question>
<quota question="nq1" value="Mumbai" question2="nq2" value2="Male" target="1"/>
</survey>"""

    create_res = mysql_client.post("/api/surveys", json={"raw_content": raw}, headers={"Authorization": f"Bearer {admin_token}"})
    assert create_res.status_code == 201
    s_id = create_res.json()["id"]
    v_id = create_res.json()["versions"][0]["id"]
    mysql_client.post(f"/api/surveys/{s_id}/versions/{v_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})

    # Verify quotas table has question_id_2 and value_2
    db: Session = SessionLocal()
    q_db = db.query(Quota).filter(Quota.survey_id == s_id).first()
    assert q_db is not None
    assert q_db.question_id == "nq1"
    assert q_db.value == "Mumbai"
    assert q_db.question_id_2 == "nq2"
    assert q_db.value_2 == "Male"
    assert q_db.target == 1
    db.close()

    # Respondent 1: Mumbai + Male -> Completes (1/1 target reached)
    t1 = mysql_client.post(f"/api/surveys/{slug}/join").json()["token"]
    mysql_client.post(f"/api/respondent/{t1}/answer", json={"question_id": "nq1", "answer_value": "Mumbai"})
    r1 = mysql_client.post(f"/api/respondent/{t1}/answer", json={"question_id": "nq2", "answer_value": "Male"})
    assert r1.status_code == 200
    assert r1.json()["screen"] == "Completed"

    # Respondent 2: Mumbai + Male -> Rejected on answering the second question!
    t2 = mysql_client.post(f"/api/surveys/{slug}/join").json()["token"]
    mysql_client.post(f"/api/respondent/{t2}/answer", json={"question_id": "nq1", "answer_value": "Mumbai"})
    r2 = mysql_client.post(f"/api/respondent/{t2}/answer", json={"question_id": "nq2", "answer_value": "Male"})
    assert r2.status_code == 200
    assert r2.json()["screen"] == "Not eligible"
    assert "Quota full" in r2.json()["termination_reason"]

    # Check dashboard quota table shows target 1, done 1, left 0
    dash = mysql_client.get(f"/api/surveys/{s_id}/dashboard", headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert len(dash["quotas"]) == 1
    assert dash["quotas"][0]["target"] == 1
    assert dash["quotas"][0]["done"] == 1
    assert dash["quotas"][0]["left"] == 0


def test_bonus_6_matrix_row_shuffle_saved_order(mysql_client):
    """
    6. Matrix row shuffle with saved order:
    shuffle="true" on a matrix shuffles rows per respondent.
    Store order in respondents.meta, reuse on resume and Back.
    """
    admin_token = get_admin_token(mysql_client)
    slug = f"shuf_{secrets.token_hex(4)}"
    raw = f"""<survey id="{slug}" title="Shuffle Survey" target="5">
<question id="mshuf" type="matrix" shuffle="true" required>
<text>Rate aspects</text>
<row>Row A</row><row>Row B</row><row>Row C</row><row>Row D</row><row>Row E</row>
<option>1</option><option>2</option><option>3</option>
</question>
</survey>"""

    create_res = mysql_client.post("/api/surveys", json={"raw_content": raw}, headers={"Authorization": f"Bearer {admin_token}"})
    s_id = create_res.json()["id"]
    v_id = create_res.json()["versions"][0]["id"]
    mysql_client.post(f"/api/surveys/{s_id}/versions/{v_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})

    join_res = mysql_client.post(f"/api/surveys/{slug}/join").json()
    token = join_res["token"]

    session_1 = mysql_client.get(f"/api/respondent/{token}/session").json()
    order_1 = [r["text"] for r in session_1["question"]["rows"]]
    assert len(order_1) == 5

    # Check respondents.meta in database
    db: Session = SessionLocal()
    resp = db.query(Respondent).filter(Respondent.token == token).first()
    assert resp.meta is not None
    assert "matrix_row_order" in resp.meta
    assert resp.meta["matrix_row_order"]["mshuf"] == order_1
    db.close()

    # Re-fetch session (resume) -> must maintain identical order
    session_2 = mysql_client.get(f"/api/respondent/{token}/session").json()
    order_2 = [r["text"] for r in session_2["question"]["rows"]]
    assert order_1 == order_2


def test_bonus_7_balanced_rotation(mysql_client):
    """
    7. Balanced rotation:
    Support AB/BA concept order.
    Assign the order with fewer completes + in-progress respondents.
    Stored in respondents.meta, export column, balanced within one across series.
    """
    admin_token = get_admin_token(mysql_client)
    slug = f"rot_{secrets.token_hex(4)}"
    raw = f"""<survey id="{slug}" title="Rotation Study" target="10">
<question id="q_entry" type="single" required>
<text>Entry question</text>
<option>Next</option>
</question>
<rotation arm_a="q_ca" arm_b="q_cb"/>
<question id="q_ca" type="text">
<text>Concept A Review</text>
</question>
<question id="q_cb" type="text">
<text>Concept B Review</text>
</question>
</survey>"""

    create_res = mysql_client.post("/api/surveys", json={"raw_content": raw}, headers={"Authorization": f"Bearer {admin_token}"})
    assert create_res.status_code == 201
    s_id = create_res.json()["id"]
    v_id = create_res.json()["versions"][0]["id"]
    mysql_client.post(f"/api/surveys/{s_id}/versions/{v_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})

    # Join 6 respondents and verify balanced assignment
    assigned_arms = []
    tokens = []
    for _ in range(6):
        t = mysql_client.post(f"/api/surveys/{slug}/join").json()["token"]
        tokens.append(t)
        # Answer entry question to reach rotation block
        res = mysql_client.post(f"/api/respondent/{t}/answer", json={"question_id": "q_entry", "answer_value": "Next"})
        next_qid = res.json()["question"]["id"]
        # If AB assigned: next question is q_ca. If BA assigned: next question is q_cb.
        if next_qid == "q_ca":
            assigned_arms.append("AB")
        else:
            assigned_arms.append("BA")

    # Counts should be balanced within one (3 AB and 3 BA)
    ab_count = assigned_arms.count("AB")
    ba_count = assigned_arms.count("BA")
    assert abs(ab_count - ba_count) <= 1
    assert ab_count == 3
    assert ba_count == 3


def test_bonus_8_second_language_hindi(mysql_client):
    """
    8. Second language:
    Support secondary-language line in question text, options and rows.
    Language toggle saves choice in respondents.meta.
    """
    admin_token = get_admin_token(mysql_client)
    slug = f"lang_{secrets.token_hex(4)}"
    raw = f"""<survey id="{slug}" title="Bilingual Study" target="10">
<question id="lq1" type="single" required>
<text>What is your gender?</text>
<text lang="hi">आपका लिंग क्या है?</text>
<option>Male</option>
<option lang="hi">पुरुष</option>
<option>Female</option>
<option lang="hi">महिला</option>
</question>
<question id="lq2" type="yesno" required>
<text>Do you use a smartphone?</text>
<text lang="hi">क्या आप स्मार्टफोन इस्तेमाल करते हैं?</text>
</question>
</survey>"""

    create_res = mysql_client.post("/api/surveys", json={"raw_content": raw}, headers={"Authorization": f"Bearer {admin_token}"})
    assert create_res.status_code == 201
    s_id = create_res.json()["id"]
    v_id = create_res.json()["versions"][0]["id"]
    mysql_client.post(f"/api/surveys/{s_id}/versions/{v_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})

    join_res = mysql_client.post(f"/api/surveys/{slug}/join").json()
    token = join_res["token"]

    session_en = mysql_client.get(f"/api/respondent/{token}/session").json()
    q = session_en["question"]
    assert q["text"] == "What is your gender?"
    assert q["translations"] == {"hi": "आपका लिंग क्या है?"}
    assert q["options"][0]["translations"] == {"hi": "पुरुष"}

    # Toggle to Hindi
    lang_res = mysql_client.post(f"/api/respondent/{token}/language", json={"language": "hi"})
    assert lang_res.status_code == 200
    assert lang_res.json()["question"]["active_language"] == "hi"

    db: Session = SessionLocal()
    resp = db.query(Respondent).filter(Respondent.token == token).first()
    assert resp.meta["language"] == "hi"
    db.close()
