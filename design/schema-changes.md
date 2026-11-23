# Schema Changes (Migration 0002_bonus_features)

This document describes the schema modifications introduced in migration `0002_bonus_features.py` to support advanced features while preserving backwards compatibility and clean relational design.

---

### 1. `respondents.meta` (JSON, NOT NULL, DEFAULT `{}`)

* **Column Added**: `meta JSON NOT NULL DEFAULT ('{}')` on table `respondents`.
* **Purpose & Why**:
  - **Per-Respondent Matrix Row Display Order**: When a matrix question specifies `shuffle="true"`, rows are shuffled uniquely for each respondent. Storing this order in `meta["matrix_row_order"][question_id]` guarantees that the order remains completely stable across page reloads, session resumes, and when navigating "Back".
  - **Balanced Concept Rotation Arm**: For concept evaluation blocks evaluated in alternating sequence (AB vs BA), the assigned arm is stored in `meta["rotation_arm"]`. This ensures the respondent stays in their assigned arm across page refreshes and device switches.
  - **Selected Language**: When surveys offer secondary language translations (e.g. Hindi), the user's active language selection is stored in `meta["language"]`, persisting across sessions while defaulting cleanly to the primary survey language.
  - **Extensibility**: By utilizing structured JSON on the respondent entity, we avoid altering core answer tables or adding fragile runtime-only session cookies.

---

### 2. `quotas.question_id_2` & `quotas.value_2` (VARCHAR, NULL)

* **Columns Added**:
  - `question_id_2 VARCHAR(64) NULL` on table `quotas`.
  - `value_2 VARCHAR(255) NULL` on table `quotas`.
* **Purpose & Why**:
  - **Nested Quotas Support**: Enables cross-tabulated target enforcement (e.g., `<quota question="q4" value="Mumbai" question2="q3" value2="Male" target="25"/>`).
  - Standard single-variable quotas continue using `question_id` and `value` (with `question_id_2` and `value_2` set to `NULL`).
  - Nested quotas store both dimensions explicitly, allowing atomic row-level checking and counting across answers via SQL joins without requiring a separate table or loss of target clarity.

---

### Summary
No other schema changes were introduced. All previous table structures, indices, foreign keys, and existing unit tests remain fully compatible.
