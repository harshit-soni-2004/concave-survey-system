import os
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.core.seed import seed_database
from app.models.admin_user import AdminUser
from app.models.survey import Survey
from app.models.survey_version import SurveyVersion
from app.models.quota import Quota

# In-memory SQLite engine for tests
TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="module")
def test_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    seed_database(db)
    yield db
    db.close()
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture(scope="module")
def client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_auth_login_admin(client):
    res = client.post("/api/auth/login", json={
        "email": "admin@concave.com",
        "password": "AdminPassword123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"

def test_auth_login_researcher(client):
    res = client.post("/api/auth/login", json={
        "email": "researcher@concave.com",
        "password": "ResearcherPassword123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == "researcher"

def test_auth_login_invalid_password(client):
    res = client.post("/api/auth/login", json={
        "email": "admin@concave.com",
        "password": "WrongPassword"
    })
    assert res.status_code == 401

def test_auth_me(client):
    login_res = client.post("/api/auth/login", json={
        "email": "admin@concave.com",
        "password": "AdminPassword123!"
    })
    token = login_res.json()["access_token"]
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "admin@concave.com"

def test_validate_endpoint(client):
    sample_path = os.path.join(os.path.dirname(__file__), "..", "..", "samples", "concave_sample_questionnaire.txt")
    with open(sample_path, "r", encoding="utf-8") as f:
        valid_text = f.read()

    res = client.post("/api/surveys/validate", json={"raw_content": valid_text})
    assert res.status_code == 200
    assert res.json()["valid"] is True
    assert res.json()["errors"] == []

    broken_path = os.path.join(os.path.dirname(__file__), "..", "..", "samples", "concave_broken_questionnaire.txt")
    with open(broken_path, "r", encoding="utf-8") as f:
        broken_text = f.read()

    res_broken = client.post("/api/surveys/validate", json={"raw_content": broken_text})
    assert res_broken.status_code == 200
    assert res_broken.json()["valid"] is False
    assert len(res_broken.json()["errors"]) >= 10

def test_create_and_approve_survey_flow(client):
    admin_token = client.post("/api/auth/login", json={
        "email": "admin@concave.com",
        "password": "AdminPassword123!"
    }).json()["access_token"]

    researcher_token = client.post("/api/auth/login", json={
        "email": "researcher@concave.com",
        "password": "ResearcherPassword123!"
    }).json()["access_token"]

    sample_content = """<survey id="beverage_study" title="Beverage Study" target="100">
<question id="q1" type="consent" required>
  <text>Do you agree?</text>
</question>
<question id="q2" type="single" required>
  <text>Favorite drink?</text>
  <option>Tea</option><option>Coffee</option>
</question>
<quota question="q2" value="Tea" target="50"/>
</survey>"""

    # Researcher creates survey
    create_res = client.post(
        "/api/surveys",
        json={"raw_content": sample_content},
        headers={"Authorization": f"Bearer {researcher_token}"}
    )
    assert create_res.status_code == 201
    survey = create_res.json()
    assert survey["slug"] == "beverage_study"
    assert survey["status"] == "DRAFT"
    survey_id = survey["id"]

    # Upload version 2
    v2_content = """<survey id="beverage_study" title="Beverage Study Revised" target="120">
<question id="q1" type="consent" required>
  <text>Do you agree to take part?</text>
</question>
<question id="q2" type="single" required>
  <text>Favorite drink?</text>
  <option>Tea</option><option>Coffee</option><option>Water</option>
</question>
<quota question="q2" value="Tea" target="60"/>
<quota question="q2" value="Coffee" target="40"/>
</survey>"""

    v2_res = client.post(
        f"/api/surveys/{survey_id}/versions/upload",
        json={"raw_content": v2_content},
        headers={"Authorization": f"Bearer {researcher_token}"}
    )
    assert v2_res.status_code == 201
    v2 = v2_res.json()
    assert v2["version_number"] == 2
    assert v2["status"] == "DRAFT"
    v2_id = v2["id"]

    # Researcher tries to approve -> forbidden
    forbidden_res = client.post(
        f"/api/surveys/{survey_id}/versions/{v2_id}/approve",
        headers={"Authorization": f"Bearer {researcher_token}"}
    )
    assert forbidden_res.status_code == 403

    # Admin approves version 2
    approve_res = client.post(
        f"/api/surveys/{survey_id}/versions/{v2_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert approve_res.status_code == 200
    approved_survey = approve_res.json()
    assert approved_survey["status"] == "LIVE"
    assert approved_survey["target"] == 120
    assert approved_survey["active_version_id"] == v2_id
    assert approved_survey["deadline_at"] is not None
    assert len(approved_survey["quotas"]) == 2

    # Admin updates survey status to CLOSED
    close_res = client.patch(
        f"/api/surveys/{survey_id}/status",
        json={"status": "CLOSED", "closed_reason": "ADMIN"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert close_res.status_code == 200
    assert close_res.json()["status"] == "CLOSED"
    assert close_res.json()["closed_reason"] == "ADMIN"
    assert close_res.json()["closed_at"] is not None
