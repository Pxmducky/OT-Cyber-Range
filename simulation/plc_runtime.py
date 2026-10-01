"""
plc_runtime.py — Motor de ejecución de Structured Text del OT Cyber Range.

Ejecuta el programa cargado por el alumno DENTRO del backend (un único motor
de simulación) y aplica sus salidas al proceso real de la planta.

Modelo de memoria:
  - PROCESS_OUTPUTS  → escribir en ellas cambia la PRODUCCIÓN REAL
    (motor, válvula, temperatura, presión, alarma).
  - PROCESS_INPUTS   → se leen en vivo desde el proceso cada ciclo.
  - cualquier otra variable declarada en VAR...END_VAR es MEMORIA INTERNA
    del PLC: se evalúa y se recuerda entre ciclos, pero NO toca la planta.

Sandbox: las expresiones se evalúan con un intérprete propio (tokenizer +
descenso recursivo). NUNCA se usa eval() ni se ejecuta código del host.
"""

import re

PROCESS_OUTPUTS = {
    "MOTOR_SPEED", "VALVE_POSITION", "TEMPERATURE", "PRESSURE", "ALARM",
}


class PLCRuntime:
    def __init__(self, plant):
        self.plant = plant
        self.flags = {"ALARM": False}
        self.memory = {}          # variables internas declaradas por el alumno
        self._compiled = None     # lista de sentencias (árbol plano) ya parseada
        self._compiled_src = None

    # ------------------------------------------------------------------ RUN
    def run(self):
        program = self.plant.plc_program
        if not program.source:
            raise ValueError("No hay programa PLC cargado.")
        errors = program.validate()
        if errors:
            raise ValueError("; ".join(errors))

        self._seed_memory(program.source)
        self._compiled = self._compile(program.source)
        self._compiled_src = program.source

        program.running = True
        program.status = "RUNNING"
        program.last_error = ""
        self.plant.add_event(
            "PLC_PROGRAM_RUN", "INFO", "PLC-001",
            f"PLC program {program.name} v{program.version} started",
        )

    def stop(self):
        program = self.plant.plc_program
        if program.running:
            program.running = False
            program.status = "STOPPED"
            self.plant.add_event(
                "PLC_PROGRAM_STOP", "INFO", "PLC-001",
                f"PLC program {program.name} v{program.version} stopped",
            )

    def reset(self):
        program = self.plant.plc_program
        was_running = program.running
        program.running = False
        program.status = "LOADED" if program.source else "NOT_LOADED"
        program.last_error = ""
        program.execution_count = 0
        self.flags["ALARM"] = False
        self.memory = {}
        self._compiled = None
        self._compiled_src = None
        if was_running:
            self.plant.add_event(
                "PLC_PROGRAM_RESET", "INFO", "PLC-001",
                "PLC program runtime reset",
            )

    # ---------------------------------------------------------------- CYCLE
    def cycle(self):
        program = self.plant.plc_program
        if not program.running or self.plant.plc.cpu_state != "RUN":
            return

        # Recompilar si el código cambió sin pasar por run() (p.e. inyección).
        if self._compiled is None or self._compiled_src != program.source:
            try:
                self._seed_memory(program.source)
                self._compiled = self._compile(program.source)
                self._compiled_src = program.source
            except Exception as exc:
                self._fail(program, exc)
                return

        try:
            scope = self._build_scope()
            self._exec_block(self._compiled, scope)
            self._apply_scope(scope)
            program.execution_count += 1
        except Exception as exc:
            self._fail(program, exc)

    def _fail(self, program, exc):
        program.running = False
        program.status = "ERROR"
        program.last_error = str(exc)
        self.plant.add_event(
            "PLC_PROGRAM_ERROR", "CRITICAL", "PLC-001",
            f"PLC runtime detenido: {exc}",
        )

    # ------------------------------------------------- memoria / variables
    def _seed_memory(self, source):
        """Inicializa variables internas a partir de las declaraciones VAR."""
        self.memory = {}
        in_var = False
        for raw in source.splitlines():
            line = raw.strip()
            up = line.upper()
            if re.fullmatch(r"VAR(_INPUT|_OUTPUT)?", up):
                in_var = True
                continue
            if up == "END_VAR":
                in_var = False
                continue
            if in_var:
                m = re.match(
                    r"^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z]+)\s*(:=\s*([^;]+))?;?",
                    line,
                )
                if m:
                    name = m.group(1).upper()
                    typ = m.group(2).upper()
                    init = m.group(4)
                    if init is not None:
                        self.memory[name] = self._literal(init.strip(), typ)
                    else:
                        self.memory[name] = False if typ == "BOOL" else 0.0

    @staticmethod
    def _literal(text, typ="REAL"):
        t = text.strip().upper()
        if t == "TRUE":
            return True
        if t == "FALSE":
            return False
        try:
            v = float(text)
            return v
        except ValueError:
            return False if typ == "BOOL" else 0.0

    def _process_vars(self):
        p = self.plant.process
        return {
            "START": bool(p.production_running),
            "STOP": not bool(p.production_running),
            "TEMPERATURE": float(p.temperature),
            "PRESSURE": float(p.pressure),
            "MOTOR_SPEED": float(p.motor_speed),
            "VALVE_POSITION": float(p.valve_position),
            "PRODUCTION_RATE": float(p.production_rate),
            "ALARM": bool(self.flags["ALARM"]),
        }

    def _build_scope(self):
        scope = dict(self.memory)       # internas primero
        scope.update(self._process_vars())  # proceso en vivo (puede sobreescribir)
        return scope

    def _apply_scope(self, scope):
        proc = self._process_vars()
        for name, value in scope.items():
            if name in PROCESS_OUTPUTS:
                if name == "ALARM":
                    if bool(value) != bool(self.flags["ALARM"]):
                        self._write_output(name, value, proc.get(name))
                else:
                    # solo escribir si el programa cambió realmente la salida
                    if abs(float(value) - float(proc.get(name, value))) > 1e-6:
                        self._write_output(name, value, proc.get(name))
            else:
                self.memory[name] = value

    def _write_output(self, name, value, previous):
        if name == "MOTOR_SPEED":
            self.plant.apply_program_motor_speed(float(value))
        elif name == "VALVE_POSITION":
            self.plant.apply_program_valve_position(float(value))
        elif name == "TEMPERATURE":
            self.plant.apply_program_temperature(float(value))
        elif name == "PRESSURE":
            self.plant.apply_program_pressure(float(value))
        elif name == "ALARM":
            self._handle_alarm(bool(value))

    def _handle_alarm(self, new_alarm):
        if new_alarm and not self.flags["ALARM"]:
            self.plant.alarm_manager.trigger(
                alarm_id="PLC_PROGRAM_ALARM",
                severity="CRITICAL",
                source="PLC-001",
                message=(
                    "El programa PLC activó ALARM"
                    f" — Temperatura {self.plant.process.temperature:.1f} °C"
                ),
            )
        elif not new_alarm and self.flags["ALARM"]:
            alarm = self.plant.alarm_manager.alarms.get("PLC_PROGRAM_ALARM")
            if alarm and alarm.active:
                self.plant.alarm_manager.reset("PLC_PROGRAM_ALARM")
        self.flags["ALARM"] = new_alarm

    # ============================================================= COMPILER
    # Produce una lista plana de sentencias:
    #   ("assign", NAME, tokens)
    #   ("if", [ (cond_tokens_or_None, [sentencias...]), ... ])   # ELSE = None
    def _compile(self, source):
        lines = []
        for raw in source.splitlines():
            line = raw.strip()
            if not line or line.startswith("//") or line.startswith("(*"):
                continue
            lines.append(line)
        pos = [0]
        block = self._parse_block(lines, pos, stop={"END_IF", "ELSE", "ELSIF"})
        return block

    def _parse_block(self, lines, pos, stop):
        stmts = []
        while pos[0] < len(lines):
            line = lines[pos[0]]
            up = line.upper()

            # fin de bloque: lo consume el llamador (IF/ELSIF/ELSE/END_IF)
            if re.fullmatch(r"END_IF;?", line, re.I) or up == "ELSE" \
                    or re.match(r"^ELSIF\b", line, re.I):
                break

            # saltar cuerpo de declaración VAR (ya lo tomó _seed_memory)
            if re.fullmatch(r"VAR(_INPUT|_OUTPUT)?", up):
                pos[0] += 1
                while pos[0] < len(lines) and lines[pos[0]].upper() != "END_VAR":
                    pos[0] += 1
                pos[0] += 1   # consumir END_VAR
                continue

            # cabeceras / separadores ignorables
            if re.fullmatch(r"PROGRAM\s+[A-Za-z_][A-Za-z0-9_]*", line, re.I) \
                    or up == "END_PROGRAM" \
                    or re.fullmatch(r"NETWORK\s+\d+", line, re.I) \
                    or up == "END_VAR":
                pos[0] += 1
                continue

            m = re.match(r"^(IF|ELSIF)\b(.*)$", line, re.I)
            if m and m.group(1).upper() == "IF":
                pos[0] += 1
                branches = []
                cond = re.sub(r"\bTHEN\b.*$", "", m.group(2), flags=re.I).strip()
                body = self._parse_block(lines, pos, stop={"END_IF", "ELSE", "ELSIF"})
                branches.append((self._tokenize(cond), body))
                # ELSIF*
                while pos[0] < len(lines) and re.match(r"^ELSIF\b", lines[pos[0]], re.I):
                    em = re.match(r"^ELSIF\b(.*)$", lines[pos[0]], re.I)
                    pos[0] += 1
                    econd = re.sub(r"\bTHEN\b.*$", "", em.group(1), flags=re.I).strip()
                    ebody = self._parse_block(lines, pos, stop={"END_IF", "ELSE", "ELSIF"})
                    branches.append((self._tokenize(econd), ebody))
                # ELSE
                if pos[0] < len(lines) and lines[pos[0]].upper() == "ELSE":
                    pos[0] += 1
                    ebody = self._parse_block(lines, pos, stop={"END_IF", "ELSE", "ELSIF"})
                    branches.append((None, ebody))
                # END_IF
                if pos[0] < len(lines) and re.fullmatch(r"END_IF;?", lines[pos[0]], re.I):
                    pos[0] += 1
                else:
                    raise ValueError("IF sin END_IF")
                stmts.append(("if", branches))
                continue

            asg = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*(.+?);?$", line)
            if asg:
                stmts.append(("assign", asg.group(1).upper(),
                              self._tokenize(asg.group(2).strip())))
                pos[0] += 1
                continue

            # línea no reconocida dentro de un bloque → fin del bloque
            break
        return stmts

    def _exec_block(self, stmts, scope):
        for st in stmts:
            if st[0] == "assign":
                scope[st[1]] = self._eval(st[2], scope)
            elif st[0] == "if":
                for cond, body in st[1]:
                    if cond is None or self._truth(self._eval(cond, scope)):
                        self._exec_block(body, scope)
                        break

    # ============================================================ EVALUATOR
    _TOKEN_RE = re.compile(
        r"\s*(>=|<=|<>|:=|[-+*/(),]|>|<|=|\d+\.?\d*|[A-Za-z_][A-Za-z0-9_]*)"
    )

    _FUNCS = {"LIMIT", "MIN", "MAX", "ABS"}

    def _tokenize(self, expr):
        tokens, i = [], 0
        while i < len(expr):
            m = self._TOKEN_RE.match(expr, i)
            if not m:
                if expr[i].isspace():
                    i += 1
                    continue
                raise ValueError(f"Símbolo inválido cerca de '{expr[i:]}'")
            tokens.append(m.group(1))
            i = m.end()
        return tokens

    def _eval(self, tokens, scope):
        self._tk = tokens
        self._i = 0
        val = self._parse_or(scope)
        return val

    def _peek(self):
        return self._tk[self._i] if self._i < len(self._tk) else None

    def _next(self):
        t = self._tk[self._i]
        self._i += 1
        return t

    def _parse_or(self, scope):
        v = self._parse_and(scope)
        while self._peek() and self._peek().upper() == "OR":
            self._next()
            r = self._parse_and(scope)
            v = self._truth(v) or self._truth(r)
        return v

    def _parse_and(self, scope):
        v = self._parse_not(scope)
        while self._peek() and self._peek().upper() == "AND":
            self._next()
            r = self._parse_not(scope)
            v = self._truth(v) and self._truth(r)
        return v

    def _parse_not(self, scope):
        if self._peek() and self._peek().upper() == "NOT":
            self._next()
            return not self._truth(self._parse_not(scope))
        return self._parse_cmp(scope)

    def _parse_cmp(self, scope):
        v = self._parse_add(scope)
        if self._peek() in (">", "<", ">=", "<=", "=", "<>"):
            op = self._next()
            r = self._parse_add(scope)
            a, b = float(v), float(r)
            return {
                ">": a > b, "<": a < b, ">=": a >= b,
                "<=": a <= b, "=": a == b, "<>": a != b,
            }[op]
        return v

    def _parse_add(self, scope):
        v = self._parse_mul(scope)
        while self._peek() in ("+", "-"):
            op = self._next()
            r = self._parse_mul(scope)
            v = float(v) + float(r) if op == "+" else float(v) - float(r)
        return v

    def _parse_mul(self, scope):
        v = self._parse_atom(scope)
        while self._peek() in ("*", "/") or (self._peek() and self._peek().upper() == "MOD"):
            op = self._next().upper()
            r = self._parse_atom(scope)
            if op == "*":
                v = float(v) * float(r)
            elif op == "/":
                v = float(v) / float(r) if float(r) != 0 else 0.0
            else:
                v = float(v) % float(r) if float(r) != 0 else 0.0
        return v

    def _parse_atom(self, scope):
        t = self._peek()
        if t is None:
            raise ValueError("Expresión incompleta")
        if t == "(":
            self._next()
            v = self._parse_or(scope)
            if self._peek() != ")":
                raise ValueError("Falta ')'")
            self._next()
            return v
        if t == "-":
            self._next()
            return -float(self._parse_atom(scope))
        self._next()
        up = t.upper()
        if up in self._FUNCS and self._peek() == "(":
            self._next()
            args = [self._parse_or(scope)]
            while self._peek() == ",":
                self._next()
                args.append(self._parse_or(scope))
            if self._peek() != ")":
                raise ValueError(f"Falta ')' en {up}()")
            self._next()
            return self._call_func(up, args)
        if up == "TRUE":
            return True
        if up == "FALSE":
            return False
        if re.fullmatch(r"\d+\.?\d*", t):
            return float(t)
        if up in scope:
            return scope[up]
        raise ValueError(f"Variable desconocida: {t}")

    @staticmethod
    def _call_func(name, args):
        a = [float(x) for x in args]
        if name == "ABS":
            return abs(a[0])
        if name == "MIN":
            return min(a)
        if name == "MAX":
            return max(a)
        if name == "LIMIT":          # LIMIT(min, x, max)
            lo, x, hi = a[0], a[1], a[2]
            return max(lo, min(x, hi))
        raise ValueError(f"Función desconocida: {name}")

    @staticmethod
    def _truth(v):
        if isinstance(v, bool):
            return v
        return float(v) != 0.0