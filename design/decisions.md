# System Design Decisions

Quotas belong to the survey rather than a specific questionnaire version because target counts represent overall project recruitment constraints that must remain continuous when questionnaire revisions are published.
Quota counts are computed dynamically from completed non-test respondent records rather than stored in a mutable counter column to prevent counter drift, sync errors, and deadlocks under concurrent respondent traffic.
During survey completion, the survey row is locked inside a database transaction using SELECT FOR UPDATE to serialize capacity verification and eliminate race-condition overshoots past quotas or survey targets.
The sequence of answered question identifiers is stored in respondents.path as a JSON array so Back navigation functions deterministically across skip logic, and editing an earlier answer cleanly prunes unreachable downstream answers.
Under the consecutive-screener rule, failing a terminate-on question records the disqualification reason and permits the respondent to continue through immediate following screener questions that also define terminate-on rules before ending the survey.
A No response to a consent question is the exception to the screener rule and terminates the survey session immediately.
When a respondent begins a survey, their session is pinned to that specific survey_version_id, ensuring they finish on the schema they started even if an administrator approves a newer version mid-study.
If a survey closes while a respondent is partially finished, their response remains in In progress status, is excluded from quota and completed tallies, and displays the Survey closed screen upon subsequent access.
Lazy auto-close evaluates deadline_at and completed response counts on each survey request, updating status to CLOSED and recording a closed_reason of TARGET, DEADLINE, or ADMIN.
If an administrator does not specify an explicit future deadline when creating or updating a questionnaire, approving a draft version automatically restarts the 15-day project cycle clock from the approval timestamp.
The system relies primarily on pre-generated unique token links to enforce single participation, while also offering a public join route that issues a client-cached token in localStorage for open recruitment.
Audit columns (surveys.created_by, survey_versions.uploaded_by, survey_versions.approved_by, and survey_versions.approved_at) record administrative authorship and approval timestamps for governance, compliance, and full lifecycle traceability across questionnaire versions.
The answer_options table normalizes selected choices into separate rows indexed on (question_id, option_value) so quota verification, dashboard metrics, and multi-select answer exports use fast index scans instead of slow JSON_CONTAINS searches over stored JSON payloads.
Full structured payloads for matrices, free-text, and numeric answers remain preserved in answers.answer_value.
