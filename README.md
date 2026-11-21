# Concave Insights Custom Survey System

A custom, high-performance survey platform designed for market research studies running on strict 15-day project cycles. The system validates and parses plain-text questionnaire definitions into structured ASTs, enforces multi-branching logic, screening rules, and quotas, and provides a generic, mobile-first respondent interface and admin operations dashboard.

---

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic V2, PyMySQL
- **Database**: MySQL 8.0 (InnoDB)
- **Frontend**: Angular 18 (Standalone Components), Angular Material, RxJS
- **Containerization**: Docker Compose

---

## Core Capabilities

1. **Tag-Based Line-Aware Parser & Validator**:
   - Parses custom `<survey>`, `<question>`, `<option>`, `<row>`, `<quota>` tags without XML library quirks.
   - Provides line-numbered validation diagnostics for missing IDs, forward references, invalid option values, and malformed conditions.
2. **Research Logic Engine**:
   - Implements all 13 question types: `single`, `multi` (with max bounds, exclusive options, Other specify), `dropdown` (with search), `rating`, `nps`, `matrix`, `number`, `text`, `longtext`, `formatted` (pincode, phone, email), `yesno`, `consent`, and `info`.
   - Supports consecutive screener termination, dynamic piping with Other text, options-from dynamic choices, and respondent-stable option shuffling.
3. **Strict Quota & Concurrency Controls**:
   - Quotas computed dynamically from normalized `answer_options` tables.
   - Database row `SELECT FOR UPDATE` locking on completion eliminating race condition quota overshoots.
   - Lazy auto-closing on target completion or deadline expiration with `closed_reason`.
4. **Analysis-Ready Exports**:
   - One-click CSV and Excel (`.xlsx`) downloads formatted for data scientists with unnested matrix grids, broken-out multi-select columns, and test respondents excluded.
5. **Mobile-First Angular 18 UI**:
   - **Admin Portal (`/admin`)**: Login, survey listing with progress bars, questionnaire upload editor, survey revision details, batch token generator, and real-time dashboard.
   - **Respondent Portal (`/s/:slug`, `/r/:token`)**: Single-question-per-screen layout, progress bar, `localStorage` token caching per slug, back navigation with downstream answer pruning, autosave, and 4 terminal screens (`Completed`, `Not eligible`, `Survey closed`, `Already completed`).

---

## Running with Docker Compose

Ensure Docker is running, then execute:

```bash
docker compose up --build
```

- **Frontend**: [http://localhost:80](http://localhost:80)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Running Locally for Development

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm start
```
The frontend dev server runs at [http://localhost:4200](http://localhost:4200) and automatically proxies API requests to port `8000`.

---

## Testing & Verification

- **Run Pytest Suite** (38 tests covering parser, validator, logic, and MySQL integration):
  ```bash
  python -m pytest backend/tests
  ```
- **Run Automated End-to-End Smoke Test**:
  ```bash
  python scripts/smoke_test.py
  ```
- **Reset Demo Data** (Cleans tables and re-seeds approved LIVE study with 0 completes):
  ```bash
  python scripts/reset_demo.py
  ```

---

## Demo Credentials

- **Admin Account**: `admin@concave.com` / `AdminPassword123!` (Full permissions)
- **Researcher Account**: `researcher@concave.com` / `ResearcherPassword123!` (Upload and test permissions)
