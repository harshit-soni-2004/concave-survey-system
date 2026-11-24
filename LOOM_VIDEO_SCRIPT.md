# Concave Insights — Complete Loom Video Presentation Script

> **Target Duration**: 4:15 to 4:45 minutes (Optimized for thoroughness within the 3–5 min window)  
> **Screen Resolution**: 1080p full screen (Chrome browser zoomed to 100% or 110%)  
> **Demo URL**: `http://localhost:4200`  
> **Demo Accounts**: `admin@concave.com` / `AdminPassword123!`

---

## Pre-Recording Checklist (Set this up before pressing record!)
1. **Reset Demo Data to Pristine State**:
   ```bash
   python scripts/generate_demo_data.py --count 150 --clean
   ```
2. **Have These 4 Tabs Open & Ready in Order**:
   - **Tab 1**: Portfolio Dashboard (`http://localhost:4200/admin/surveys`)
   - **Tab 2**: Questionnaire Upload & Ingestion (`http://localhost:4200/admin/upload`)
   - **Tab 3**: Study Details & Version Management (`http://localhost:4200/admin/surveys/2`)
   - **Tab 4**: Bilingual & Advanced Logic Survey (`http://localhost:4200/s/bonus_feature_demo`)
   - **Tab 5**: In-Depth Analytics Hub (`http://localhost:4200/admin/analytics`)

---

## Detailed Scene-by-Scene Script

---

### Scene 1: Introduction, Architecture & Theme (0:00 – 0:35)
**What to Show on Screen:**  
- Start on **Tab 1 (Portfolio Dashboard)**.  
- Hover cursor smoothly over the KPI summary cards: *Live Studies*, *Total Completes*, *In Progress*, *Terminated*, *Overall Progress*.  
- Click the **Theme Toggle** (sun/moon icon) once to toggle from Dark to Light mode and back to Dark, demonstrating full accessibility and dynamic Chart.js theme re-rendering.

**Voiceover (Word-for-Word):**  
> *"Hello! Welcome to my walkthrough of **Concave Insights**, an enterprise-grade survey platform engineered specifically for high-throughput market research operations running on 15-day fieldwork cycles.*  
>  
> *Rather than writing bespoke frontend and backend code for each survey, researchers author studies in a standardized plain text tag format. 
The platform handles the rest: line-level syntax validation, frozen immutable versioning, real-time autosave execution, screener disqualification, and clean analytical exports.*  
>  
> *The backend is built with **FastAPI and SQLAlchemy on MySQL 8.0**, and the frontend is a modern **Angular 18** application using standalone components, reactive signals, and WCAG AA compliant dark and light themes. Let's look at how a survey gets ingested!"*

---

### Scene 2: Line-Aware Ingestion, Error Highlighter, Unique Constraints & Calendar (0:35 – 1:35)
**What to Show on Screen:**  
- Switch to **Tab 2 (`/admin/upload`)**.  
- Click the red **"Broken Sample (Test Validator)"** button.  
- Scroll down the editor: show the line numbers gutter with red dots `●`, and the red-tinted erroneous lines.  
- Click on **Line 8** in the error banner — watch the editor smoothly scroll, center, and highlight the broken tag `<question id="q2" type="unknown_type">` with a navigation alert!  
- Click the blue **"Load Valid Study Sample"** button. The green verification banner appears.  
- Show the **Study Identity & Configuration** card:
  - Point out the **Survey Title** field and explain the workspace-wide unique name constraint (preventing duplicate titles).
  - Point out the auto-generated **Study Slug** preview (`/s/...`).
  - Click the **"Calendar"** button: show the interactive calendar popover with month navigation, day cells, and time presets.
  - Click the **"+2 Weeks (14d)"** quick preset chip to show the deadline automatically set to 14 days ahead.

**Voiceover (Word-for-Word):**  
> *"Traditional regex parsers break when survey logic gets nested or corrupted. To solve this, we built a deterministic, line-aware parser that ingests custom `.txt` questionnaires across 13 question types.*  
>  
> *When a researcher uploads a file with syntax or semantic errors — let's load this broken sample — the validator catches all issues simultaneously. Notice how line numbers are pinned in the gutter, erroneous rows are highlighted in crimson with pulsing markers, and clicking any error in the validation report immediately jumps and highlights that exact line in the code.*  
>  
> *Now let's load a valid study. The configuration panel synchronizes two-way with the XML. We enforce a workspace-wide unique title constraint so studies never collide, and provide an interactive fieldwork calendar with one-click presets like plus two weeks to automatically track quota completion pace."*

---

### Scene 3: Versioning Lifecycle, Isolated Preview & 1-Click Cloning (1:35 – 2:20)
**What to Show on Screen:**  
- Switch to **Tab 3 (`/admin/surveys/2` - Study Details)**.  
- Point out the **Version badge** (`Version 1 - LIVE`), target completes, and live quota bars.  
- Hover over the **"Preview / Test"** button and explain test session isolation.  
- Click the **"Clone Survey"** button in the header. (Notice how it creates a clean Draft `Copy of...` with 0 respondents and a fresh slug).  
- Show the **"Generate Invite Links"** batch tool, and point out the **Share via WhatsApp** and **Share via Email** buttons.

**Voiceover (Word-for-Word):**  
> *"Next is our survey lifecycle state machine: DRAFT, LIVE, and CLOSED.*  
>  
> *Before going live, researchers can launch an isolated test simulation using the Preview button. This flags all answers with `is_test=true`, ensuring test runs never pollute production quota counts or quality metrics.*  
>  
> *When approved, the version's Abstract Syntax Tree is frozen and becomes strictly immutable. If revisions are required mid-fieldwork, version 2 is uploaded as a new draft. Crucially, respondents who started on version 1 remain pinned to version 1 throughout their session.*  
>  
> *We also support one-click Survey Cloning to rapidly duplicate studies into new drafts, batch token generation, and native one-click sharing via WhatsApp and Email for effortless respondent outreach."*

---

### Scene 4: Respondent Experience, Autosave, Logic Engine & Bonus Features (2:20 – 3:30)
**What to Show on Screen:**  
- Switch to **Tab 4 (`/s/bonus_feature_demo`)**.  
- Click **"Yes"** on consent -> Click **Next**.  
- Answer the Age question -> Show dynamic **Text Piping** on the next question (e.g., *"As a 28-year-old..."*).  
- Demonstrate **Show-If Logic**: select an option that reveals conditional follow-up questions.  
- Show the **Language Toggle** in the top header: click **Hindi**. Notice the question text, option labels, and matrix rows instantly switch into clean **Devanagari script**. Toggle back to English.  
- Show **Matrix Row Shuffling**: mention that rows are randomized per respondent and preserved across Back/Next navigation.  
- Mention **Balanced Concept Rotation**: explain how the backend balances respondents 50/50 between concept blocks (AB vs BA) to eliminate order bias.  
- Press browser **Refresh (F5)**: demonstrate that the respondent is returned to the exact question with previous answers preserved via real-time autosave.  
- Explain **Screener Disqualification**: if a respondent fails a screener, the system logs granular reasons like `q4: City out of scope | q5: Non-user`, and clicking Back prunes downstream answers cleanly.

**Voiceover (Word-for-Word):**  
> *"Now let's experience the respondent portal. The interface is mobile-first, distraction-free, and keyboard accessible.*  
>  
> *Every answer is autosaved in real time — if a participant loses connection or refreshes their browser, they resume right where they left off without losing data.*  
>  
> *Our logic engine evaluates boolean `show-if` conditions with proper AND/OR operator precedence, dynamic text piping, forward skip-to routing, and option-filtering from previous answers.*  
>  
> *For our advanced research features: we built per-respondent matrix row shuffling, balanced concept rotation to alternate concept blocks evenly between respondents and eliminate presentation bias, and bilingual survey support — as you can see, toggling between English and Hindi translates questions, choices, and scale matrices dynamically in real time.*  
>  
> *Furthermore, screener disqualifications chain multi-reason failures, while our intelligent Back button allows respondents to correct mistakes while cleanly pruning downstream records."*

---

### Scene 5: Configurable Portfolio Dashboard, Analytics Hub & Data Exports (3:30 – 4:20)
**What to Show on Screen:**  
- Return to **Tab 1 (Portfolio Dashboard)**:  
  - Point to the **Completes per Day** graph: click timeframe pills: `1W`, `1M`, `1Q`.  
  - Click the **"Line / Bar"** toggle button to switch between smooth line area and production bar chart.  
  - On the right **Studies Distribution** card: click the **"Progress"** and **"Target Size"** pills, and click the chart type toggle to cycle between **Donut**, **Pie**, and **Polar Area**!  
  - Click the **"Minimize"** button on the charts row and on the **Recent Activity Feed** to demonstrate how research leads can collapse sections to focus on the Studies Repository.  
- Switch to **Tab 5 (`/admin/analytics` - In-Depth Analytics Hub)**:  
  - Click the **Study Selector** dropdown (show solid contrast and clear status badges).  
  - Scroll through the question-level frequency charts, rating scales, and NPS breakdown.  
- Return to Dashboard and point to **"Download CSV"** and **"Download Excel (.xlsx)"**.

**Voiceover (Word-for-Word):**  
> *"Back in the Admin Workspace, research leads have comprehensive portfolio observability.*  
>  
> *On the main dashboard, the completion velocity graph is fully configurable from 1 week up to a full year, with instant toggles between line and bar charts. The companion distribution card allows slicing active studies by Status, Quota Progress tier, or Target Sample size, across Donut, Pie, and Polar chart modes. Both widgets can be minimized with one click to keep the dashboard streamlined.*  
>  
> *In our dedicated Analytics Hub, researchers can drill down into question-by-question response frequencies, NPS distributions, and stage drop-off funnels.*  
>  
> *When fieldwork concludes, administrators can export standardized CSV and Excel datasets in under two seconds. Exports include sanitized headers, balanced rotation arm assignments, and automated quality flags — including runtime speeder detection for completions under one-third median duration, and straight-liner detection across matrix questions."*

---

### Scene 6: Concurrency Locking & Conclusion (4:20 – 4:40)
**What to Show on Screen:**  
- Open terminal or VS Code showing `python scratch/run_full_qa.py` output:  
  `Total Tests Executed: 201 | Pass: 201, Fail: 0 | Pass Rate: 100.0%`.

**Voiceover (Word-for-Word):**  
> *"Finally, to protect data integrity under heavy concurrent participant traffic, quota fulfillment is enforced using transactional database row locking with `SELECT FOR UPDATE`, eliminating race conditions and preventing over-completion.*  
>  
> *The entire application is containerized with Docker Compose, and verified by our automated test suite with all 201 senior QA tests passing at 100%.*  
>  
> *Thank you very much for your time, and I look forward to discussing the platform with you!"*

---

## Quick Reference Summary Table for the Evaluators

| Feature Area | Key Deliverables Highlighted in Video |
| :--- | :--- |
| **Ingestion & Editing** | Plain `.txt` deterministic parser, 13 question types, line numbers gutter, crimson error row highlights, click-to-jump line navigation, unique workspace title constraint, fieldwork calendar popover with 1-click quick presets. |
| **Lifecycle & Versioning** | DRAFT/LIVE/CLOSED state machine, immutable frozen AST, isolated preview mode (`is_test=true`), respondent version pinning ($V_1$), 1-click survey cloning, batch tokens, WhatsApp/Email sharing. |
| **Respondent Experience** | Mobile-first UI, real-time autosave per question, boolean `show-if` logic, dynamic piping, multi-reason screeners with Back-navigation pruning. |
| **Advanced Research (Bonus)** | Real-time English ⇄ Hindi (`lang="hi"`) translation, balanced concept rotation (AB vs BA arms), per-respondent matrix row shuffling. |
| **Observability & Analytics** | Configurable velocity chart (1W–1Y, Line/Bar), configurable distribution chart (Status/Progress/Target/Recency in Donut/Pie/Polar), widget minimize toggles, question-level analytics hub, drop-off funnel report. |
| **Quality & Export** | Speeder detection (< 1/3 median duration), straight-liner detection, formula injection mitigation, streaming CSV and Excel (.xlsx) export. |
| **Enterprise Architecture** | Transactional row-level concurrency locking (`SELECT FOR UPDATE`), WCAG AA dark/light themes, Docker Compose, 201/201 automated tests passing (100.0%). |

---

## Final Submission Email Template (Ready to Send)

When your Loom video is recorded, copy and paste this exact email response:

```text
To: Team Concave Insights (Reply to thread)
Cc: genis@concaveinsights.com
Subject: Technical Assessment - Harshit Soni - Custom Survey System

Dear Team Concave Insights and Genis,

I have completed the technical assessment for the Full Stack Developer role. Please find the deliverables below:

1. GitHub Repository:
https://github.com/harshit-soni-2004/concave-survey-system

2. Live Production Demo:
https://concave-survey-system.vercel.app (FastAPI on Render + Neon PostgreSQL + Angular 18 on Vercel)
API Documentation: https://concave-survey-api.onrender.com/docs

3. Walkthrough Video (approx. 4.5 minutes):
[INSERT YOUR LOOM VIDEO LINK HERE]

4. Architecture & Design Documentation (/design folder):
- Entity-Relationship Diagram: design/er-diagram.md & design/er-diagram.png
- Admin & Researcher User Flow: design/user-flow-admin.md & design/user-flow-admin.png
- Respondent Portal User Flow: design/user-flow-respondent.md & design/user-flow-respondent.png
- Architectural Decisions: design/decisions.md
- Schema Changes & Migrations: design/schema-changes.md

Key Implementation Highlights:
• Line-Aware Parser & Validator: Deterministic XML tag parser tested against both concave_sample_questionnaire.txt and concave_broken_questionnaire.txt, reporting line-numbered syntax and semantic errors with 1-click jump-to-line highlighting.
• Immutable Versioning & Quota Engine: State machine (DRAFT -> LIVE -> CLOSED), isolated test sessions (is_test=true), and transactional concurrency control (SELECT FOR UPDATE) preventing quota overfill.
• Real-Time Autosave & Logic Engine: Question-level autosave, dynamic text piping, forward skip-to, and boolean show-if logic with strict AND > OR operator precedence.
• Advanced Research Features: Real-time bilingual English ⇄ Hindi toggle with Devanagari script, balanced concept rotation (AB vs BA arms), and per-respondent matrix row shuffling.
• Data Observability & Standardized Exports: Configurable dashboard charts (timeframes 1W–1Y, Line/Bar, Donut/Pie/Polar Area), dedicated question analytics hub with drop-off funnel metrics, speeder/straight-liner detection, and CSV/Excel (.xlsx) exports.
• Test Suite: 100% automated pass rate across all 201 test cases (verified via Docker Compose and Pytest).

The application is containerized with Docker Compose (docker-compose up --build) and ready for immediate local evaluation.

Thank you for this opportunity, and I look forward to your feedback and our next conversation!

Warm regards,
Harshit Soni
```

