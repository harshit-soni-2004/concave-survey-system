import io
import re
import csv
from typing import Any, Dict, List, Tuple
from sqlalchemy.orm import Session
from openpyxl import Workbook
from app.models.survey import Survey
from app.models.survey_version import SurveyVersion
from app.models.respondent import Respondent
from app.models.answer import Answer

def build_export_columns(survey: Survey) -> List[Dict[str, Any]]:
    """
    Builds the union of all export columns across all versions of the survey.
    Returns a list of column descriptors:
    {
        "key": unique_col_key,
        "header": "Q{id}. {Text} [- Sub]",
        "q_id": question_id,
        "type": "standard" | "multi_option" | "matrix_row",
        "option_text": ...,
        "row_text": ...
    }
    """
    columns: List[Dict[str, Any]] = [
        {"key": "respondent_id", "header": "Respondent ID", "type": "meta"},
        {"key": "version", "header": "Version", "type": "meta"},
    ]

    seen_keys = {"respondent_id", "version"}

    for version in sorted(survey.versions, key=lambda v: v.version_number):
        ast = version.questionnaire_data or {}
        questions = ast.get("questions", [])

        for q in questions:
            q_id = q.get("id")
            q_type = q.get("type")
            q_text = q.get("text", "")

            # Info or consent questions without stored answer can be included or skipped
            # Consent and info:
            if q_type == "info":
                continue

            clean_qid = q_id.upper() if not q_id.upper().startswith("Q") else q_id.upper()
            header_q_text = re.sub(r'\[[a-zA-Z0-9_\-]+\]', 'this brand', q_text)
            base_header = f"{clean_qid}. {header_q_text}"

            if q_type == "multi":
                for opt in q.get("options", []):
                    opt_text = opt.get("text", "")
                    col_key = f"{q_id}__opt__{opt_text}"
                    if col_key not in seen_keys:
                        seen_keys.add(col_key)
                        columns.append({
                            "key": col_key,
                            "header": f"{base_header} - {opt_text}",
                            "q_id": q_id,
                            "type": "multi_option",
                            "option_text": opt_text,
                            "is_other": bool(opt.get("other"))
                        })
            elif q_type == "matrix":
                for row in q.get("rows", []):
                    row_text = row.get("text", "")
                    col_key = f"{q_id}__row__{row_text}"
                    if col_key not in seen_keys:
                        seen_keys.add(col_key)
                        columns.append({
                            "key": col_key,
                            "header": f"{base_header} - {row_text}",
                            "q_id": q_id,
                            "type": "matrix_row",
                            "row_text": row_text
                        })
            else:
                col_key = f"{q_id}__single"
                if col_key not in seen_keys:
                    seen_keys.add(col_key)
                    columns.append({
                        "key": col_key,
                        "header": base_header,
                        "q_id": q_id,
                        "type": "standard"
                    })

    return columns

def get_export_rows(survey: Survey, columns: List[Dict[str, Any]], db: Session) -> Tuple[List[str], List[List[Any]]]:
    headers = [col["header"] for col in columns]

    # Query completed, non-test respondents
    respondents = db.query(Respondent)\
        .filter(
            Respondent.survey_id == survey.id,
            Respondent.status == "COMPLETED",
            Respondent.is_test == False
        )\
        .order_by(Respondent.completed_at.asc())\
        .all()

    data_rows: List[List[Any]] = []

    for resp in respondents:
        # Load all answers for this respondent
        ans_records = db.query(Answer).filter(Answer.respondent_id == resp.id).all()
        answers_map: Dict[str, Answer] = {a.question_id: a for a in ans_records}

        row: List[Any] = []
        for col in columns:
            col_type = col["type"]
            if col_type == "meta":
                if col["key"] == "respondent_id":
                    row.append(resp.id)
                elif col["key"] == "version":
                    row.append(resp.survey_version.version_number if resp.survey_version else 1)
                continue

            q_id = col["q_id"]
            if q_id not in answers_map:
                row.append("")
                continue

            ans = answers_map[q_id]
            raw_val = ans.answer_value
            other_text = ans.other_text or ""

            if col_type == "standard":
                # Single, dropdown, yesno, number, text, etc.
                val_str = str(raw_val) if raw_val is not None else ""
                if other_text and ("other" in val_str.lower() or other_text in val_str):
                    row.append(f"Other-{other_text}")
                elif other_text:
                    row.append(f"{val_str}-{other_text}")
                else:
                    row.append(val_str)

            elif col_type == "multi_option":
                opt_name = col["option_text"]
                is_other = col.get("is_other", False)
                if isinstance(raw_val, list) and opt_name in raw_val:
                    if is_other and other_text:
                        row.append(f"Other-{other_text}")
                    else:
                        row.append(opt_name)
                else:
                    row.append("")

            elif col_type == "matrix_row":
                row_name = col["row_text"]
                if isinstance(raw_val, dict) and row_name in raw_val:
                    row.append(str(raw_val[row_name]))
                else:
                    row.append("")

        data_rows.append(row)

    return headers, data_rows

def export_survey_csv(survey: Survey, db: Session) -> str:
    columns = build_export_columns(survey)
    headers, rows = get_export_rows(survey, columns, db)

    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(headers)
    writer.writerows(rows)
    return output.getvalue()

def export_survey_xlsx(survey: Survey, db: Session) -> bytes:
    columns = build_export_columns(survey)
    headers, rows = get_export_rows(survey, columns, db)

    wb = Workbook()
    ws = wb.active
    ws.title = "Responses"

    ws.append(headers)
    for r in rows:
        ws.append(r)

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
