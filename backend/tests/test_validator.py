import os
from app.parser.validator import validate_questionnaire_text

def test_validate_sample_questionnaire_is_valid():
    sample_path = os.path.join(os.path.dirname(__file__), "..", "..", "samples", "concave_sample_questionnaire.txt")
    with open(sample_path, "r", encoding="utf-8") as f:
        content = f.read()

    errors = validate_questionnaire_text(content)
    assert errors == [], f"Expected 0 errors on valid sample, got: {errors}"

def test_validate_broken_questionnaire():
    broken_path = os.path.join(os.path.dirname(__file__), "..", "..", "samples", "concave_broken_questionnaire.txt")
    with open(broken_path, "r", encoding="utf-8") as f:
        content = f.read()

    errors = validate_questionnaire_text(content)
    assert len(errors) > 0

    # Verify all 10 expected issues are caught
    error_texts = " ".join(e["message"] for e in errors)
    lines_with_errors = [e["line"] for e in errors]

    # 1. Unknown type "singel"
    assert any("singel" in e["message"] for e in errors)
    assert 11 in lines_with_errors

    # 2. Missing id on city question
    assert any("missing an 'id'" in e["message"].lower() for e in errors)
    assert 16 in lines_with_errors

    # 3. Duplicate q6
    assert any("duplicate" in e["message"].lower() and "q6" in e["message"] for e in errors)
    assert 35 in lines_with_errors

    # 4. options-from="q66"
    assert any("q66" in e["message"] for e in errors)
    assert 31 in lines_with_errors

    # 5. terminate-on="Never"
    assert any("Never" in e["message"] for e in errors)
    assert 21 in lines_with_errors

    # 6. show-if forward reference or invalid option
    assert any("show-if" in e["message"].lower() and "later" in e["message"].lower() and "q10" in e["message"] for e in errors)
    assert any("show-if" in e["message"].lower() and "not a valid option" in e["message"].lower() and "q10" in e["message"] for e in errors)
    assert 39 in lines_with_errors

    # 7. skip-to="q20"
    assert any("skip-to" in e["message"].lower() and "q20" in e["message"] for e in errors)
    assert 45 in lines_with_errors

    # 8. matrix with no scale options
    assert any("matrix" in e["message"].lower() and "option" in e["message"].lower() for e in errors)
    assert 48 in lines_with_errors

    # 9. quota value "Others" on q3
    assert any("Others" in e["message"] and "q3" in e["message"] for e in errors)
    assert 57 in lines_with_errors

    # 10. quota on q2 with value "Mumbai" (wrong question type number)
    assert any("q2" in e["message"] and ("categorical" in e["message"].lower() or "Mumbai" in e["message"]) for e in errors)
    assert 58 in lines_with_errors


def test_show_if_invalid_option_value():
    survey_text = """<survey id="test_study" title="Test" target="100">
<question id="q1" type="single" required>
  <text>Do you have a car?</text>
  <option>Sedan</option><option>SUV</option>
</question>
<question id="q2" type="text" show-if="q1=Bicycle">
  <text>What brand is it?</text>
</question>
</survey>"""
    errors = validate_questionnaire_text(survey_text)
    assert any("not a valid option for question 'q1'" in e["message"] for e in errors)
