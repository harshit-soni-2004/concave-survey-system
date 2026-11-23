import re
from typing import Any, Dict, List, Optional, Tuple

class TagToken:
    def __init__(self, tag_name: str, attributes: Dict[str, Any], is_closing: bool, is_self_closing: bool, line_number: int):
        self.tag_name = tag_name
        self.attributes = attributes
        self.is_closing = is_closing
        self.is_self_closing = is_self_closing
        self.line_number = line_number

    def __repr__(self):
        return f"<TagToken {self.tag_name} close={self.is_closing} self_close={self.is_self_closing} L{self.line_number}>"

def parse_tag_attributes(attr_string: str) -> Dict[str, Any]:
    attrs: Dict[str, Any] = {}
    pattern = re.compile(r'([a-zA-Z0-9_\-]+)(?:=(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+)))?')
    for m in pattern.finditer(attr_string):
        key = m.group(1).lower()
        if m.group(2) is not None:
            val = m.group(2)
        elif m.group(3) is not None:
            val = m.group(3)
        elif m.group(4) is not None:
            val = m.group(4)
        else:
            val = True
            
        if isinstance(val, str):
            if val.lower() == "true":
                val = True
            elif val.lower() == "false":
                val = False
            elif val.isdigit():
                val = int(val)
        attrs[key] = val
    return attrs

def parse_questionnaire(content: str) -> Dict[str, Any]:
    lines = content.splitlines(keepends=True)
    
    survey_data: Dict[str, Any] = {
        "id": "",
        "title": "",
        "target": 0,
        "line_number": 1,
        "questions": [],
        "quotas": [],
        "rotations": []
    }
    
    current_question: Optional[Dict[str, Any]] = None
    
    tag_re = re.compile(r'(<(/)?([a-zA-Z0-9_\-]+)([^>]*)>)')
    
    for line_idx, line in enumerate(lines, 1):
        pos = 0
        while pos < len(line):
            match = tag_re.search(line, pos)
            if not match:
                break
                
            raw_tag, is_close, tag_name, raw_attrs = match.groups()
            tag_name = tag_name.lower()
            is_closing = bool(is_close)
            is_self_closing = raw_attrs.endswith("/")
            clean_attrs = raw_attrs[:-1] if is_self_closing else raw_attrs
            attrs = parse_tag_attributes(clean_attrs)
            
            end_tag_pos = match.end()
            
            if tag_name == "survey":
                if not is_closing:
                    survey_data["id"] = attrs.get("id", "")
                    survey_data["title"] = attrs.get("title", "")
                    survey_data["target"] = int(attrs.get("target", 0)) if str(attrs.get("target", "")).isdigit() else attrs.get("target", 0)
                    survey_data["line_number"] = line_idx
                    for k, v in attrs.items():
                        if k not in survey_data:
                            survey_data[k] = v
                            
            elif tag_name == "question":
                if is_closing:
                    if current_question is not None:
                        survey_data["questions"].append(current_question)
                        current_question = None
                else:
                    if current_question is not None:
                        survey_data["questions"].append(current_question)
                    
                    current_question = {
                        "id": attrs.get("id"),
                        "type": attrs.get("type"),
                        "required": bool(attrs.get("required", False)),
                        "line_number": line_idx,
                        "text": "",
                        "options": [],
                        "rows": [],
                        "attributes": attrs
                    }
                    for k, v in attrs.items():
                        if k not in current_question:
                            current_question[k] = v
                            
            elif tag_name in ("text", "trans"):
                if not is_closing:
                    close_tag = f"</{tag_name}>"
                    close_idx = line.find(close_tag, end_tag_pos)
                    lang = attrs.get("lang")
                    if close_idx != -1:
                        text_val = line[end_tag_pos:close_idx].strip()
                        if current_question:
                            if lang:
                                current_question.setdefault("translations", {})[lang] = text_val
                            else:
                                current_question["text"] = text_val
                        pos = close_idx + len(close_tag)
                        continue
                    else:
                        text_val = line[end_tag_pos:].strip()
                        if current_question:
                            if lang:
                                current_question.setdefault("translations", {})[lang] = text_val
                            else:
                                current_question["text"] = text_val
                            
            elif tag_name == "option":
                if not is_closing:
                    close_tag = "</option>"
                    close_idx = line.find(close_tag, end_tag_pos)
                    lang = attrs.get("lang")
                    if close_idx != -1:
                        opt_text = line[end_tag_pos:close_idx].strip()
                        if current_question is not None:
                            if lang and current_question.get("options"):
                                current_question["options"][-1].setdefault("translations", {})[lang] = opt_text
                            else:
                                opt_dict = {
                                    "text": opt_text,
                                    "line_number": line_idx,
                                    "fixed": bool(attrs.get("fixed", False)),
                                    "other": bool(attrs.get("other", False)),
                                    "exclusive": bool(attrs.get("exclusive", False)),
                                    "skip_to": attrs.get("skip-to") or attrs.get("skip_to"),
                                    "translations": {},
                                    "attributes": attrs
                                }
                                current_question["options"].append(opt_dict)
                        pos = close_idx + len(close_tag)
                        continue
                        
            elif tag_name == "row":
                if not is_closing:
                    close_tag = "</row>"
                    close_idx = line.find(close_tag, end_tag_pos)
                    lang = attrs.get("lang")
                    if close_idx != -1:
                        row_text = line[end_tag_pos:close_idx].strip()
                        if current_question is not None:
                            if lang and current_question.get("rows"):
                                current_question["rows"][-1].setdefault("translations", {})[lang] = row_text
                            else:
                                row_dict = {
                                    "text": row_text,
                                    "line_number": line_idx,
                                    "translations": {},
                                    "attributes": attrs
                                }
                                current_question["rows"].append(row_dict)
                        pos = close_idx + len(close_tag)
                        continue
                        
            elif tag_name == "quota":
                target_val = attrs.get("target", 0)
                q2_id = attrs.get("question2") or attrs.get("question_id_2") or attrs.get("question_2") or attrs.get("q2")
                v2_val = attrs.get("value2") or attrs.get("value_2") or attrs.get("v2")
                quota_dict = {
                    "question_id": attrs.get("question") or attrs.get("question_id"),
                    "value": str(attrs.get("value", "")),
                    "question_id_2": q2_id,
                    "value_2": str(v2_val) if v2_val is not None else None,
                    "target": int(target_val) if str(target_val).isdigit() else target_val,
                    "line_number": line_idx,
                    "attributes": attrs
                }
                survey_data["quotas"].append(quota_dict)

            elif tag_name == "rotation":
                arm_a = attrs.get("arm_a") or attrs.get("arm1") or attrs.get("concept_a") or attrs.get("first") or attrs.get("a")
                arm_b = attrs.get("arm_b") or attrs.get("arm2") or attrs.get("concept_b") or attrs.get("second") or attrs.get("b")
                rot_dict = {
                    "arm_a": arm_a,
                    "arm_b": arm_b,
                    "line_number": line_idx,
                    "attributes": attrs
                }
                survey_data["rotations"].append(rot_dict)
                
            pos = end_tag_pos

    if current_question is not None:
        survey_data["questions"].append(current_question)
        
    return survey_data
