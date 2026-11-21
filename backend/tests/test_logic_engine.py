import pytest
from app.engine.logic import (
    validate_answer,
    resolve_piping,
    resolve_question_options,
    evaluate_terminate_on,
    get_next_question_info,
)

def test_validate_answer_required():
    q = {"id": "q1", "type": "text", "required": True}
    ok, err = validate_answer(q, "")
    assert ok is False
    assert "required" in err.lower()

    ok, err = validate_answer(q, "Some answer")
    assert ok is True

def test_validate_multi_exclusive_and_max():
    q = {
        "id": "q6",
        "type": "multi",
        "required": True,
        "max": 2,
        "options": [
            {"text": "Apple"},
            {"text": "Samsung"},
            {"text": "None of these", "exclusive": True}
        ]
    }
    # Max check
    ok, err = validate_answer(q, ["Apple", "Samsung", "Google"])
    assert ok is False
    assert "cannot select more than 2" in err.lower()

    # Exclusive check
    ok, err = validate_answer(q, ["Apple", "None of these"])
    assert ok is False
    assert "exclusive" in err.lower() or "cannot be selected together" in err.lower()

    # Valid exclusive alone
    ok, err = validate_answer(q, ["None of these"])
    assert ok is True

def test_validate_formats():
    q_pin = {"id": "q_pin", "type": "formatted", "format": "pincode", "required": True}
    assert validate_answer(q_pin, "400001")[0] is True
    assert validate_answer(q_pin, "40000")[0] is False
    assert validate_answer(q_pin, "4000012")[0] is False

    q_phone = {"id": "q_ph", "type": "formatted", "format": "phone", "required": True}
    assert validate_answer(q_phone, "9876543210")[0] is True
    assert validate_answer(q_phone, "98765")[0] is False

    q_email = {"id": "q_em", "type": "formatted", "format": "email", "required": True}
    assert validate_answer(q_email, "test@example.com")[0] is True
    assert validate_answer(q_email, "invalid-email")[0] is False

def test_validate_rating_and_nps():
    q_rate = {"id": "q_r", "type": "rating", "min": 1, "max": 5}
    assert validate_answer(q_rate, 4)[0] is True
    assert validate_answer(q_rate, 6)[0] is False

    q_nps = {"id": "q_nps", "type": "nps"}
    assert validate_answer(q_nps, 10)[0] is True
    assert validate_answer(q_nps, 0)[0] is True
    assert validate_answer(q_nps, 11)[0] is False

def test_validate_matrix():
    q_mat = {
        "id": "q11",
        "type": "matrix",
        "required": True,
        "rows": [{"text": "Battery"}, {"text": "Camera"}],
        "options": [{"text": "Good"}, {"text": "Bad"}]
    }
    assert validate_answer(q_mat, {"Battery": "Good", "Camera": "Bad"})[0] is True
    assert validate_answer(q_mat, {"Battery": "Good"})[0] is False # missing Camera
    assert validate_answer(q_mat, {"Battery": "Good", "Camera": "Average"})[0] is False # invalid option

def test_piping_with_other():
    text = "How happy are you with your [q7] phone?"
    # Regular piping
    res = resolve_piping(text, {"q7": "Samsung"}, {}, {})
    assert res == "How happy are you with your Samsung phone?"

    # Piping with other typed text
    res_other = resolve_piping(text, {"q7": "Other (specify)"}, {"q7": "Lava"}, {})
    assert res_other == "How happy are you with your Lava phone?"

def test_options_from_and_shuffle():
    q_target = {
        "id": "q7",
        "type": "single",
        "options-from": "q6",
        "options": []
    }
    answers = {"q6": ["Apple", "OnePlus"]}
    q_map = {
        "q6": {
            "id": "q6",
            "type": "multi",
            "options": [{"text": "Apple"}, {"text": "Samsung"}, {"text": "OnePlus"}]
        }
    }
    resolved = resolve_question_options(q_target, answers, q_map)
    assert len(resolved) == 2
    assert [opt["text"] for opt in resolved] == ["Apple", "OnePlus"]

    # Test shuffle with fixed option
    q_shuf = {
        "id": "q_s",
        "type": "multi",
        "shuffle": True,
        "options": [
            {"text": "A"},
            {"text": "B"},
            {"text": "C"},
            {"text": "None", "fixed": True}
        ]
    }
    opts_shuffled = resolve_question_options(q_shuf, {}, {}, respondent_id="resp_123")
    assert opts_shuffled[-1]["text"] == "None" # fixed option is always last

def test_consecutive_screener_rule():
    # Survey with 2 consecutive screeners: q1 (city) and q2 (smartphone user), then q3 (main study)
    survey_ast = {
        "questions": [
            {
                "id": "q1",
                "type": "dropdown",
                "terminate-on": "Other city",
                "reason": "City not in scope",
                "options": [{"text": "Mumbai"}, {"text": "Other city"}]
            },
            {
                "id": "q2",
                "type": "yesno",
                "terminate-on": "No",
                "reason": "Not a smartphone user",
                "options": [{"text": "Yes"}, {"text": "No"}]
            },
            {
                "id": "q3",
                "type": "text",
                "text": "Main study question"
            }
        ]
    }

    # Case A: Fails q1 ("Other city"). Next question q2 ALSO has terminate-on rule!
    # Under consecutive-screener rule, respondent is NOT terminated yet; they continue to q2!
    next_q, should_term, reason = get_next_question_info(
        survey_ast, "q1", "Other city", {"q1": "Other city"}, ["q1"], has_recorded_termination=True
    )
    assert should_term is False
    assert next_q["id"] == "q2"

    # Case B: At q2, respondent answers "Yes" (passes q2) or "No" (fails q2).
    # Next question q3 does NOT have a terminate-on rule!
    # Respondent must be TERMINATED now!
    next_q, should_term, reason = get_next_question_info(
        survey_ast, "q2", "Yes", {"q1": "Other city", "q2": "Yes"}, ["q1", "q2"], has_recorded_termination=True
    )
    assert should_term is True
    assert next_q is None

def test_consent_no_terminates_immediately():
    survey_ast = {
        "questions": [
            {"id": "q1", "type": "consent", "required": True},
            {"id": "q2", "type": "yesno", "terminate-on": "No"}
        ]
    }
    next_q, should_term, reason = get_next_question_info(
        survey_ast, "q1", "No", {"q1": "No"}, ["q1"]
    )
    assert should_term is True
    assert "consent declined" in reason.lower()
