import os
import sys
import json

TEST_DB = os.environ.get("TEST_MYSQL_DB", os.environ.get("MYSQL_DB", "survey_test"))
os.environ["MYSQL_DB"] = TEST_DB

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
settings.MYSQL_DB = TEST_DB

from app.core.database import ensure_database_exists, Base, engine, SessionLocal
from app.core.seed import seed_database
import app.models

ensure_database_exists(TEST_DB)
Base.metadata.create_all(bind=engine)
db = SessionLocal()
seed_database(db)
db.close()

from fastapi.testclient import TestClient
from app.main import app

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8000")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@concave.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "AdminPassword123!")

# Try HTTP first if server is listening, else use TestClient
use_http = False
try:
    import urllib.request
    with urllib.request.urlopen(f"{BASE_URL}/docs", timeout=1) as resp:
        if resp.status == 200:
            use_http = True
except Exception:
    use_http = False

client = TestClient(app) if not use_http else None

def make_request(method: str, path: str, data: dict = None, headers: dict = None):
    if use_http:
        import urllib.request
        import urllib.parse
        import urllib.error
        url = f"{BASE_URL}{path}"
        req_headers = {"Content-Type": "application/json"}
        if headers:
            req_headers.update(headers)
        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
        try:
            with urllib.request.urlopen(req) as response:
                content_type = response.headers.get("Content-Type", "")
                raw = response.read()
                if "application/json" in content_type:
                    return response.status, json.loads(raw.decode("utf-8"))
                return response.status, raw.decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            try:
                err_json = json.loads(err_body)
            except Exception:
                err_json = err_body
            return e.code, err_json
        except Exception as e:
            return 0, str(e)
    else:
        req_headers = headers or {}
        if method.upper() == "GET":
            res = client.get(path, headers=req_headers)
        elif method.upper() == "POST":
            res = client.post(path, json=data, headers=req_headers)
        elif method.upper() == "PATCH":
            res = client.patch(path, json=data, headers=req_headers)
        else:
            res = client.request(method, path, json=data, headers=req_headers)
        
        try:
            return res.status_code, res.json()
        except Exception:
            return res.status_code, res.text

def run_smoke_test():
    mode_str = f"HTTP ({BASE_URL})" if use_http else "Direct TestClient"
    print(f"Starting smoke test against {TEST_DB} [{mode_str}]...")
    
    # 1. Login
    print("1. Logging in as Admin...")
    status, res = make_request("POST", "/api/auth/login", {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if status != 200:
        print(f"FAIL: Login failed ({status}): {res}")
        return False
    
    token = res.get("access_token")
    auth_header = {"Authorization": f"Bearer {token}"}
    print("   Admin login successful.")

    # 2. Check/Get survey
    print("2. Retrieving survey list...")
    status, surveys = make_request("GET", "/api/surveys", headers=auth_header)
    if status != 200 or not isinstance(surveys, list):
        print(f"FAIL: Failed to fetch surveys ({status}): {surveys}")
        return False

    sample_survey = next((s for s in surveys if s.get("slug") == "smartphone_study"), None)
    if not sample_survey:
        print("FAIL: Survey 'smartphone_study' not found.")
        return False
    
    s_id = sample_survey["id"]
    print(f"   Found survey id {s_id} (slug: smartphone_study, status: {sample_survey.get('status')})")

    # If survey is not LIVE, approve version 1
    if sample_survey.get("status") != "LIVE":
        print("   Activating survey...")
        status, detail = make_request("GET", f"/api/surveys/{s_id}", headers=auth_header)
        v_id = detail["versions"][0]["id"]
        status, _ = make_request("POST", f"/api/surveys/{s_id}/versions/{v_id}/approve", headers=auth_header)
        if status != 200:
            print(f"FAIL: Could not activate survey: {status}")
            return False

    # 3. Check Dashboard before
    status, dash_before = make_request("GET", f"/api/surveys/{s_id}/dashboard", headers=auth_header)
    if status != 200:
        print(f"FAIL: Dashboard fetch failed: {status}")
        return False
    comp_before = dash_before.get("completed", 0)

    # 4. Join survey
    print("3. Joining survey as new respondent...")
    status, join_res = make_request("POST", "/api/surveys/smartphone_study/join")
    if status != 200:
        print(f"FAIL: Join survey failed ({status}): {join_res}")
        return False
    resp_token = join_res.get("token")
    print(f"   Joined with token: {resp_token}")

    # 5. Answer all questions sequentially
    print("4. Answering questions end-to-end...")
    answers = [
        ("q0", "Viewed", None),
        ("q1", "Yes", None),
        ("q2", 29, None),
        ("q3", "Female", None),
        ("q4", "Bengaluru", None),
        ("q5", "Yes", None),
        ("q6", ["Apple", "Other (specify)"], "Pixel Phone"),
        ("q7", "Apple", None),
        ("q8", 5, None),
        ("q10", 10, None),
        ("q11", {
            "The battery lasts a full day": "Agree",
            "The camera takes good photos": "Strongly agree",
            "It works smoothly without lag": "Agree",
            "It was good value for money": "Neutral"
        }, None),
        ("q12", "No", None),
        ("q16", "Smoke Tester", None),
        ("q17", "400001", None),
    ]

    for q_id, val, other in answers:
        payload = {"question_id": q_id, "answer_value": val}
        if other:
            payload["other_text"] = other
        status, ans_res = make_request("POST", f"/api/respondent/{resp_token}/answer", payload)
        if status != 200:
            print(f"FAIL: Error submitting answer for {q_id} ({status}): {ans_res}")
            return False

    if ans_res.get("screen") != "Completed":
        print(f"FAIL: Expected screen 'Completed', got: {ans_res.get('screen')}")
        return False
    print("   Respondent completed survey successfully.")

    # 6. Check Dashboard after
    print("5. Checking dashboard counts...")
    status, dash_after = make_request("GET", f"/api/surveys/{s_id}/dashboard", headers=auth_header)
    if status != 200:
        print(f"FAIL: Failed to fetch dashboard after completion: {status}")
        return False
    comp_after = dash_after.get("completed", 0)
    if comp_after != comp_before + 1:
        print(f"FAIL: Completed count did not increment. Before: {comp_before}, After: {comp_after}")
        return False
    print(f"   Dashboard verified: Completed count incremented from {comp_before} to {comp_after}.")

    # 7. Download CSV export
    print("6. Exporting CSV...")
    status, csv_data = make_request("GET", f"/api/surveys/{s_id}/export?format=csv", headers=auth_header)
    if status != 200:
        print(f"FAIL: CSV export failed: {status}")
        return False
    
    if "Smoke Tester" not in csv_data:
        print("FAIL: Respondent data not found in exported CSV.")
        return False
    print("   CSV export verified: Respondent row present.")

    print("\n====================")
    print("SMOKE TEST: PASS")
    print("====================")
    return True

if __name__ == "__main__":
    success = run_smoke_test()
    sys.exit(0 if success else 1)
