import io
import re
import csv
from typing import Any, Dict, List, Tuple
from sqlalchemy.orm import Session
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
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
    ws.views.sheetView[0].showGridLines = True

    num_cols = max(len(headers), 1)

    # 1. Row 1: Deep Navy Header Title Banner
    ws.row_dimensions[1].height = 38
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=num_cols)
    title_cell = ws.cell(row=1, column=1, value=f"  Survey Response Dataset • {survey.title}")
    title_cell.font = Font(name="Segoe UI", size=14, bold=True, color="FFFFFF")
    title_cell.fill = PatternFill(start_color="102A43", end_color="102A43", fill_type="solid")
    title_cell.alignment = Alignment(vertical="center", horizontal="left")

    # 2. Row 2: Metadata / Subtitle Banner
    ws.row_dimensions[2].height = 22
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=num_cols)
    now_str = datetime.utcnow().strftime("%b %d, %Y at %H:%M UTC")
    sub_cell = ws.cell(row=2, column=1, value=f"  Exported on {now_str} • {len(rows)} Completed Non-Test Responses • Survey Target: {survey.target}")
    sub_cell.font = Font(name="Segoe UI", size=9, italic=True, color="486581")
    sub_cell.fill = PatternFill(start_color="F0F4F8", end_color="F0F4F8", fill_type="solid")
    sub_cell.alignment = Alignment(vertical="center", horizontal="left")

    # 3. Row 3: Blank Spacer Row
    ws.row_dimensions[3].height = 10

    # 4. Row 4: Professional Table Column Headers
    ws.row_dimensions[4].height = 28
    hdr_fill = PatternFill(start_color="2B6CB0", end_color="2B6CB0", fill_type="solid")
    hdr_font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
    hdr_align = Alignment(vertical="center", horizontal="center", wrap_text=True)

    thin_border = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0")
    )

    for col_idx, hdr in enumerate(headers, start=1):
        c = ws.cell(row=4, column=col_idx, value=hdr)
        c.fill = hdr_fill
        c.font = hdr_font
        c.alignment = hdr_align
        c.border = thin_border

    # 5. Row 5+: Data Rows with Zebra Striping
    if rows:
        for r_idx, r_data in enumerate(rows, start=5):
            ws.row_dimensions[r_idx].height = 22
            row_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid") if r_idx % 2 == 1 else PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
            for c_idx, val in enumerate(r_data, start=1):
                cell = ws.cell(row=r_idx, column=c_idx, value=val)
                cell.fill = row_fill
                cell.font = Font(name="Segoe UI", size=9.5, color="1E293B")
                cell.border = thin_border
                cell.alignment = Alignment(vertical="center", horizontal="center" if c_idx in (1, 2) else "left")
    else:
        ws.row_dimensions[5].height = 24
        empty_cell = ws.cell(row=5, column=1, value="(No completed non-test responses yet)")
        empty_cell.font = Font(name="Segoe UI", size=10, italic=True, color="94A3B8")
        empty_cell.alignment = Alignment(vertical="center", horizontal="left")

    # 6. Auto-fit column widths with padding
    for col_idx in range(1, num_cols + 1):
        col_letter = get_column_letter(col_idx)
        val_lens = [len(str(ws.cell(row=4, column=col_idx).value or ""))]
        for r_idx in range(5, min(len(rows) + 5, 25)):
            val_lens.append(len(str(ws.cell(row=r_idx, column=col_idx).value or "")))
        max_len = max(val_lens) if val_lens else 10
        ws.column_dimensions[col_letter].width = min(max(max_len + 4, 15), 55)

    # 7. Lock header row on scroll
    ws.freeze_panes = "A5"

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
