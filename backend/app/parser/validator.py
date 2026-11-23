import re
from typing import Any, Dict, List, Set
from app.parser.parser import parse_questionnaire
from app.parser.conditions import parse_condition, extract_condition_references, ConditionSyntaxError

VALID_QUESTION_TYPES: Set[str] = {
    "info",
    "consent",
    "single",
    "multi",
    "dropdown",
    "yesno",
    "rating",
    "nps",
    "matrix",
    "number",
    "text",
    "longtext",
    "formatted"
}

CATEGORICAL_QUOTA_TYPES: Set[str] = {"single", "dropdown", "multi", "yesno"}

def get_question_valid_options(q: Dict[str, Any]) -> Set[str]:
    q_type = q.get("type", "")
    options = {opt["text"] for opt in q.get("options", []) if opt.get("text")}
    if options:
        return options
    if q_type in ("consent", "yesno"):
        return {"Yes", "No"}
    return set()

def validate_questionnaire_ast(ast: Dict[str, Any]) -> List[Dict[str, Any]]:
    errors: List[Dict[str, Any]] = []

    def add_error(line: int, message: str):
        errors.append({"line": line, "message": message})

    # Validate survey header
    survey_line = ast.get("line_number", 1)
    if not ast.get("id"):
        add_error(survey_line, "Survey is missing an 'id' attribute")
    if not ast.get("title"):
        add_error(survey_line, "Survey is missing a 'title' attribute")
    target = ast.get("target")
    if not isinstance(target, int) or target <= 0:
        add_error(survey_line, "Survey target must be a positive integer")

    questions = ast.get("questions", [])
    all_question_ids: Set[str] = set()
    question_index_map: Dict[str, int] = {}
    question_map: Dict[str, Dict[str, Any]] = {}

    # First pass: collect ids and check basic question properties
    for idx, q in enumerate(questions):
        line = q.get("line_number", survey_line)
        qid = q.get("id")

        if not qid:
            add_error(line, "Question is missing an 'id' attribute")
            continue

        if qid in all_question_ids:
            add_error(line, f"Duplicate question id '{qid}'")
        else:
            all_question_ids.add(qid)
            question_index_map[qid] = idx
            question_map[qid] = q

        q_type = q.get("type")
        if not q_type or q_type not in VALID_QUESTION_TYPES:
            add_error(line, f"Unknown question type '{q_type}' on question '{qid}'")

    # Second pass: validate relationships, references, and per-type rules
    seen_ids: Set[str] = set()

    for idx, q in enumerate(questions):
        line = q.get("line_number", survey_line)
        qid = q.get("id")
        q_type = q.get("type")

        # 1. options-from check
        opt_from = q.get("options_from") or q.get("options-from") or q.get("attributes", {}).get("options-from")
        if opt_from:
            if opt_from not in seen_ids:
                add_error(line, f"options-from references nonexistent or later question '{opt_from}'")
            else:
                ref_q = question_map.get(opt_from)
                if ref_q and ref_q.get("type") not in ("multi", "single", "dropdown"):
                    add_error(line, f"options-from target '{opt_from}' must be a choice question with options")

        # 2. Piping [qX] check in question text
        text = q.get("text", "")
        piping_matches = re.findall(r'\[([a-zA-Z0-9_\-]+)\]', text)
        for target_ref in piping_matches:
            if target_ref not in seen_ids:
                add_error(line, f"Piping reference '[{target_ref}]' refers to nonexistent or later question '{target_ref}'")

        # 3. show-if condition check
        show_if = q.get("show_if") or q.get("show-if") or q.get("attributes", {}).get("show-if")
        if show_if:
            try:
                cond_ast = parse_condition(show_if)
                refs = extract_condition_references(cond_ast)
                for ref_qid, ref_val in refs:
                    if ref_qid not in seen_ids:
                        add_error(line, f"show-if references nonexistent or later question '{ref_qid}'")

                    if ref_qid in question_map:
                        ref_q = question_map[ref_qid]
                        valid_options = get_question_valid_options(ref_q)
                        ref_type = ref_q.get("type")
                        if valid_options and ref_val not in valid_options:
                            add_error(line, f"show-if condition on question '{qid}' checks '{ref_qid}={ref_val}', but '{ref_val}' is not a valid option for question '{ref_qid}'")
                        elif ref_type == "rating":
                            try:
                                r_val = int(ref_val)
                                r_min = int(ref_q.get("min", 1))
                                r_max = int(ref_q.get("max", 5))
                                if r_val < r_min or r_val > r_max:
                                    add_error(line, f"show-if rating value '{ref_val}' outside range [{r_min}, {r_max}] for question '{ref_qid}'")
                            except ValueError:
                                add_error(line, f"show-if rating value '{ref_val}' is not an integer for question '{ref_qid}'")
                    elif ref_qid not in all_question_ids:
                        add_error(line, f"show-if references nonexistent question '{ref_qid}'")
            except ConditionSyntaxError as e:
                add_error(line, f"Invalid show-if condition syntax on question '{qid}': {str(e)}")

        # 4. skip-to check on question and options
        q_skips = []
        skip_to = q.get("skip_to") or q.get("skip-to") or q.get("attributes", {}).get("skip-to")
        if skip_to:
            q_skips.append((skip_to, line))

        for opt in q.get("options", []):
            opt_skip = opt.get("skip_to") or opt.get("attributes", {}).get("skip-to")
            if opt_skip:
                q_skips.append((opt_skip, opt.get("line_number", line)))

        for target_skip, s_line in q_skips:
            if target_skip not in all_question_ids:
                add_error(s_line, f"skip-to references nonexistent question '{target_skip}'")
            elif qid in question_index_map and question_index_map[target_skip] <= question_index_map[qid]:
                add_error(s_line, f"skip-to target '{target_skip}' must be a later question")

        # 5. terminate-on check
        terminate_on = q.get("terminate_on") or q.get("terminate-on") or q.get("attributes", {}).get("terminate-on")
        if terminate_on:
            valid_opts = get_question_valid_options(q)
            if not valid_opts:
                add_error(line, f"terminate-on cannot be used on question '{qid}' of type '{q_type}'")
            elif terminate_on not in valid_opts:
                add_error(line, f"terminate-on value '{terminate_on}' is not a valid option for question '{qid}'")

        # 6. matrix check: must have at least one row and at least one option (scale)
        if q_type == "matrix":
            rows = q.get("rows", [])
            options = q.get("options", [])
            if not rows:
                add_error(line, f"Matrix question '{qid}' must define at least one <row>")
            if not options:
                add_error(line, f"Matrix question '{qid}' must define scale <option>s")

        # 7. min / max checks
        q_min = q.get("min")
        q_max = q.get("max")
        if q_min is not None and q_max is not None:
            try:
                if int(q_min) > int(q_max):
                    add_error(line, f"Question '{qid}' min ({q_min}) cannot be greater than max ({q_max})")
            except ValueError:
                pass

        if qid:
            seen_ids.add(qid)

    # Validate quotas (including nested quotas)
    for quota in ast.get("quotas", []):
        q_line = quota.get("line_number", survey_line)
        target_qid = quota.get("question_id")
        val = quota.get("value")
        target_qid_2 = quota.get("question_id_2")
        val_2 = quota.get("value_2")
        q_target = quota.get("target")

        if not target_qid or target_qid not in all_question_ids:
            add_error(q_line, f"Quota references nonexistent question '{target_qid}'")
            continue

        target_q = question_map[target_qid]
        t_type = target_q.get("type", "")

        if t_type not in CATEGORICAL_QUOTA_TYPES:
            add_error(q_line, f"Quota on question '{target_qid}' of type '{t_type}' with value '{val}' is invalid: question must be categorical ({', '.join(sorted(CATEGORICAL_QUOTA_TYPES))})")

        valid_opts = get_question_valid_options(target_q)
        if valid_opts and val not in valid_opts:
            add_error(q_line, f"Quota value '{val}' is not a valid option for question '{target_qid}'")

        # Nested quota validation
        if target_qid_2 or val_2:
            if not target_qid_2 or not val_2:
                add_error(q_line, f"Nested quota must specify both question2 and value2")
            elif target_qid_2 not in all_question_ids:
                add_error(q_line, f"Quota references nonexistent question '{target_qid_2}'")
            else:
                target_q_2 = question_map[target_qid_2]
                t_type_2 = target_q_2.get("type", "")
                if t_type_2 not in CATEGORICAL_QUOTA_TYPES:
                    add_error(q_line, f"Quota on question '{target_qid_2}' of type '{t_type_2}' with value '{val_2}' is invalid: question must be categorical ({', '.join(sorted(CATEGORICAL_QUOTA_TYPES))})")
                valid_opts_2 = get_question_valid_options(target_q_2)
                if valid_opts_2 and val_2 not in valid_opts_2:
                    add_error(q_line, f"Quota value '{val_2}' is not a valid option for question '{target_qid_2}'")

        if not isinstance(q_target, int) or q_target <= 0:
            add_error(q_line, f"Quota target must be a positive integer for question '{target_qid}'")

    # Validate rotation blocks
    for rot in ast.get("rotations", []):
        r_line = rot.get("line_number", survey_line)
        arm_a = rot.get("arm_a")
        arm_b = rot.get("arm_b")
        if not arm_a or arm_a not in all_question_ids:
            add_error(r_line, f"Rotation references nonexistent question '{arm_a}'")
        if not arm_b or arm_b not in all_question_ids:
            add_error(r_line, f"Rotation references nonexistent question '{arm_b}'")

    return errors

def validate_questionnaire_text(content: str) -> List[Dict[str, Any]]:
    ast = parse_questionnaire(content)
    return validate_questionnaire_ast(ast)
