import os
from app.parser.parser import parse_questionnaire

def test_parse_sample_survey():
    sample_path = os.path.join(os.path.dirname(__file__), "..", "..", "samples", "concave_sample_questionnaire.txt")
    with open(sample_path, "r", encoding="utf-8") as f:
        content = f.read()

    ast = parse_questionnaire(content)
    assert ast["id"] == "smartphone_study"
    assert ast["title"] == "Smartphone Usage Study"
    assert ast["target"] == 200
    assert len(ast["questions"]) == 18
    assert len(ast["quotas"]) == 3

    # Check question types and attributes
    q0 = ast["questions"][0]
    assert q0["id"] == "q0"
    assert q0["type"] == "info"
    assert "Thank you for joining" in q0["text"]
    assert q0["line_number"] == 3

    q1 = ast["questions"][1]
    assert q1["id"] == "q1"
    assert q1["type"] == "consent"
    assert q1["required"] is True

    q6 = next(q for q in ast["questions"] if q["id"] == "q6")
    assert q6["type"] == "multi"
    assert q6["shuffle"] is True
    assert q6["max"] == 3
    assert len(q6["options"]) == 7
    # Other option
    other_opt = q6["options"][-1]
    assert other_opt["fixed"] is True
    assert other_opt["other"] is True

    # Matrix question
    q11 = next(q for q in ast["questions"] if q["id"] == "q11")
    assert q11["type"] == "matrix"
    assert len(q11["rows"]) == 4
    assert len(q11["options"]) == 5

    # Skip-to on option
    q12 = next(q for q in ast["questions"] if q["id"] == "q12")
    assert q12["type"] == "yesno"
    no_opt = next(opt for opt in q12["options"] if opt["text"] == "No")
    assert no_opt["skip_to"] == "q16"

    # Quotas
    assert ast["quotas"][0]["question_id"] == "q3"
    assert ast["quotas"][0]["value"] == "Male"
    assert ast["quotas"][0]["target"] == 100
