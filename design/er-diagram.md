# Database Entity-Relationship (ER) Diagram

![Database ER Diagram](er-diagram.png)

```mermaid
erDiagram
    admin_users |o--o{ surveys : "creates"
    admin_users ||--o{ survey_versions : "uploads"
    surveys ||--o{ survey_versions : "has versions"
    surveys |o..o| survey_versions : "live version"
    surveys ||--o{ quotas : "defines quotas for"
    surveys ||--o{ respondents : "tracks respondents of"
    survey_versions |o--o{ respondents : "pinned on first answer"
    respondents ||--o{ answers : "submits answers"
    respondents ||--o{ respondent_terminations : "incurs termination reasons"
    answers ||--o{ answer_options : "selected options"

    surveys {
        int id PK "Primary key"
        varchar_64 slug UK "URL slug"
        varchar_255 title "Survey title"
        varchar_16 status "DRAFT LIVE or CLOSED"
        varchar_16 closed_reason "TARGET DEADLINE or ADMIN"
        int target "Target completes"
        int active_version_id FK "Active version"
        int created_by FK "Admin creator"
        datetime deadline_at "Auto-close deadline"
        datetime closed_at "Closed timestamp"
        datetime created_at "Created timestamp"
        datetime updated_at "Updated timestamp"
    }

    survey_versions {
        int id PK "Primary key"
        int survey_id FK "Survey reference"
        int version_number "Sequential version"
        json questionnaire_data "Parsed AST"
        longtext raw_content "Original text"
        varchar_16 status "DRAFT or APPROVED"
        int uploaded_by FK "Admin uploader"
        int approved_by FK "Admin approver"
        datetime approved_at "Approved timestamp"
        datetime created_at "Created timestamp"
    }

    quotas {
        int id PK "Primary key"
        int survey_id FK "Survey reference"
        varchar_64 question_id "Target question"
        varchar_255 value "Target answer value"
        int target "Quota complete cap"
        datetime created_at "Created timestamp"
    }

    respondents {
        varchar_36 id PK "UUID identifier"
        int survey_id FK "Survey reference"
        int survey_version_id FK "Pinned version"
        varchar_64 token UK "Invite token"
        varchar_16 status "Response status"
        boolean is_test "Test preview flag"
        boolean is_silent_termination "Silent term flag"
        text termination_reason "Joined export text"
        varchar_64 current_question_id "Current position"
        json path "Visited question array"
        datetime started_at "Started timestamp"
        datetime completed_at "Completed timestamp"
        datetime created_at "Created timestamp"
        datetime updated_at "Updated timestamp"
    }

    respondent_terminations {
        int id PK "Primary key"
        varchar_36 respondent_id FK "Respondent reference"
        varchar_64 question_id "Terminated question"
        varchar_255 reason "Disqualification reason"
        datetime created_at "Created timestamp"
    }

    answers {
        int id PK "Primary key"
        varchar_36 respondent_id FK "Respondent reference"
        varchar_64 question_id "Question answered"
        json answer_value "Full answer payload"
        varchar_255 other_text "Free text comment"
        datetime created_at "Created timestamp"
        datetime updated_at "Updated timestamp"
    }

    answer_options {
        int id PK "Primary key"
        int answer_id FK "Answer reference"
        varchar_64 question_id "Question answered"
        varchar_255 option_value "Selected option key"
        datetime created_at "Created timestamp"
    }

    admin_users {
        int id PK "Primary key"
        varchar_255 email UK "Login email"
        varchar_255 password_hash "Hashed password"
        varchar_100 name "Display name"
        varchar_16 role "Admin or researcher"
        datetime created_at "Created timestamp"
    }
```

---

### Notes and Design Specifications

- **Unique constraints**:
  - `surveys.slug`
  - `respondents.token`
  - `admin_users.email`
  - `survey_versions (survey_id, version_number)`
  - `quotas (survey_id, question_id, value)`
  - `answers (respondent_id, question_id)`

- **Indexes**:
  - `surveys (status, deadline_at)`
  - `respondents (survey_id, status, is_test)`
  - `answers (question_id)`
  - `answer_options (question_id, option_value)`
  - `respondent_terminations (reason)` and `(question_id)`

- **Allowed values**:
  - `surveys.status`: `DRAFT`, `LIVE`, `CLOSED`
  - `surveys.closed_reason`: `TARGET`, `DEADLINE`, `ADMIN`
  - `survey_versions.status`: `DRAFT`, `APPROVED`
  - `respondents.status`: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `TERMINATED`
  - `admin_users.role`: `admin`, `researcher`

- **Quota counts**:
  - Quota counts are computed from completed, non-test respondents via `answer_options`, never stored.

- **UTC Datetimes**:
  - All datetimes are stored in UTC.

- **Audit and Approvals**:
  - `survey_versions.approved_by` references `admin_users.id` (nullable, set upon approval) and is recorded in the notes rather than as a secondary connector to keep the visual layout clean and avoid crossing lines between `admin_users` and `survey_versions`.

- **Deliberate trade-offs**:
  - `respondents` holds both the invite token and the response session (one table, simpler).
  - `termination_reason` on `respondents` is a joined string kept only for export, while `respondent_terminations` is the source for dashboard counts.
  - `raw_content` is stored next to the parsed JSON so a version can be re-parsed or audited.
