import pytest
import uuid
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.survey import Survey
from app.models.respondent import Respondent
from app.models.answer import Answer
from app.models.quota import Quota

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

@pytest.fixture(scope="module")
def auth_headers(client):
    res = client.post("/api/auth/login", json={"email": "admin@concave.com", "password": "AdminPassword123!"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_get_portfolio_overview(client, auth_headers):
    res = client.get("/api/overview", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "live_studies" in data
    assert "total_completes" in data
    assert "total_target" in data
    assert "overall_progress_percent" in data
    assert "status_counts" in data
    assert "completes_per_day" in data
    assert len(data["completes_per_day"]) == 14
    assert "soonest_deadlines" in data
    assert "quota_alerts" in data
    assert "recent_events" in data
    assert isinstance(data["recent_events"], list)

def test_get_survey_analytics(client, auth_headers):
    # Find a live survey
    db = SessionLocal()
    survey = db.query(Survey).filter(Survey.status == "LIVE").first()
    db.close()
    assert survey is not None

    res = client.get(f"/api/surveys/{survey.id}/analytics?days=14", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["survey_id"] == survey.id
    assert "daily_trends" in data
    assert len(data["daily_trends"]) == 14
    assert "completion_rate" in data
    assert "incidence_rate" in data
    assert "question_analytics" in data
    assert "top_termination_reasons" in data
    assert "dropoff" in data
    assert "alerts" in data
    assert "quality_flags" in data

    # Check question analytics structure
    for qa in data["question_analytics"]:
        assert "question_id" in qa
        assert "type" in qa
        assert "base" in qa

def test_get_survey_respondents_paginated(client, auth_headers):
    db = SessionLocal()
    survey = db.query(Survey).filter(Survey.status == "LIVE").first()
    db.close()
    assert survey is not None

    res = client.get(f"/api/surveys/{survey.id}/respondents?page=1&page_size=10", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "page" in data
    assert data["page"] == 1
    assert "page_size" in data
    assert "total_pages" in data
    assert "items" in data
    assert isinstance(data["items"], list)

    if len(data["items"]) > 0:
        item = data["items"][0]
        assert "masked_id" in item
        assert len(item["masked_id"]) <= 8
        assert "status" in item
        assert "version" in item

def test_analytics_non_test_only(client, auth_headers):
    db = SessionLocal()
    survey = db.query(Survey).filter(Survey.status == "LIVE").first()
    assert survey is not None

    # Get baseline completes
    base_res = client.get("/api/overview", headers=auth_headers)
    base_completes = base_res.json()["total_completes"]

    # Insert a test respondent that is COMPLETED
    now = datetime.utcnow()
    test_r = Respondent(
        id=str(uuid.uuid4()),
        survey_id=survey.id,
        token=f"test_token_analytics_{now.timestamp()}",
        status="COMPLETED",
        is_test=True,
        started_at=now,
        completed_at=now + timedelta(seconds=60)
    )
    db.add(test_r)
    db.commit()

    # Verify overview completes count did NOT change
    after_res = client.get("/api/overview", headers=auth_headers)
    assert after_res.json()["total_completes"] == base_completes

    # Cleanup test respondent
    db.delete(test_r)
    db.commit()
    db.close()
