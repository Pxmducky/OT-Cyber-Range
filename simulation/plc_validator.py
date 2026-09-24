import re

ALLOWED_READS = {
    "START",
    "STOP",
    "TEMPERATURE",
    "PRESSURE",
    "MOTOR_SPEED",
    "VALVE_POSITION",
    "PRODUCTION_RATE",
    "ALARM",
}

ALLOWED_WRITES = {
    "MOTOR_SPEED",
    "VALVE_POSITION",
    "ALARM",
    "TEMPERATURE",
    "PRESSURE",
}


def validate_program(source: str) -> list[str]:
    errors = []
    text = source or ""
    normalized = text.upper()
    lines = text.splitlines()

    if not re.search(r"^\s*PROGRAM\s+MAIN\s*$", text, re.IGNORECASE | re.MULTILINE):
        errors.append("PROGRAM MAIN is required.")

    if not re.search(r"^\s*NETWORK\s+\d+\s*$", text, re.IGNORECASE | re.MULTILINE):
        errors.append("At least one NETWORK <number> is required.")

    if len(re.findall(r"\bIF\b", normalized)) != len(re.findall(r"\bEND_IF\b", normalized)):
        errors.append("IF / END_IF mismatch.")

    in_if = False
    for number, raw in enumerate(lines, 1):
        line = raw.strip()
        upper = line.upper()
        if not line:
            continue
        if re.fullmatch(r"PROGRAM\s+MAIN", line, re.IGNORECASE):
            continue
        if re.fullmatch(r"NETWORK\s+\d+", line, re.IGNORECASE):
            continue
        if re.fullmatch(r"IF\s+.+\s+THEN", line, re.IGNORECASE):
            in_if = True
            condition = re.sub(r"^IF\s+|\s+THEN$", "", line, flags=re.IGNORECASE).strip()
            if not _valid_condition(condition):
                errors.append(f"Line {number}: Invalid condition '{condition}'.")
            continue
        if re.fullmatch(r"END_IF;?", line, re.IGNORECASE):
            in_if = False
            continue

        assignment = re.match(r"^([A-Z_][A-Z0-9_]*)\s*:=\s*(.+);$", line, re.IGNORECASE)
        if assignment:
            variable = assignment.group(1).upper()
            value = assignment.group(2).strip()
            if variable not in ALLOWED_WRITES:
                errors.append(f"Line {number}: Variable '{variable}' cannot be written.")
            elif not _valid_value(value):
                errors.append(f"Line {number}: Invalid value '{value}'.")
            if not in_if:
                errors.append(f"Line {number}: Assignments must be inside IF / END_IF.")
            continue

        errors.append(f"Line {number}: Unsupported instruction '{line}'.")

    if in_if:
        errors.append("Program ends before END_IF.")

    return errors


def _valid_value(value: str) -> bool:
    if value.upper() in {"TRUE", "FALSE"}:
        return True
    try:
        float(value)
        return True
    except ValueError:
        return value.upper() in ALLOWED_READS


def _valid_condition(condition: str) -> bool:
    if re.fullmatch(r"[A-Z_][A-Z0-9_]*", condition, re.IGNORECASE):
        return condition.upper() in ALLOWED_READS

    match = re.fullmatch(
        r"([A-Z_][A-Z0-9_]*)\s*(>=|<=|==|=|>|<)\s*(-?\d+(?:\.\d+)?)",
        condition,
        re.IGNORECASE,
    )
    if not match:
        return False
    return match.group(1).upper() in ALLOWED_READS