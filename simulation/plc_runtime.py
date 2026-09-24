import re


class PLCRuntime:
    """Small, controlled Structured-Text-like runtime for the Cyber Range."""

    def __init__(self, plant):
        self.plant = plant
        self.flags = {"ALARM": False}

    def run(self):
        program = self.plant.plc_program
        if not program.source:
            raise ValueError("No PLC program is loaded.")
        errors = program.validate()
        if errors:
            raise ValueError("; ".join(errors))
        program.running = True
        program.status = "RUNNING"
        program.last_error = ""
        self.plant.add_event(
            "PLC_PROGRAM_RUN", "INFO", "PLC-001",
            f"PLC program MAIN v{program.version} started",
        )

    def stop(self):
        program = self.plant.plc_program
        if program.running:
            program.running = False
            program.status = "STOPPED"
            self.plant.add_event(
                "PLC_PROGRAM_STOP", "INFO", "PLC-001",
                f"PLC program MAIN v{program.version} stopped",
            )

    def reset(self):
        program = self.plant.plc_program
        was_running = program.running
        program.running = False
        program.status = "LOADED" if program.source else "NOT_LOADED"
        program.last_error = ""
        program.execution_count = 0
        self.flags["ALARM"] = False
        if was_running:
            self.plant.add_event(
                "PLC_PROGRAM_RESET", "INFO", "PLC-001",
                "PLC program runtime reset",
            )

    def cycle(self):
        program = self.plant.plc_program
        if not program.running or self.plant.plc.cpu_state != "RUN":
            return

        try:
            actions = self._execute_source(program.source)
            self._apply_actions(actions)
            program.execution_count += 1
        except Exception as exc:
            program.running = False
            program.status = "ERROR"
            program.last_error = str(exc)
            self.plant.add_event(
                "PLC_PROGRAM_ERROR", "CRITICAL", "PLC-001",
                f"PLC runtime stopped: {exc}",
            )

    def _execute_source(self, source):
        lines = source.splitlines()
        actions = []
        active_stack = []
        current_active = True

        for raw in lines:
            line = raw.strip()
            if not line:
                continue
            if re.fullmatch(r"PROGRAM\s+MAIN", line, re.IGNORECASE):
                continue
            if re.fullmatch(r"NETWORK\s+\d+", line, re.IGNORECASE):
                continue

            if_match = re.fullmatch(r"IF\s+(.+)\s+THEN", line, re.IGNORECASE)
            if if_match:
                result = self._evaluate_condition(if_match.group(1).strip())
                active_stack.append(current_active)
                current_active = current_active and result
                continue

            if re.fullmatch(r"END_IF;?", line, re.IGNORECASE):
                if not active_stack:
                    raise ValueError("END_IF without matching IF")
                current_active = active_stack.pop()
                continue

            assignment = re.match(
                r"^([A-Z_][A-Z0-9_]*)\s*:=\s*(.+);$",
                line,
                re.IGNORECASE,
            )
            if assignment and current_active:
                variable = assignment.group(1).upper()
                value = self._evaluate_value(assignment.group(2).strip())
                actions.append((variable, value))

        if active_stack:
            raise ValueError("IF without END_IF")
        return actions

    def _variables(self):
        process = self.plant.process
        return {
            "START": bool(process.production_running),
            "STOP": not bool(process.production_running),
            "TEMPERATURE": float(process.temperature),
            "PRESSURE": float(process.pressure),
            "MOTOR_SPEED": float(process.motor_speed),
            "VALVE_POSITION": float(process.valve_position),
            "PRODUCTION_RATE": float(process.production_rate),
            "ALARM": bool(self.flags["ALARM"]),
        }

    def _evaluate_condition(self, condition):
        variables = self._variables()
        token = condition.strip().upper()
        if token in variables:
            return bool(variables[token])

        match = re.fullmatch(
            r"([A-Z_][A-Z0-9_]*)\s*(>=|<=|==|=|>|<)\s*(-?\d+(?:\.\d+)?)",
            token,
        )
        if not match:
            raise ValueError(f"Unsupported condition: {condition}")

        left_name, operator, raw_right = match.groups()
        if left_name not in variables:
            raise ValueError(f"Unknown variable: {left_name}")
        left = float(variables[left_name])
        right = float(raw_right)
        return {
            ">": left > right,
            "<": left < right,
            ">=": left >= right,
            "<=": left <= right,
            "=": left == right,
            "==": left == right,
        }[operator]

    def _evaluate_value(self, value):
        upper = value.upper()
        if upper == "TRUE":
            return True
        if upper == "FALSE":
            return False
        try:
            return float(value)
        except ValueError:
            variables = self._variables()
            if upper not in variables:
                raise ValueError(f"Unknown value: {value}")
            return variables[upper]

    def _apply_actions(self, actions):
        for variable, value in actions:
            if variable == "MOTOR_SPEED":
                self.plant.apply_program_motor_speed(float(value))
            elif variable == "VALVE_POSITION":
                self.plant.apply_program_valve_position(float(value))
            elif variable == "TEMPERATURE":
                self.plant.apply_program_temperature(float(value))
            elif variable == "PRESSURE":
                self.plant.apply_program_pressure(float(value))
            elif variable == "ALARM":
                new_alarm = bool(value)
                if new_alarm and not self.flags["ALARM"]:
                    self.plant.alarm_manager.trigger(
                        alarm_id="PLC_PROGRAM_ALARM",
                        severity="CRITICAL",
                        source="PLC-001",
                        message=(
                            "PLC program asserted ALARM"
                            f" - Temperature {self.plant.process.temperature:.1f} °C"
                        ),
                    )
                elif not new_alarm and self.flags["ALARM"]:
                    alarm = self.plant.alarm_manager.alarms.get(
                        "PLC_PROGRAM_ALARM"
                    )
                    if alarm and alarm.active:
                        self.plant.alarm_manager.reset(
                            "PLC_PROGRAM_ALARM"
                        )
                self.flags["ALARM"] = new_alarm