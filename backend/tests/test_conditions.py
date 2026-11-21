import pytest
from app.parser.conditions import parse_condition, evaluate_condition, extract_condition_references, ConditionSyntaxError

def test_single_equality():
    ast = parse_condition("q8=1")
    assert ast == {"type": "EQ", "question": "q8", "value": "1"}
    assert evaluate_condition(ast, {"q8": 1}) is True
    assert evaluate_condition(ast, {"q8": "1"}) is True
    assert evaluate_condition(ast, {"q8": 2}) is False

def test_or_condition():
    ast = parse_condition("q8=1 OR q8=2")
    assert ast["type"] == "OR"
    assert len(ast["children"]) == 2
    assert evaluate_condition(ast, {"q8": 1}) is True
    assert evaluate_condition(ast, {"q8": 2}) is True
    assert evaluate_condition(ast, {"q8": 3}) is False

def test_and_condition():
    ast = parse_condition("q12=Yes AND q4=Mumbai")
    assert ast["type"] == "AND"
    assert len(ast["children"]) == 2
    assert evaluate_condition(ast, {"q12": "Yes", "q4": "Mumbai"}) is True
    assert evaluate_condition(ast, {"q12": "Yes", "q4": "Pune"}) is False
    assert evaluate_condition(ast, {"q12": "No", "q4": "Mumbai"}) is False

def test_and_binds_tighter_than_or():
    # A OR B AND C  should parse as: A OR (B AND C)
    ast = parse_condition("q1=1 OR q2=2 AND q3=3")
    assert ast["type"] == "OR"
    assert ast["children"][0] == {"type": "EQ", "question": "q1", "value": "1"}
    assert ast["children"][1]["type"] == "AND"
    
    # If q1 is 1, whole thing should be True regardless of q2, q3
    assert evaluate_condition(ast, {"q1": 1, "q2": 0, "q3": 0}) is True
    # If q1 is 0, but q2 is 2 and q3 is 3, True
    assert evaluate_condition(ast, {"q1": 0, "q2": 2, "q3": 3}) is True
    # If q1 is 0 and q2 is 2 and q3 is 0, False
    assert evaluate_condition(ast, {"q1": 0, "q2": 2, "q3": 0}) is False

def test_condition_references_extraction():
    ast = parse_condition("q12=Yes AND q4=Mumbai OR q8=1")
    refs = extract_condition_references(ast)
    assert ("q12", "Yes") in refs
    assert ("q4", "Mumbai") in refs
    assert ("q8", "1") in refs

def test_invalid_syntax():
    with pytest.raises(ConditionSyntaxError):
        parse_condition("q8=")
    with pytest.raises(ConditionSyntaxError):
        parse_condition("=1")
    with pytest.raises(ConditionSyntaxError):
        parse_condition("q8=1 AND")
