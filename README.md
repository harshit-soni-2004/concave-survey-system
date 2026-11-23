# Concave Insights — Custom Survey System

A resilient, tag-driven survey platform designed for market research operations. The system dynamically parses custom plain `.txt` questionnaires, strictly validates logic and semantics with line-level accuracy, provides isolated test/preview simulations, enforces frozen immutable versions upon approval, autosaves respondent answers in real time, and exports unified datasets in standard CSV/Excel formats.

---

## 1. Project Overview
Concave Insights conducts high-throughput consumer studies operating on 15-day research cycles. Instead of writing bespoke UI and backend code for every survey, researchers upload plain `.txt` questionnaires using a domain-specific tag format. The platform validates syntax and semantics, previews the survey in test mode, freezes versions on approval, enforces quotas and termination screeners, and exports clean, standardized datasets.

---

## 2. Tech Stack
- **Backend**: Python 3.12+, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, PyMySQL, Cryptography, Pytest
- **Database**: MySQL 8.0 (JSON columns for questionnaire AST and structured answers; relational schema for surveys, versions, quotas, respondents, and answer metrics)
- **Frontend**: Angular 18 (Standalone Components, Signals), Angular Material, SCSS, Mobile-First responsive layout
- **Exporting**: Python `csv` module and `openpyxl`
- **Infra & DevOps**: Docker, Docker Compose, Nginx reverse proxy

---

## 3. Setup and Run

### Option A: Running with Docker Compose (Recommended)
```bash
# Clone the repository and navigate to root
cd survey_system

# Launch MySQL, FastAPI Backend, and Angular Frontend
docker-compose up --build -d

# Verify containers are running
docker-compose ps
```
- **Admin UI & Respondent Portal**: `http://localhost`
- **FastAPI Interactive API Docs (Swagger UI)**: `http://localhost:8000/api/docs`

### Option B: Local Non-Docker Fallback
#### Backend Setup:
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
# Configure local MySQL in .env or environment variables
uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup:
```bash
cd frontend
npm install
npm start
# Available at http://localhost:4200
```

---

## 4. Demo Logins and Test Data
- **Admin User**:
  - Email: `admin@concaveinsights.com`
  - Password: `AdminPassword123!`
  - Role: `admin`
- **Researcher User**:
  - Email: `researcher@concaveinsights.com`
  - Password: `ResearcherPassword123!`
  - Role: `researcher`
- **Sample Questionnaires**:
  - `samples/concave_sample_questionnaire.txt` (Valid end-to-end smartphone study with 18 questions, piping, quotas, and screeners)
  - `samples/bonus_demo_questionnaire.txt` (Bonus demo study with nested quotas, matrix row shuffling, balanced concept rotation, and Hindi translations)
  - `samples/concave_broken_questionnaire.txt` (Contains 10 deliberate syntax and semantic errors to demonstrate the line-aware validator)

### Demo Data & Reset Scripts:
- **Reset Database to Clean State**:
  ```bash
  python scripts/reset_demo.py
  ```
  Drops all respondents and answers, verifies zero completes on the dashboard, and resets all quotas to full targets.

- **Populate Realistic Production Dataset**:
  ```bash
  python scripts/generate_demo_data.py --count 150 --clean
  ```
  Populates realistic respondents across both sample studies (`smartphone_study` and `bonus_feature_demo`):
  - Completion timestamps realistically spread over the past 12 days.
  - Realistic answer frequencies across single, multi, dropdown, rating, NPS, and matrix questions.
  - Automated quality flags: speeders (< 1/3 median duration) and straight-liners (identical answers across matrix rows).
  - Screener disqualifications (q4 city not in scope, q5 non-smartphone user) with logged reasons.
  - Full single and nested quota tracking.

---

## 5. Features

| Feature | Scope | Status |
| :--- | :--- | :--- |
| **Line-Aware Questionnaire Parser & Validator** | Line-numbered syntax, semantic & reference checks, 13 question types, nested quotas, bilingual tags | **Done** |
| **Survey Versioning & Draft/Approval Lifecycle** | Freeze AST on approval, sync targets/quotas, immutable versions | **Done** |
| **Logic Engine** | Show-if (AND > OR precedence), skip-to, piping, options-from, shuffle | **Done** |
| **Multi-Reason Screener & Quota Engine** | Screener chaining (`q4: Reason | q5: Reason`), Back-navigation pruning, atomic concurrency locking | **Done** |
| **Nested Quotas** | Cross-tab targets (`question` + `question2`), double-join count check on 2nd answer | **Done** |
| **Drop-Off Funnel Analytics** | Per-question reached, stopped, and drop-off percentage metrics | **Done** |
| **Survey Cloning** | One-click clone of active survey to new DRAFT with fresh slug | **Done** |
| **Quality Flags (Speeder & Straight-Liner)** | Runtime speeder (< 1/3 median duration, $\ge 5$ completes) and straight-liner detection | **Done** |
| **Balanced Concept Rotation** | Least-filled arm assignment (AB/BA) for in-progress + completes, stored in meta | **Done** |
| **Per-Respondent Matrix Row Shuffling** | Row order shuffled per respondent, saved in meta, preserved across Back/resume | **Done** |
| **Bilingual Respondent Support (Hindi/English)** | Secondary language lines for text, options, and rows with live UI toggle | **Done** |
| **Mobile-First Respondent Experience** | Autosave per answer, progress bar, Back/Next path tracking, responsive cards | **Done** |
| **Standardized CSV & Excel Export** | Unified schema, rotation arm, quality flags, and custom spreadsheet formatting | **Done** |

---

## 6. Database Design
The Day 2 database design remains unchanged and preserves full relational integrity. Only two additive, non-breaking schema enhancements were introduced in Alembic migration `0002_bonus_features.py` (documented in detail in [`design/schema-changes.md`](design/schema-changes.md)):
1. `respondents.meta` (`JSON NOT NULL DEFAULT ('{}')`): Persists respondent-level transient state (the assigned balanced rotation arm, per-matrix shuffled row display orders, and active language selection).
2. `quotas.question_id_2` & `quotas.value_2` (`VARCHAR NULL`): Supports cross-tabulated / nested quotas without disrupting single-variable quotas or normal table constraints.

All core tables remain identical to Day 2:
- **`surveys`**: Master survey record with auto-increment ID, unique slug, status, target, and lazy auto-close metrics.
- **`survey_versions`**: Immutable snapshot of the parsed AST and raw `.txt` source.
- **`quotas`**: Live survey quotas evaluated dynamically against completed, non-test responses.
- **`respondents`**: Session tracking per unique token, respondent status, path tracking (`["q0", "q1", ...]`), and cumulative termination reasons.
- **`respondent_terminations`**: Granular disqualification tracking by question and reason for admin dashboard aggregation.
- **`answers`**: Normalized answers storing scalar values, multi-select arrays, and matrix row maps.
- **`admin_users`**: Role-based access control (`admin`, `researcher`).

Detailed ER diagram and user-flow specifications:
- [Entity-Relationship Diagram Specification](design/er-diagram.md)
- [User Flows Specification](design/user-flow.md)
- [Bonus Schema Additions Specification](design/schema-changes.md)

---

## 7. API Endpoints

### Core Endpoint Overview
- `POST /api/auth/login` — Authenticate admin/researcher and return JWT.
- `POST /api/surveys/validate` — Dry-run validation of `.txt` questionnaire file, returning line-numbered errors.
- `POST /api/surveys` — Create a new survey and draft version 1 from server-parsed questionnaire.
- `POST /api/surveys/{id}/clone` — Clones latest version into a new DRAFT survey (`"Copy of <title>"` with a fresh slug and zero responses/tokens).
- `POST /api/surveys/{id}/versions/upload` — Upload a new draft version ($N+1$).
- `POST /api/surveys/{id}/versions/{version_id}/approve` — Freeze version, sync target & quotas, set status to `LIVE`.
- `POST /api/surveys/{id}/test-session` — Generate an isolated preview session (`is_test=true`).
- `POST /api/surveys/{slug}/join` — Generate or retrieve unique respondent token for live participation.
- `GET /api/respondent/{token}/session` — Load current question, translations, row orders, piping, and progress %.
- `POST /api/respondent/{token}/answer` — Autosave answer, evaluate logic/screeners, and return next step.
- `POST /api/respondent/{token}/back` — Step back in path, preserving saved answers and pruning downstream termination records.
- `POST /api/respondent/{token}/language` — Update respondent's selected language (`en` or `hi`) stored in `respondents.meta`.
- `GET /api/surveys/{id}/dashboard` — Fetch live metrics (started, completed, terminated, quotas, and quality flag counts).
- `GET /api/surveys/{id}/dropoff` — Fetch question-by-question drop-off funnel report (reached, stopped, and % lost).
- `GET /api/surveys/{id}/export?format=csv|xlsx` — Stream survey completes in standardized format with rotation arm and quality flags.

---

## 8. Assumptions and Decisions

### 1. In-Progress Responses When Version Updates
- **Decision**: Respondents who begin on Version $V_1$ remain pinned to Version $V_1$ until they finish or terminate.
- **Rationale**: Questionnaires represent a contract between researcher and respondent. Frozen versions guarantee that all answers for a given respondent strictly adhere to the questionnaire AST they agreed to.

### 2. In-Progress Responses When Survey Closes
- **Decision**: If a survey closes (target reached, 15-day deadline expires, or admin closes it), in-progress respondents are not counted toward completes or quotas. Upon their next interaction, the system presents the "Survey closed" screen.

### 3. Consecutive Screener Termination & Multi-Reason Rebuild
- **Decision**: When a respondent fails a `terminate-on` condition in a screening question, the system logs the failure in `respondent_terminations` and allows consecutive screeners to run. The respondent's `termination_reason` stores all failed reasons in sequence: `"q4: City not in scope | q5: Not a smartphone user"`. If the respondent navigates Back, downstream termination rows are deleted and the string is dynamically rebuilt.

### 4. Concurrency Protection on Quotas and Target
- **Decision**: When a respondent submits their final answer, the backend locks the survey row (`SELECT ... FROM surveys WHERE id=:id FOR UPDATE`) inside a database transaction, re-verifies total completes and quota counts, and assigns either `COMPLETED` or `TERMINATED("Quota full" / "Target full")`.

### 5. Quality Flag Definitions (Speeder & Straight-Liner)
- **Speeder**: Flagged if total completion duration is less than $\frac{1}{3}$ of the median completion time across completed respondents. Only calculated when at least 5 completed non-test responses exist.
- **Straight-Liner**: Flagged if a respondent selected the exact same column option across every row of any matrix question.
- Responses with quality flags are never deleted or excluded; flag counts are presented on the admin dashboard, and a `"Quality flag"` column is appended to CSV and Excel exports.

### 6. Balanced Concept Rotation
- Concept blocks evaluated in alternating order (`arm_a` vs `arm_b`) balance respondents dynamically: when a respondent enters the rotation block, they are assigned whichever arm currently has fewer total respondents (completed + in-progress, non-test only). The assignment is saved in `respondents.meta["rotation_arm"]`, maintained on resume, and exported in a `"Rotation arm"` export column.

### 7. Per-Respondent Matrix Row Order
- When a matrix specifies `shuffle="true"`, row display order is randomized upon the respondent's first encounter and stored in `respondents.meta["matrix_row_order"][question_id]`. Resuming the session or navigating Back reuses the exact same display order. To keep the standard analytical export grid clean and predictable, row order notes are omitted from the export table.

### 8. Secondary Language (Bilingual Surveys)
- Question text, option choices, and matrix rows support secondary language lines (`<text lang="hi">`, `<option lang="hi">`, `<row lang="hi">`). The respondent can toggle languages at any time; their preference is stored in `respondents.meta["language"]`. The exported dataset always standardizes on the primary language text.

---

## 9. Remaining Limits & Out-of-Scope Items
- **3-Month Participant Cool-Off Rule**: Enforcing a strict 3-month cool-off period across separate surveys requires a globally verified, persistent participant identifier (e.g. verified phone number, national ID, or unified SSO account). Because web link and token-based survey participation is inherently pseudonymous and privacy-preserving, this feature is not built and is marked out-of-scope.
- **Matrix Row Order Export Notes**: Row order is tracked per-respondent in the database (`respondents.meta`) but omitted from CSV/Excel data rows to avoid fracturing the unified column layout required by analytics tools.
