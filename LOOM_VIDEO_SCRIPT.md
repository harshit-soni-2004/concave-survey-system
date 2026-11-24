# Concave Insights — Loom Video Presentation Script

> **Target Duration**: 3:45 to 4:30 minutes (Within the strict 3–5 min requirement)  
> **Resolution**: 1080p full screen (Chrome browser zoomed to 100% or 110%)  
> **Demo URL**: `http://localhost:4200` (or `http://localhost`)  
> **Demo Accounts**: `admin@concave.com` / `AdminPassword123!`

---

## Pre-Recording Checklist (Setup Before Hitting Record)
1. **Reset Database to Clean Demo State**:
   ```bash
   python scripts/generate_demo_data.py --count 150 --clean
   ```
2. **Open 3 Browser Tabs Ready**:
   - **Tab 1**: Portfolio Dashboard (`http://localhost:4200/admin/surveys`) logged in as Admin.
   - **Tab 2**: Questionnaire Upload (`http://localhost:4200/admin/upload`).
   - **Tab 3**: In-Depth Analytics (`http://localhost:4200/admin/analytics`).
   - *(Optional Incognito Window)*: Respondent Survey Link (`http://localhost:4200/s/smartphone_study`).

---

## Scene-by-Scene Script

### Scene 1: Introduction & High-Level Architecture (0:00 – 0:35)
**What to Show on Screen:**  
Start on Tab 1 (**Portfolio Dashboard**). Mouse hovering smoothly over the KPI cards.

**What to Say:**  
> *"Hi everyone! Welcome to my walkthrough of **Concave Insights**, an enterprise-grade survey intelligence platform designed specifically for high-throughput market research operations running on 15-day fieldwork cycles.*  
>  
> *Instead of writing custom code for every research study, researchers simply author questionnaires in a plain text tag format. The platform handles the rest: line-level syntax validation, frozen immutable versioning, real-time autosave respondent execution, and analytical data export.*  
>  
> *The backend is built with **FastAPI and SQLAlchemy on MySQL 8.0**, and the frontend is a modern **Angular 18** application using standalone components and responsive Material design. Let's dive in!"*

---

### Scene 2: Questionnaire Parser & Line-Numbered Error Highlighter (0:35 – 1:30)
**What to Show on Screen:**  
Switch to Tab 2 (**Upload Questionnaire Definition** at `/admin/upload`).  
1. Click the **"Broken Sample (Test Validator)"** button.  
2. Scroll through the editor to show the line numbers gutter with red dots `●`, and the red highlighted rows.  
3. Click on **Line 8** or **Line 12** in the error banner — show how it smoothly jumps to that exact line in the editor and highlights the code!  
4. Click **"Load Valid Study Sample"**. Show the green success banner.  
5. Point out the **Study Identity & Configuration** card: explain workspace-wide unique title enforcement, unique slug generator, target sample, and click the **Calendar** button to show the interactive calendar popover and the 1-click quick presets (`+2 Weeks (14d)`).

**What to Say:**  
> *"First, let's look at the questionnaire ingestion pipeline. Traditional regex parsers fail when survey logic gets nested or broken. Here, we built a deterministic, line-aware XML parser.*  
>  
> *If a researcher uploads a file with syntax or semantic errors — let's load this broken sample — the validator immediately catches all issues simultaneously. Notice how each line number is pinned in the gutter, erroneous lines are highlighted in crimson with pulsing markers, and clicking any error in the summary list instantly jumps right to that exact line in the code.*  
>  
> *Now let's load a valid study. The system performs two-way synchronization: extracting the title, slug, and targets into this configuration panel. We enforce workspace-wide unique study names so researchers never collide, and provide an interactive fieldwork calendar with one-click presets like plus two weeks."*

---

### Scene 3: Versioning Lifecycle & Draft vs. Live Immutability (1:30 – 2:10)
**What to Show on Screen:**  
Switch to Tab 1 (**Portfolio Dashboard**), click on any Draft study or **"Smartphone Usage Study"** to open **Study Details** (`/admin/surveys/2`).  
Point out:
- Version badge (`v1`, `v2`).
- Target Completes & Quotas.
- The **"Preview / Test"** button.
- The **"Generate Invite Links"** batch tool and the **WhatsApp / Email sharing** buttons.

**What to Say:**  
> *"Next is the survey state machine and versioning lifecycle. Every survey starts as a DRAFT. Researchers can launch an isolated test simulation using the Preview button, which tags answers with `is_test=true` so test runs never contaminate production quota counts.*  
>  
> *When approved, the version's Abstract Syntax Tree is frozen and becomes strictly immutable. If a study needs revisions while in the field, researchers upload version 2 as a new draft. Crucially, respondents who started on version 1 remain pinned to version 1, guaranteeing contract integrity.*  
>  
> *Once live, admins can generate batches of single-use respondent tokens or distribute the public link with one-click WhatsApp and Email share integrations."*

---

### Scene 4: Respondent Experience & The Logic Engine (2:10 – 3:15)
**What to Show on Screen:**  
Open a new tab with `/s/smartphone_study` or `/s/bonus_feature_demo`.  
1. Answer Q1 (Consent: Yes) -> Click Next.  
2. Answer Age -> Show dynamic **piping** (e.g. *"As a 25-year-old..."*).  
3. Show **show-if logic** and **dropdown / matrix** questions.  
4. Show the **Language Toggle (English ⇄ Hindi)** on `/s/bonus_feature_demo`: toggle to Hindi and back to show live script switching.  
5. Point out the bottom autosave indicator: show that refreshing the browser retains the exact question and previous answers.  
6. Explain screener disqualification: mention that failing a screener logs granular reasons like `"q4: City not in scope | q5: Not smartphone user"`, and clicking Back prunes downstream terminations cleanly.

**What to Say:**  
> *"Now let's look at the respondent experience. The UI is mobile-first, distraction-free, and keyboard-accessible.*  
>  
> *Every answer is autosaved in real-time. If a respondent accidentally closes their browser and reopens their token link, they resume exactly where they left off.*  
>  
> *Under the hood, our logic engine evaluates boolean `show-if` conditions with proper AND/OR operator precedence, question-to-question text piping, skip-to targets, and dynamic option filtering.*  
>  
> *For our bonus features, we implemented per-respondent matrix row shuffling, balanced concept rotation where respondents are dynamically alternated between concept blocks to avoid bias, and bilingual survey support — as you can see, toggling between English and Hindi translates questions, options, and matrix rows seamlessly in real time."*

---

### Scene 5: Portfolio Analytics, In-Depth Question Breakdowns & Exports (3:15 – 4:05)
**What to Show on Screen:**  
1. Return to Tab 1 (**Portfolio Dashboard**):  
   - Click the timeframe pills: `1W`, `1M`, `1Q` on the Completes graph.  
   - Click the **Bar / Line** toggle.  
   - On the right card, click **Progress** and **Target Size** pills, and toggle **Donut ⇄ Pie**.  
   - Click **Minimize** on the charts row to show how it collapses to save space, and **Minimize** on Recent Activity Feed.  
2. Switch to Tab 3 (**In-Depth Analytics** at `/admin/analytics`):  
   - Show the study dropdown selector with high contrast.  
   - Scroll down to show Question-level charts (Rating averages, NPS breakdown, Matrix distributions).  
3. Show the **"Download CSV"** and **"Download Excel"** buttons on the dashboard.

**What to Say:**  
> *"Back in the Admin Portal, research coordinators have real-time observability across all active studies.*  
>  
> *On the portfolio dashboard, the completion velocity graph is fully configurable from 1 week up to a full year, with instant toggles between smooth line area and production bar charts. The companion studies distribution card allows slicing the portfolio by Status, Quota Progress tier, or Target Sample size, in both Donut and Pie presentation modes. Both widgets can be minimized with one click to keep the workspace clean.*  
>  
> *In our dedicated Analytics Hub, researchers can inspect question-by-question response frequencies, NPS scores, matrix distributions, and drop-off funnel dropouts.*  
>  
> *When fieldwork concludes, administrators can export standardized CSV and Excel datasets in under two seconds. Exports include sanitized headers, respondent quality flags like speeder and straight-liner detection, and balanced rotation arm assignments."*

---

### Scene 6: Concurrency & Wrap-Up (4:05 – 4:30)
**What to Show on Screen:**  
Bring up the terminal or README showing the test suite summary: `201/201 tests passed (100.0%)`.

**What to Say:**  
> *"To ensure data integrity under high concurrent respondent volume, quota completion is protected using transactional row-level database locking with `SELECT FOR UPDATE`, preventing race conditions and quota over-fulfillment.*  
>  
> *The entire platform is containerized with Docker Compose, and backed by a comprehensive automated test suite with 201 senior QA tests passing at 100%.*  
>  
> *Thank you so much for watching, and I look forward to your feedback!"*

---

## Pro-Tips for Delivering an A+ Presentation
- **Tone**: Confident, steady, professional. Avoid rushing or filler words ("um", "like").
- **Mouse Cursor**: Guide the viewer's eye deliberately. Don't shake or circle the mouse rapidly.
- **Audio**: Use a headset or external mic so your voice is crisp and clear.
- **Video Privacy**: When uploading to Loom, set the link to **"Public"** or **"Anyone with the link can view"** so the evaluation panel can access it without login friction.
