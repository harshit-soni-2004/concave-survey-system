import re
import random
from typing import Any, Dict, List, Optional, Tuple, Set
from app.parser.conditions import parse_condition, evaluate_condition

def validate_answer(question: Dict[str, Any], answer_value: Any, other_text: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    q_id = question.get("id", "")
    q_type = question.get("type", "")
    required = bool(question.get("required", False))

    if answer_value is None or answer_value == "" or (isinstance(answer_value, list) and len(answer_value) == 0):
        if required:
            return False, f"Question '{q_id}' is required"
        return True, None

    if q_type == "consent":
        if answer_value not in ("Yes", "No"):
            return False, "Consent answer must be 'Yes' or 'No'"
        return True, None

    elif q_type == "yesno":
        valid_opts = [opt["text"] for opt in question.get("options", [])] or ["Yes", "No"]
        if str(answer_value) not in valid_opts:
            return False, f"Answer must be one of {valid_opts}"
        return True, None

    elif q_type in ("single", "dropdown"):
        valid_opts = [opt["text"] for opt in question.get("options", [])]
        # Also allow dynamic options from options-from if passed in question definition
        if valid_opts and str(answer_value) not in valid_opts:
            return False, f"Selected option '{answer_value}' is not valid for question '{q_id}'"
        
        # Check other_text if chosen option is other=True
        for opt in question.get("options", []):
            if opt["text"] == str(answer_value) and opt.get("other"):
                if required and (not other_text or not other_text.strip()):
                    return False, f"Please specify details for '{answer_value}'"
        return True, None

    elif q_type == "multi":
        if not isinstance(answer_value, list):
            return False, "Multi-choice answer must be a list of options"

        # Check max attribute
        max_choices = question.get("max")
        if max_choices is not None:
            try:
                if len(answer_value) > int(max_choices):
                    return False, f"Cannot select more than {max_choices} options"
            except ValueError:
                pass

        valid_opts = [opt["text"] for opt in question.get("options", [])]
        exclusive_opts = [opt["text"] for opt in question.get("options", []) if opt.get("exclusive")]
        other_opts = [opt["text"] for opt in question.get("options", []) if opt.get("other")]

        for item in answer_value:
            if valid_opts and str(item) not in valid_opts:
                return False, f"Selected option '{item}' is not valid for question '{q_id}'"

        # Check exclusive: if exclusive option is picked, it must be the only picked option
        for exc in exclusive_opts:
            if exc in answer_value and len(answer_value) > 1:
                return False, f"Option '{exc}' cannot be selected together with other options"

        # Check other text
        for oth in other_opts:
            if oth in answer_value and required and (not other_text or not other_text.strip()):
                return False, f"Please specify details for '{oth}'"
        return True, None

    elif q_type == "rating":
        try:
            val = int(answer_value)
            r_min = int(question.get("min", 1))
            r_max = int(question.get("max", 5))
            if val < r_min or val > r_max:
                return False, f"Rating must be between {r_min} and {r_max}"
        except (ValueError, TypeError):
            return False, "Rating must be an integer"
        return True, None

    elif q_type == "nps":
        try:
            val = int(answer_value)
            if val < 0 or val > 10:
                return False, "NPS score must be between 0 and 10"
        except (ValueError, TypeError):
            return False, "NPS score must be an integer"
        return True, None

    elif q_type == "number":
        try:
            val = float(answer_value)
            q_min = question.get("min")
            q_max = question.get("max")
            if q_min is not None and val < float(q_min):
                return False, f"Number must be at least {q_min}"
            if q_max is not None and val > float(q_max):
                return False, f"Number must be at most {q_max}"
        except (ValueError, TypeError):
            return False, "Answer must be a valid number"
        return True, None

    elif q_type in ("text", "longtext"):
        val_str = str(answer_value).strip()
        minlength = question.get("minlength")
        if minlength is not None:
            try:
                if len(val_str) < int(minlength):
                    return False, f"Answer must be at least {minlength} characters"
            except ValueError:
                pass
        return True, None

    elif q_type == "formatted":
        fmt = question.get("format", "").lower()
        val_str = str(answer_value).strip()
        if fmt == "pincode":
            if not re.match(r"^\d{6}$", val_str):
                return False, "Area pincode must be exactly 6 digits"
        elif fmt == "phone":
            if not re.match(r"^\d{10}$", val_str):
                return False, "Phone number must be a 10-digit number"
        elif fmt == "email":
            if not re.match(r"^[^@]+@[^@]+\.[^@]+$", val_str):
                return False, "Please enter a valid email address"
        return True, None

    elif q_type == "matrix":
        if not isinstance(answer_value, dict):
            return False, "Matrix answer must be a mapping of rows to chosen options"
        rows = [r["text"] for r in question.get("rows", [])]
        valid_opts = [opt["text"] for opt in question.get("options", [])]
        for r in rows:
            if r not in answer_value:
                if required:
                    return False, f"Please select an option for '{r}'"
            else:
                chosen = str(answer_value[r])
                if chosen not in valid_opts:
                    return False, f"Option '{chosen}' is not valid for row '{r}'"
        return True, None

    return True, None

def resolve_piping(text: str, answers: Dict[str, Any], other_texts: Dict[str, str], questions_map: Dict[str, Dict[str, Any]]) -> str:
    if not text or "[" not in text:
        return text

    def replace_token(match: re.Match) -> str:
        ref_qid = match.group(1)
        if ref_qid not in answers:
            return match.group(0)

        # If reference question had an other_text, use that
        if ref_qid in other_texts and other_texts[ref_qid]:
            return other_texts[ref_qid]

        ans = answers[ref_qid]
        if isinstance(ans, list):
            return ", ".join(str(x) for x in ans)
        return str(ans)

    return re.sub(r"\[([a-zA-Z0-9_\-]+)\]", replace_token, text)

def resolve_question_options(
    question: Dict[str, Any],
    answers: Dict[str, Any],
    questions_map: Dict[str, Dict[str, Any]],
    respondent_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    # Check options-from
    opt_from = question.get("options_from") or question.get("options-from") or question.get("attributes", {}).get("options-from")
    options: List[Dict[str, Any]] = []

    if opt_from and opt_from in answers:
        source_ans = answers[opt_from]
        if isinstance(source_ans, list):
            picked_list = source_ans
        else:
            picked_list = [source_ans]

        source_q = questions_map.get(opt_from, {})
        source_opts_map = {opt["text"]: opt for opt in source_q.get("options", [])}

        for item in picked_list:
            if item in source_opts_map:
                options.append(dict(source_opts_map[item]))
            else:
                options.append({"text": str(item), "fixed": False, "other": False, "exclusive": False})
    else:
        options = [dict(opt) for opt in question.get("options", [])]

    # Check shuffle
    shuffle = bool(question.get("shuffle", False))
    if shuffle and len(options) > 1:
        fixed_opts = [opt for opt in options if opt.get("fixed")]
        shufflable = [opt for opt in options if not opt.get("fixed")]
        
        # Stable shuffle per respondent and question
        seed_key = f"{respondent_id or 'anon'}_{question.get('id', '')}"
        rng = random.Random(seed_key)
        rng.shuffle(shufflable)
        options = shufflable + fixed_opts

    return options

def evaluate_terminate_on(question: Dict[str, Any], answer_value: Any) -> Optional[Tuple[str, bool]]:
    q_type = question.get("type", "")
    term_val = question.get("terminate_on") or question.get("terminate-on") or question.get("attributes", {}).get("terminate-on")
    reason = question.get("reason") or question.get("attributes", {}).get("reason") or "Disqualified by screening criteria"
    silent = bool(question.get("silent") or question.get("attributes", {}).get("silent", False))

    if q_type == "consent":
        if answer_value == "No":
            return "Consent declined", silent
        return None

    if term_val is not None:
        if isinstance(answer_value, list):
            if term_val in answer_value:
                return reason, silent
        elif str(answer_value) == str(term_val):
            return reason, silent

    return None

def is_question_visible(question: Dict[str, Any], answers: Dict[str, Any]) -> bool:
    show_if = question.get("show_if") or question.get("show-if") or question.get("attributes", {}).get("show-if")
    if not show_if:
        return True
    try:
        ast = parse_condition(show_if)
        return evaluate_condition(ast, answers)
    except Exception:
        return True

def get_effective_questions(survey_ast: Dict[str, Any], rotation_arm: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns question list respecting balanced concept rotation (AB vs BA)."""
    questions = list(survey_ast.get("questions", []))
    if rotation_arm == "BA" and survey_ast.get("rotations"):
        for rot in survey_ast.get("rotations", []):
            arm_a = rot.get("arm_a")
            arm_b = rot.get("arm_b")
            q_ids = [q["id"] for q in questions]
            if arm_a in q_ids and arm_b in q_ids:
                idx_a = q_ids.index(arm_a)
                idx_b = q_ids.index(arm_b)
                questions[idx_a], questions[idx_b] = questions[idx_b], questions[idx_a]
    return questions

def get_next_question_info(
    survey_ast: Dict[str, Any],
    current_qid: Optional[str],
    current_answer: Any,
    answers: Dict[str, Any],
    path: List[str],
    has_recorded_termination: bool = False,
    rotation_arm: Optional[str] = None
) -> Tuple[Optional[Dict[str, Any]], bool, Optional[str]]:
    """
    Determines next question, whether to terminate, and termination reason if terminating.
    Returns: (next_question_dict_or_None, should_terminate, final_reason)
    """
    questions: List[Dict[str, Any]] = get_effective_questions(survey_ast, rotation_arm)
    if not questions:
        return None, False, None

    # First question entry
    if current_qid is None:
        for q in questions:
            if is_question_visible(q, answers):
                return q, False, None
        return None, False, None

    q_idx_map = {q["id"]: i for i, q in enumerate(questions)}
    if current_qid not in q_idx_map:
        return None, False, None

    curr_idx = q_idx_map[current_qid]
    curr_q = questions[curr_idx]

    # 1. Check if current answer triggers a termination
    term_trigger = evaluate_terminate_on(curr_q, current_answer)
    is_consent_no = (curr_q.get("type") == "consent" and current_answer == "No")

    # If consent No -> Immediate termination
    if is_consent_no:
        return None, True, "Consent declined"

    # Consecutive screener logic:
    # If a termination was triggered now or was already recorded earlier
    is_terminating_run = bool(term_trigger or has_recorded_termination)

    active_term_reason = term_trigger[0] if term_trigger else None

    # 2. Check skip-to on current question or chosen option
    skip_to_target = None
    if isinstance(current_answer, (str, int)):
        for opt in curr_q.get("options", []):
            if opt["text"] == str(current_answer):
                skip_to_target = opt.get("skip_to") or opt.get("attributes", {}).get("skip-to")
                break
    if not skip_to_target:
        skip_to_target = curr_q.get("skip_to") or curr_q.get("attributes", {}).get("skip-to")

    start_idx = curr_idx + 1
    if skip_to_target and skip_to_target in q_idx_map:
        start_idx = q_idx_map[skip_to_target]

    # Find the next visible question
    next_q = None
    for idx in range(start_idx, len(questions)):
        q = questions[idx]
        if is_question_visible(q, answers):
            next_q = q
            break

    # If in terminating run:
    # Check if next question ALSO has a terminate-on rule
    if is_terminating_run:
        if next_q is not None:
            has_term_rule = bool(
                next_q.get("terminate_on") or
                next_q.get("terminate-on") or
                next_q.get("attributes", {}).get("terminate-on") or
                next_q.get("type") == "consent"
            )
            if has_term_rule:
                # Consecutive screener continues!
                return next_q, False, None
            else:
                # Screener phase ended; now terminate the survey
                return None, True, active_term_reason or "Disqualified by screening criteria"
        else:
            # End of survey reached while disqualified
            return None, True, active_term_reason or "Disqualified by screening criteria"

    return next_q, False, None
