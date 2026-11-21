import re
from typing import Any, Dict, List, Union

class ConditionSyntaxError(Exception):
    def __init__(self, message: str, position: int = 0):
        super().__init__(message)
        self.position = position

def tokenize_condition(condition_str: str) -> List[Dict[str, Any]]:
    tokens = []
    i = 0
    s = condition_str.strip()
    n = len(s)
    
    while i < n:
        if s[i].isspace():
            i += 1
            continue
        
        # AND / OR keywords
        if s[i:i+3].upper() == "AND" and (i+3 >= n or not s[i+3].isalnum()):
            tokens.append({"type": "AND", "val": "AND", "pos": i})
            i += 3
            continue
        if s[i:i+2].upper() == "OR" and (i+2 >= n or not s[i+2].isalnum()):
            tokens.append({"type": "OR", "val": "OR", "pos": i})
            i += 2
            continue
            
        if s[i] == "=":
            tokens.append({"type": "EQ", "val": "=", "pos": i})
            i += 1
            continue
            
        if s[i] in ("'", '"'):
            quote = s[i]
            start = i
            i += 1
            val_chars = []
            while i < n and s[i] != quote:
                val_chars.append(s[i])
                i += 1
            if i >= n:
                raise ConditionSyntaxError(f"Unclosed string literal starting at position {start}", start)
            i += 1 # skip closing quote
            tokens.append({"type": "VALUE", "val": "".join(val_chars), "pos": start})
            continue
            
        # Word / Identifier / Value
        start = i
        val_chars = []
        while i < n and not s[i].isspace() and s[i] not in ("=", "'", '"'):
            val_chars.append(s[i])
            i += 1
        val_str = "".join(val_chars)
        tokens.append({"type": "VALUE", "val": val_str, "pos": start})
        
    return tokens

def parse_condition(condition_str: str) -> Dict[str, Any]:
    if not condition_str or not condition_str.strip():
        return {}
        
    tokens = tokenize_condition(condition_str)
    if not tokens:
        return {}
        
    idx = 0
    n = len(tokens)
    
    def parse_comparison() -> Dict[str, Any]:
        nonlocal idx
        if idx >= n:
            raise ConditionSyntaxError("Unexpected end of condition")
            
        left_tok = tokens[idx]
        if left_tok["type"] != "VALUE":
            raise ConditionSyntaxError(f"Expected identifier at position {left_tok['pos']}, got {left_tok['val']}")
        q_id = left_tok["val"]
        idx += 1
        
        if idx >= n or tokens[idx]["type"] != "EQ":
            pos = tokens[idx]["pos"] if idx < n else len(condition_str)
            raise ConditionSyntaxError(f"Expected '=' after '{q_id}' at position {pos}")
        idx += 1
        
        if idx >= n or tokens[idx]["type"] != "VALUE":
            pos = tokens[idx]["pos"] if idx < n else len(condition_str)
            raise ConditionSyntaxError(f"Expected value after '=' at position {pos}")
        val = tokens[idx]["val"]
        idx += 1
        
        return {"type": "EQ", "question": q_id, "value": val}

    def parse_and() -> Dict[str, Any]:
        nonlocal idx
        left = parse_comparison()
        
        children = [left]
        while idx < n and tokens[idx]["type"] == "AND":
            idx += 1
            children.append(parse_comparison())
            
        if len(children) == 1:
            return children[0]
        return {"type": "AND", "children": children}

    def parse_or() -> Dict[str, Any]:
        nonlocal idx
        left = parse_and()
        
        children = [left]
        while idx < n and tokens[idx]["type"] == "OR":
            idx += 1
            children.append(parse_and())
            
        if len(children) == 1:
            return children[0]
        return {"type": "OR", "children": children}

    ast = parse_or()
    if idx < n:
        raise ConditionSyntaxError(f"Unexpected token '{tokens[idx]['val']}' at position {tokens[idx]['pos']}")
    return ast

def extract_condition_references(ast: Dict[str, Any]) -> List[tuple]:
    refs = []
    if not ast:
        return refs
        
    node_type = ast.get("type")
    if node_type == "EQ":
        refs.append((ast["question"], str(ast["value"])))
    elif node_type in ("AND", "OR"):
        for child in ast.get("children", []):
            refs.extend(extract_condition_references(child))
    return refs

def evaluate_condition(ast: Dict[str, Any], answers: Dict[str, Any]) -> bool:
    if not ast:
        return True
        
    node_type = ast.get("type")
    if node_type == "EQ":
        q = ast["question"]
        target_val = str(ast["value"])
        if q not in answers:
            return False
            
        actual = answers[q]
        if isinstance(actual, list):
            return any(str(item) == target_val for item in actual)
        return str(actual) == target_val
        
    elif node_type == "AND":
        return all(evaluate_condition(child, answers) for child in ast.get("children", []))
        
    elif node_type == "OR":
        return any(evaluate_condition(child, answers) for child in ast.get("children", []))
        
    return False
