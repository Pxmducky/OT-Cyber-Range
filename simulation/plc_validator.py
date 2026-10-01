"""
plc_validator.py — Validador de Structured Text del OT Cyber Range.

Objetivo de esta versión:
  - Aceptar CUALQUIER programa ST razonable (el alumno puede escribir lo que
    quiera), manteniendo el sandbox: solo se valida estructura y sintaxis, NO
    se ejecuta código del host.
  - Permitir:
      * bloque VAR ... END_VAR con variables propias y valor inicial opcional
      * asignaciones a cualquier variable declarada o a las salidas del proceso
      * expresiones aritméticas ( + - * / MOD ) y lógicas ( AND OR NOT )
      * comparaciones  =  <>  <  <=  >  >=
      * IF / ELSIF / ELSE / END_IF anidados
      * NETWORK <n> como separador opcional
  - Las ÚNICAS variables que impactan el proceso real son PROCESS_OUTPUTS;
    cualquier otra es memoria interna del PLC (no afecta la planta).
"""

import re

# Variables que, al escribirse, cambian la producción real de la planta.
PROCESS_OUTPUTS = {
    "MOTOR_SPEED",
    "VALVE_POSITION",
    "TEMPERATURE",
    "PRESSURE",
    "ALARM",
}

# Variables del proceso que el programa puede LEER siempre (I/O del PLC).
PROCESS_INPUTS = {
    "START",
    "STOP",
    "TEMPERATURE",
    "PRESSURE",
    "MOTOR_SPEED",
    "VALVE_POSITION",
    "PRODUCTION_RATE",
    "ALARM",
}

_IDENT = r"[A-Za-z_][A-Za-z0-9_]*"
_RESERVED = {
    "PROGRAM", "END_PROGRAM", "VAR", "END_VAR", "VAR_INPUT", "VAR_OUTPUT",
    "IF", "THEN", "ELSIF", "ELSE", "END_IF", "NETWORK", "AND", "OR", "NOT",
    "XOR", "MOD", "TRUE", "FALSE", "BOOL", "INT", "UINT", "DINT", "REAL",
    "LREAL", "WORD", "BYTE", "TIME",
}
_TYPES = {"BOOL", "INT", "UINT", "DINT", "REAL", "LREAL", "WORD", "BYTE"}
_FUNCS = {"LIMIT", "MIN", "MAX", "ABS"}


def validate_program(source: str):
    """Devuelve lista de errores (vacía = programa válido)."""
    errors = []
    text = source or ""

    if not re.search(r"^\s*PROGRAM\s+" + _IDENT + r"\s*$", text,
                     re.IGNORECASE | re.MULTILINE):
        errors.append("Se requiere una cabecera 'PROGRAM <nombre>'.")

    declared = _collect_declared_vars(text)

    # Recorrido línea por línea controlando bloques VAR e IF.
    in_var = False
    if_stack = 0          # profundidad de IF abiertos
    expect_then = False   # tras un IF/ELSIF debe venir THEN en la misma línea
    lines = text.splitlines()

    for n, raw in enumerate(lines, 1):
        line = raw.strip()
        if not line or _is_comment(line):
            continue
        upper = line.upper()

        # --- bloque de declaración ---
        if re.fullmatch(r"VAR(_INPUT|_OUTPUT)?", upper):
            in_var = True
            continue
        if upper == "END_VAR":
            if not in_var:
                errors.append(f"Línea {n}: END_VAR sin VAR.")
            in_var = False
            continue
        if in_var:
            if not _valid_declaration(line):
                errors.append(f"Línea {n}: declaración inválida '{line}'.")
            continue

        # --- cabeceras / separadores ---
        if re.fullmatch(r"PROGRAM\s+" + _IDENT, line, re.IGNORECASE):
            continue
        if upper == "END_PROGRAM":
            continue
        if re.fullmatch(r"NETWORK\s+\d+", line, re.IGNORECASE):
            continue

        # --- control de flujo ---
        m = re.match(r"^(IF|ELSIF)\b(.*)$", line, re.IGNORECASE)
        if m:
            kw = m.group(1).upper()
            rest = m.group(2)
            if kw == "ELSIF" and if_stack == 0:
                errors.append(f"Línea {n}: ELSIF sin IF.")
            then_m = re.search(r"\bTHEN\b", rest, re.IGNORECASE)
            if not then_m:
                errors.append(f"Línea {n}: falta THEN en '{line}'.")
            else:
                cond = rest[:then_m.start()].strip()
                tail = rest[then_m.end():].strip()
                if not cond:
                    errors.append(f"Línea {n}: condición vacía.")
                else:
                    errors += _check_expr(cond, declared, n, boolean=True)
                if tail and not _is_comment(tail):
                    errors.append(f"Línea {n}: no escribas código después de THEN.")
            if kw == "IF":
                if_stack += 1
            continue

        if re.fullmatch(r"ELSE", upper):
            if if_stack == 0:
                errors.append(f"Línea {n}: ELSE sin IF.")
            continue

        if re.fullmatch(r"END_IF;?", line, re.IGNORECASE):
            if if_stack == 0:
                errors.append(f"Línea {n}: END_IF sin IF.")
            else:
                if_stack -= 1
            continue

        # --- asignación ---
        asg = re.match(r"^(" + _IDENT + r")\s*:=\s*(.+?);?$", line)
        if asg:
            target = asg.group(1).upper()
            expr = asg.group(2).strip()
            if (target not in declared
                    and target not in PROCESS_OUTPUTS):
                errors.append(
                    f"Línea {n}: '{asg.group(1)}' no está declarada "
                    f"(decláralay en VAR...END_VAR) ni es una salida del proceso."
                )
            if not raw.rstrip().endswith(";"):
                errors.append(f"Línea {n}: falta ';' al final de la asignación.")
            errors += _check_expr(expr, declared, n, boolean=False)
            continue

        errors.append(f"Línea {n}: instrucción no soportada '{line}'.")

    if in_var:
        errors.append("Bloque VAR sin END_VAR.")
    if if_stack > 0:
        errors.append("Falta END_IF para cerrar un IF.")

    return errors


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _is_comment(line: str) -> bool:
    return line.startswith("//") or line.startswith("(*")


def _collect_declared_vars(text: str) -> set:
    """Nombres declarados en cualquier bloque VAR...END_VAR (en MAYÚSCULAS)."""
    declared = set()
    in_var = False
    for raw in text.splitlines():
        line = raw.strip()
        up = line.upper()
        if re.fullmatch(r"VAR(_INPUT|_OUTPUT)?", up):
            in_var = True
            continue
        if up == "END_VAR":
            in_var = False
            continue
        if in_var:
            m = re.match(r"^(" + _IDENT + r")\s*:", line)
            if m:
                declared.add(m.group(1).upper())
    return declared


def _valid_declaration(line: str) -> bool:
    # NOMBRE : TIPO [:= valor] ;
    m = re.match(
        r"^" + _IDENT + r"\s*:\s*(" + "|".join(_TYPES) +
        r")\s*(:=\s*[^;]+)?\s*;?\s*$",
        line, re.IGNORECASE,
    )
    return bool(m)


def _check_expr(expr: str, declared: set, line_no: int, boolean: bool):
    """Valida que la expresión solo use identificadores conocidos y tokens ST."""
    errors = []
    # tokens de identificador que no sean números, operadores ni reservados
    for ident in re.findall(_IDENT, expr):
        up = ident.upper()
        if up in _RESERVED:
            continue
        if up in declared or up in PROCESS_INPUTS or up in _FUNCS:
            continue
        errors.append(
            f"Línea {line_no}: variable desconocida '{ident}' en la expresión."
        )
    # paréntesis balanceados
    if expr.count("(") != expr.count(")"):
        errors.append(f"Línea {line_no}: paréntesis desbalanceados.")
    return errors