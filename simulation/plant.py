from simulation.equipment import (
    Equipment,
    EquipmentStatus,
)

# ---------------------------------------------------------------------------
# PROGRAMA PLC LEGÍTIMO DE REFERENCIA
# Acciones aceptables: control térmico, alivio de presión, alarmas de proceso
# Rangos seguros: Motor 500-1450 RPM | Válvula 10-90 % | Temp 60-80 °C | Presión 3.0-4.5 bar
# ---------------------------------------------------------------------------
LEGITIMATE_PROGRAM = """\
PROGRAM MAIN
NETWORK 1
IF TEMPERATURE >= 75 THEN
  MOTOR_SPEED := 1200;
END_IF
NETWORK 2
IF TEMPERATURE < 65 THEN
  MOTOR_SPEED := 1450;
END_IF
NETWORK 3
IF PRESSURE > 4.2 THEN
  VALVE_POSITION := 70;
END_IF
NETWORK 4
IF PRESSURE < 3.2 THEN
  VALVE_POSITION := 35;
END_IF
NETWORK 5
IF TEMPERATURE >= 78 THEN
  ALARM := TRUE;
END_IF
NETWORK 6
IF TEMPERATURE < 75 THEN
  ALARM := FALSE;
END_IF"""

# ---------------------------------------------------------------------------
# PROGRAMA PLC MALICIOSO — LO QUE UN ATACANTE INYECTA
# Paro de emergencia + válvula totalmente abierta + supresión de alarmas
# ---------------------------------------------------------------------------
MALICIOUS_PROGRAM = """\
PROGRAM MAIN
NETWORK 1
IF START THEN
  MOTOR_SPEED := 0;
END_IF
NETWORK 2
IF START THEN
  VALVE_POSITION := 100;
END_IF
NETWORK 3
IF ALARM THEN
  ALARM := FALSE;
END_IF"""

from simulation.plc import PLC
from simulation.process import ProcessState
from simulation.asset_models import AssetProcess
from simulation.events import OTEvent
from simulation.plc_program import PLCProgram
from simulation.plc_runtime import PLCRuntime
from simulation.alarm_manager import AlarmManager


class Plant:

    def __init__(self):

        # =====================================================
        # PROCESS
        # =====================================================

        self.process = ProcessState()

        # =====================================================
        # PLC
        # =====================================================

        self.plc = PLC(
            asset_id="PLC-001",
            name="Siemens S7-1500",
            manufacturer="Siemens",
            model="S7-1500",
            ip_address="172.16.100.10",
            vlan=440,
            network="OT-PLC",
        )

        # =====================================================
        # PLC PROGRAM / RUNTIME
        # =====================================================

        self.plc_program = PLCProgram()
        self.plc_runtime = PLCRuntime(self)

        # =====================================================
        # OTHER OT EQUIPMENT
        # =====================================================

        self.equipment = [

            self.plc,

            Equipment(
                asset_id="HMI-001",
                name="Siemens HMI KP400 Comfort",
                equipment_type="HMI",
                manufacturer="Siemens",
                model="KP400 Comfort",
                ip_address="172.16.102.10",
                vlan=902,
                network="OT-HMI",
                properties={
                    "protocol": "S7 / Ethernet",
                    "role": "Operator Interface",
                },
            ),

            Equipment(
                asset_id="SCADA-001",
                name="SCADA Server",
                equipment_type="SCADA",
                manufacturer="Siemens",
                model="WinCC",
                ip_address="172.16.104.10",
                vlan=904,
                network="OT-SERVERS",
                properties={
                    "protocol": "OPC UA",
                    "role": "Supervisory Control",
                },
            ),

            Equipment(
                asset_id="GW-001",
                name="eWON Gateway",
                equipment_type="GATEWAY",
                manufacturer="HMS",
                model="eWON Cosy+",
                ip_address="172.16.103.10",
                vlan=903,
                network="OT-GATEWAY",
                properties={
                    "role": "Remote Access",
                    "protocol": "VPN",
                },
            ),

            Equipment(
                asset_id="ENG-001",
                name="Engineering Workstation",
                equipment_type="ENGINEERING",
                manufacturer="Siemens",
                model="TIA Portal Workstation",
                ip_address="172.16.105.10",
                vlan=901,
                network="OT-ENGINEERING",
                properties={
                    "software": "TIA Portal",
                    "role": "PLC Engineering",
                },
            ),

            Equipment(
                asset_id="CNC-001",
                name="Machining Cell",
                equipment_type="CNC",
                manufacturer="Industrial",
                model="CNC Manufacturing Cell",
                ip_address="172.16.106.10",
                vlan=800,
                network="OT-MACHINES",
                properties={
                    "role": "Production Machine",
                },
            ),

            Equipment(
                asset_id="M-001",
                name="Production Motor",
                equipment_type="MOTOR",
                manufacturer="Siemens",
                model="SIMOTICS",
                ip_address="172.16.100.20",
                vlan=440,
                network="OT-PLC",
                properties={
                    "nominal_speed": 1450,
                    "unit": "RPM",
                },
            ),

            Equipment(
                asset_id="TT-001",
                name="Temperature Transmitter",
                equipment_type="SENSOR",
                manufacturer="Siemens",
                model="SITRANS",
                ip_address="172.16.100.30",
                vlan=440,
                network="OT-PLC",
                properties={
                    "measurement": "Temperature",
                    "unit": "°C",
                },
            ),

            Equipment(
                asset_id="PT-001",
                name="Pressure Transmitter",
                equipment_type="SENSOR",
                manufacturer="Siemens",
                model="SITRANS",
                ip_address="172.16.100.31",
                vlan=440,
                network="OT-PLC",
                properties={
                    "measurement": "Pressure",
                    "unit": "bar",
                },
            ),

            Equipment(
                asset_id="V-001",
                name="Process Control Valve",
                equipment_type="VALVE",
                manufacturer="Siemens",
                model="Industrial Control Valve",
                ip_address="172.16.100.40",
                vlan=440,
                network="OT-PLC",
                properties={
                    "control": "Position",
                    "unit": "%",
                },
            ),
        ]

        # =====================================================
        # EVENTS
        # =====================================================

        self.events = []

        self.alarm_manager = AlarmManager(
            self.add_event
        )

        # Mapa de actividad por activo (para colorear topología + SIEM).
        # asset_id -> {"state","event","protocol","target","ttl"}
        self.activity = {}

        # Proceso individual por activo (poblado por load_topology desde Excel).
        self.assets_runtime = {}   # asset_id -> AssetProcess
        self.asset_conns    = []   # [{sourceId, targetId, protocol, port}]

        self.add_event(
            event_type="SYSTEM_START",
            severity="INFO",
            source="OT-CYBER-RANGE",
            message="OT plant simulation initialized",
        )

    # =========================================================
    # EVENTS
    # =========================================================

    def add_event(
        self,
        event_type: str,
        severity: str,
        source: str,
        message: str,
    ):

        event = OTEvent(
            event_type=event_type,
            severity=severity,
            source=source,
            message=message,
        )

        self.events.append(event)

        # Keep event history under control
        if len(self.events) > 200:

            self.events = self.events[-200:]

    # =========================================================
    # PROCESS UPDATE
    # =========================================================

    def update(self):

        # Execute the user-loaded PLC program before the process advances.
        self.plc_runtime.cycle()

        self.process.update()

        # Synchronize PLC registers with process
        self.plc.registers["temperature"] = (
            self.process.temperature
        )

        self.plc.registers["pressure"] = (
            self.process.pressure
        )

        self.plc.registers["motor_speed"] = (
            self.process.motor_speed
        )

        self.plc.registers["valve_position"] = (
            self.process.valve_position
        )

        # =====================================================
        # UPDATE MOTOR STATUS
        # =====================================================

        motor = self.get_equipment("M-001")

        if motor:

            if self.process.motor_speed <= 0:

                motor.set_status(
                    EquipmentStatus.OFFLINE
                )

            elif self.process.motor_speed < 500:

                motor.set_status(
                    EquipmentStatus.WARNING
                )

            else:

                motor.set_status(
                    EquipmentStatus.ONLINE
                )

        # =====================================================
        # UPDATE CNC STATUS
        # =====================================================

        cnc = self.get_equipment("CNC-001")

        if cnc:

            if not self.process.production_running:

                cnc.set_status(
                    EquipmentStatus.WARNING
                )

            else:

                cnc.set_status(
                    EquipmentStatus.ONLINE
                )

        # =====================================================
        # UPDATE VALVE STATUS
        # =====================================================

        valve = self.get_equipment("V-001")

        if valve:

            if (
                self.process.valve_position < 10
                or self.process.valve_position > 90
            ):

                valve.set_status(
                    EquipmentStatus.WARNING
                )

            else:

                valve.set_status(
                    EquipmentStatus.ONLINE
                )

        # Avanzar el proceso individual de cada activo.
        import random as _rnd
        _r = lambda a, b: _rnd.uniform(a, b)
        for _ap in self.assets_runtime.values():
            _ap.tick(_r)

        # Desvanecer la actividad reciente de los activos.
        self._decay_activity()

    # =========================================================
    # ACTIVITY BUS — acciones genéricas de cualquier equipo
    # =========================================================

    ACTIVITY_SEVERITY = {
        "normal": "INFO", "command": "INFO", "config": "INFO",
        "scan": "WARNING", "warning": "WARNING", "blocked": "HIGH",
        "attack": "CRITICAL", "offline": "WARNING",
    }

    def _set_activity(self, asset_id, state, event_type, protocol=None, target=None, ttl=4):
        if not asset_id:
            return
        self.activity[asset_id] = {
            "state": state, "event": event_type,
            "protocol": protocol, "target": target, "ttl": ttl,
        }
        if target:
            self.activity[target] = {
                "state": state, "event": event_type,
                "protocol": protocol, "target": None, "ttl": ttl,
            }

    def _decay_activity(self):
        for aid in list(self.activity):
            self.activity[aid]["ttl"] -= 1
            if self.activity[aid]["ttl"] <= 0:
                del self.activity[aid]

    def load_topology(self, assets=None, connections=None, variables=None):
        """Construye un proceso por activo a partir del inventario del Excel."""
        assets = assets or []
        self.assets_runtime = {}
        for a in assets:
            aid = str(a.get("id", "")).strip()
            if not aid:
                continue
            self.assets_runtime[aid] = AssetProcess(a, variables or [])
        self.asset_conns = connections or []
        self.add_event(
            "TOPOLOGY_LOADED", "INFO", "OT-CYBER-RANGE",
            f"Inventario cargado: {len(self.assets_runtime)} activos, "
            f"{len(self.asset_conns)} conexiones",
        )
        return self.get_state()

    def _neighbors(self, asset_id):
        out = set()
        for c in self.asset_conns:
            if c.get("sourceId") == asset_id and c.get("targetId"):
                out.add(c["targetId"])
            elif c.get("targetId") == asset_id and c.get("sourceId"):
                out.add(c["sourceId"])
        return out

    def _downstream(self, asset_id, max_depth=6):
        """Activos alcanzables siguiendo las conexiones dirigidas source->target."""
        seen, frontier = set(), [asset_id]
        for _ in range(max_depth):
            nxt = []
            for a in frontier:
                for c in self.asset_conns:
                    if c.get("sourceId") == a and c.get("targetId") and c["targetId"] not in seen:
                        seen.add(c["targetId"]); nxt.append(c["targetId"])
            if not nxt:
                break
            frontier = nxt
        return seen

    _HEALTH_ORDER = {"normal": 0, "warning": 1, "critical": 2}

    def _compute_health(self):
        """Salud por activo + propagación aguas abajo (criticidad del proceso)."""
        order = self._HEALTH_ORDER
        health = {aid: ap.health() for aid, ap in self.assets_runtime.items()}

        adj = {}
        for c in self.asset_conns:
            s_, t_ = c.get("sourceId"), c.get("targetId")
            if s_ and t_:
                adj.setdefault(s_, []).append(t_)

        for _ in range(6):  # iterar hasta estabilizar
            changed = False
            for src, targets in adj.items():
                sh = health.get(src, "normal")
                if order.get(sh, 0) < 1:
                    continue
                src_ap = self.assets_runtime.get(src)
                for t in targets:
                    # la pérdida de control de un PLC crítico vuelve crítico al equipo
                    if src_ap is not None and src_ap.category in ("plc", "scada") and sh == "critical":
                        new = "critical"
                    else:
                        new = "warning"
                    if order.get(new, 0) > order.get(health.get(t, "normal"), 0):
                        health[t] = new
                        changed = True
            if not changed:
                break
        return health

    def apply_equipment_action(
        self, asset_id, asset_type="", action="", value=None,
        target_id=None, protocol=None,
    ):
        """
        Punto único de entrada para los botones de CUALQUIER equipo.
        Genera un evento SIEM, marca actividad (para colorear) y aplica el
        impacto real en el proceso cuando la lógica OT lo permite.
        """
        # --- Ruta por-activo: si el activo tiene proceso propio, lo mutamos ---
        ap = self.assets_runtime.get(asset_id)
        if ap is not None:
            event_type, severity, message = ap.apply_action(action, value)
            self._set_activity(asset_id, ap.activity, event_type, protocol, target_id)

            # Cadena causal OT: si un PLC pasa a STOP, se detienen los
            # equipos que controla aguas abajo (motores/bombas) y se abren
            # sus válvulas a seguro no — se cierran según el proceso.
            if ap.category == "plc" and ap.state.get("cpu_state") != "RUN":
                for t in self._downstream(asset_id):
                    tap = self.assets_runtime.get(t)
                    if tap and tap.category in ("motor", "pump"):
                        tap.state["running"] = False
                        tap.state["speed" if tap.category == "motor" else "flow"] = 0.0
                        self._set_activity(t, "warning", "PLC_STOP_CASCADE", ttl=4)
                        self.add_event(
                            "PLC_STOP_CASCADE", "HIGH", t,
                            f"{t}: detenido por paro del controlador {asset_id}",
                        )

            # Propagación de actividad a vecinos ante paro/falla puntual.
            if ap.activity == "warning":
                for nb in self._neighbors(asset_id):
                    nb_ap = self.assets_runtime.get(nb)
                    if nb_ap and nb_ap.category in ("motor", "pump", "valve", "plc"):
                        self._set_activity(nb, "warning", "DOWNSTREAM_IMPACT", ttl=3)

            self.add_event(event_type, severity, asset_id, message)
            return self.get_state()

        t = (asset_type or "").upper()
        a = (action or "").upper()
        state = "command"          # color por defecto
        event_type = "EQUIPMENT_ACTION"
        message = f"{asset_id}: acción {action}"
        severity = None

        # ---- DRIVE / MOTOR ----
        if "MOTOR" in t or "DRIVE" in t or "VFD" in t:
            if a in ("START", "RUN", "MARCHA"):
                self.process.resume()
                self.change_motor_speed(1450.0)
                event_type, message = "MOTOR_START", f"{asset_id}: motor en MARCHA (1450 RPM)"
            elif a in ("STOP", "PARO", "PARAR"):
                self.change_motor_speed(0.0)
                state, event_type, message = "warning", "MOTOR_STOP", f"{asset_id}: motor en PARO"
            elif a in ("SPEED", "SETPOINT") and value is not None:
                self.change_motor_speed(float(value))
                event_type, message = "MOTOR_SPEED", f"{asset_id}: velocidad -> {float(value):.0f} RPM"

        # ---- VALVE ----
        elif "VALVE" in t or "VALV" in t:
            if a in ("OPEN", "ABRIR"):
                self.change_valve_position(100.0)
                event_type, message = "VALVE_OPEN", f"{asset_id}: válvula ABIERTA (100%)"
            elif a in ("CLOSE", "CERRAR"):
                self.change_valve_position(0.0)
                state, event_type, message = "warning", "VALVE_CLOSE", f"{asset_id}: válvula CERRADA (0%)"
            elif a in ("POSITION", "SETPOINT") and value is not None:
                self.change_valve_position(float(value))
                event_type, message = "VALVE_POSITION", f"{asset_id}: posición -> {float(value):.0f}%"

        # ---- SENSOR ----
        elif "SENSOR" in t or "TRANSMIT" in t or t in ("TT", "PT", "FT", "LT"):
            if a in ("FORCE", "SET") and value is not None:
                target_var = "pressure" if ("PRES" in t or "PT" in t) else "temperature"
                self.set_process_values(**{target_var: float(value)})
                state, event_type = "warning", "SENSOR_FORCE"
                message = f"{asset_id}: valor forzado -> {float(value)} ({target_var})"
            elif a in ("FAULT", "FALLA"):
                state, event_type, message = "warning", "SENSOR_FAULT", f"{asset_id}: sensor en FALLA"
                self.alarm_manager.trigger(f"{asset_id}_FAULT", "WARNING", asset_id,
                                           f"Sensor {asset_id} reporta falla")

        # ---- NETWORK / SWITCH / FIREWALL ----
        elif "FIREWALL" in t or "SWITCH" in t or "GATEWAY" in t or "EWON" in t or "MGUARD" in t:
            if a in ("DENY", "BLOCK", "DESACTIVAR"):
                state, event_type = "blocked", "FW_RULE_DENY"
                message = f"{asset_id}: regla DENY {protocol or ''} hacia {target_id or 'N/D'}"
            elif a in ("PERMIT", "ALLOW", "ACTIVAR"):
                state, event_type = "config", "FW_RULE_PERMIT"
                message = f"{asset_id}: regla PERMIT {protocol or ''} hacia {target_id or 'N/D'}"
            else:
                state, event_type = "config", "NET_CONFIG"
                message = f"{asset_id}: cambio de configuración de red"

        # ---- SERVER / SCADA / MES / HISTORIAN ----
        elif "SCADA" in t or "MES" in t or "HIST" in t or "SERVER" in t:
            if a in ("RESTART", "REINICIAR"):
                state, event_type, message = "config", "SERVICE_RESTART", f"{asset_id}: servicio reiniciado"
            elif a in ("STOP",):
                state, event_type, message = "warning", "SERVICE_STOP", f"{asset_id}: servicio detenido"

        # ---- WORKSTATION / ENGINEERING ----
        elif "WORK" in t or "ENG" in t or "PC" in t:
            tool = (str(value or action)).upper()
            if "NMAP" in tool or "WIRESHARK" in tool or "SCAN" in tool:
                state, event_type = "scan", "ENG_RECON"
                message = f"{asset_id}: herramienta de reconocimiento '{value or action}'"
            else:
                event_type, message = "ENG_TOOL", f"{asset_id}: lanzó '{value or action}'"

        # severidad final
        severity = self.ACTIVITY_SEVERITY.get(state, "INFO")

        # marcar actividad (colorea el activo y, si aplica, la conexión destino)
        self._set_activity(asset_id, state, event_type, protocol, target_id)

        # cambiar estado del equipo conocido (si existe en el backend)
        eq = self.get_equipment(asset_id)
        if eq and state in ("warning",):
            try:
                eq.set_status(EquipmentStatus.WARNING)
            except Exception:
                pass

        # evento SIEM
        self.add_event(event_type, severity, asset_id, message)
        return self.get_state()

    # =========================================================
    # EQUIPMENT LOOKUP
    # =========================================================

    def get_equipment(
        self,
        asset_id: str,
    ):

        for equipment in self.equipment:

            if equipment.asset_id == asset_id:

                return equipment

        return None

    # =========================================================
    # MOTOR CONTROL
    # =========================================================

    def change_motor_speed(
        self,
        speed: float,
    ):

        speed = max(
            0,
            min(2000, float(speed)),
        )

        old_speed = self.process.motor_speed

        self.process.change_motor_speed(
            speed
        )

        self.plc.write_register(
            "motor_speed",
            speed,
        )

        # =====================================================
        # EVENT
        # =====================================================

        if speed < 500:

            self.add_event(
                event_type="MOTOR_ANOMALY",
                severity="HIGH",
                source="M-001",
                message=(
                    f"Motor speed reduced from "
                    f"{old_speed:.0f} RPM to "
                    f"{speed:.0f} RPM"
                ),
            )

        else:

            self.add_event(
                event_type="MOTOR_SPEED_CHANGE",
                severity="INFO",
                source="M-001",
                message=(
                    f"Motor speed changed to "
                    f"{speed:.0f} RPM"
                ),
            )

    # =========================================================
    # VALVE CONTROL
    # =========================================================

    def change_valve_position(
        self,
        position: float,
    ):

        position = max(
            0,
            min(100, float(position)),
        )

        old_position = (
            self.process.valve_position
        )

        self.process.change_valve_position(
            position
        )

        self.plc.write_register(
            "valve_position",
            position,
        )

        # =====================================================
        # EVENT
        # =====================================================

        if (
            position < 10
            or position > 90
        ):

            self.add_event(
                event_type="VALVE_ALARM",
                severity="HIGH",
                source="V-001",
                message=(
                    f"Valve position changed from "
                    f"{old_position:.0f}% to "
                    f"{position:.0f}% - "
                    f"outside normal operating range"
                ),
            )

        else:

            self.add_event(
                event_type="VALVE_POSITION_CHANGE",
                severity="INFO",
                source="V-001",
                message=(
                    f"Valve position changed to "
                    f"{position:.0f}%"
                ),
            )

    # =========================================================
    # STOP PRODUCTION
    # =========================================================

    def stop_production(self):

        self.process.stop()

        self.plc.stop()

        self.add_event(
            event_type="PRODUCTION_STOP",
            severity="CRITICAL",
            source="PLC-001",
            message=(
                "Production line stopped by PLC command"
            ),
        )

    # =========================================================
    # RESUME PRODUCTION
    # =========================================================

    def resume_production(self):

        self.process.resume()

        self.plc.run()

        self.add_event(
            event_type="PRODUCTION_RESUME",
            severity="INFO",
            source="PLC-001",
            message=(
                "Production line resumed"
            ),
        )

    # =========================================================
    # PLC STOP
    # =========================================================

    def stop_plc(self):

        self.plc.stop()

        self.process.stop()

        self.add_event(
            event_type="PLC_STOP",
            severity="CRITICAL",
            source="PLC-001",
            message=(
                "PLC CPU changed to STOP state"
            ),
        )

    # =========================================================
    # PLC RUN
    # =========================================================

    def run_plc(self):

        self.plc.run()

        self.process.resume()

        self.add_event(
            event_type="PLC_RUN",
            severity="INFO",
            source="PLC-001",
            message=(
                "PLC CPU returned to RUN state"
            ),
        )

    # =========================================================
    # PLC REGISTER WRITE
    # =========================================================

    def write_plc_register(
        self,
        register: str,
        value: float,
    ):

        old_value = self.plc.read_register(
            register
        )

        self.plc.write_register(
            register,
            value,
        )

        # Synchronize with process

        if register == "motor_speed":

            self.process.change_motor_speed(
                float(value)
            )

        elif register == "valve_position":

            self.process.change_valve_position(
                float(value)
            )

        elif register == "temperature":

            self.process.temperature = float(
                value
            )

        elif register == "pressure":

            self.process.pressure = float(
                value
            )

        self.add_event(
            event_type="PLC_REGISTER_WRITE",
            severity="WARNING",
            source="PLC-001",
            message=(
                f"Register {register} changed "
                f"from {old_value} to {value}"
            ),
        )

    # =========================================================
    # PLC PROGRAM CONTROL
    # =========================================================

    def validate_plc_program(self, source: str):
        from simulation.plc_validator import validate_program
        return validate_program(source)

    def load_plc_program(self, source: str):
        errors = self.plc_program.load(source)

        if errors:
            self.add_event(
                event_type="PLC_PROGRAM_VALIDATION_FAILED",
                severity="HIGH",
                source="PLC-001",
                message="PLC program download rejected: " + "; ".join(errors),
            )
            return errors

        self.add_event(
            event_type="PLC_PROGRAM_DOWNLOAD",
            severity="INFO",
            source="PLC-001",
            message=(
                f"PLC program MAIN v{self.plc_program.version} "
                "downloaded to PLC memory"
            ),
        )
        return []

    def run_plc_program(self):
        self.plc_runtime.run()
        return self.plc_program.to_dict()

    def stop_plc_program(self):
        self.plc_runtime.stop()
        return self.plc_program.to_dict()

    def reset_plc_program(self):
        self.plc_runtime.reset()
        self.alarm_manager.reset_all()
        return self.plc_program.to_dict()

    def get_plc_program(self):
        return self.plc_program.to_dict()

    # =========================================================
    # ALARM CONTROL
    # =========================================================

    def get_alarms(self):
        return self.alarm_manager.get_state()

    def acknowledge_alarm(self, alarm_id: str):
        return self.alarm_manager.acknowledge(alarm_id).to_dict()

    def reset_alarm(self, alarm_id: str):
        return self.alarm_manager.reset(alarm_id).to_dict()

    def apply_program_motor_speed(self, speed: float):
        speed = max(0, min(2000, float(speed)))
        old_speed = self.process.motor_speed

        if abs(old_speed - speed) < 0.01:
            return

        self.process.change_motor_speed(speed)
        self.plc.write_register("motor_speed", speed)

        self.add_event(
            event_type="PLC_PROGRAM_OUTPUT",
            severity="HIGH" if speed < 500 else "INFO",
            source="PLC-001",
            message=(
                f"PLC program commanded motor speed "
                f"from {old_speed:.0f} RPM to {speed:.0f} RPM"
            ),
        )

    def apply_program_valve_position(self, position: float):
        position = max(0, min(100, float(position)))
        old_position = self.process.valve_position

        if abs(old_position - position) < 0.01:
            return

        self.process.change_valve_position(position)
        self.plc.write_register("valve_position", position)

        self.add_event(
            event_type="PLC_PROGRAM_OUTPUT",
            severity=(
                "HIGH"
                if position < 10 or position > 90
                else "INFO"
            ),
            source="PLC-001",
            message=(
                f"PLC program commanded valve position "
                f"from {old_position:.0f}% to {position:.0f}%"
            ),
        )

    def apply_program_temperature(self, temperature: float):
        """El programa PLC escribe directamente al setpoint de temperatura."""
        temperature = max(0.0, min(150.0, float(temperature)))
        old_temperature = self.process.temperature

        if abs(old_temperature - temperature) < 0.01:
            return

        self.process.temperature = temperature
        self.plc.write_register("temperature", temperature)

        self.add_event(
            event_type="PLC_PROGRAM_OUTPUT",
            severity="HIGH" if temperature > 80 or temperature < 40 else "INFO",
            source="PLC-001",
            message=(
                f"PLC program commanded temperature "
                f"from {old_temperature:.1f}°C to {temperature:.1f}°C"
            ),
        )

    def apply_program_pressure(self, pressure: float):
        """El programa PLC escribe directamente al setpoint de presión."""
        pressure = max(0.0, min(20.0, float(pressure)))
        old_pressure = self.process.pressure

        if abs(old_pressure - pressure) < 0.01:
            return

        self.process.pressure = pressure
        self.plc.write_register("pressure", pressure)

        self.add_event(
            event_type="PLC_PROGRAM_OUTPUT",
            severity="HIGH" if pressure > 4.5 or pressure < 2.5 else "INFO",
            source="PLC-001",
            message=(
                f"PLC program commanded pressure "
                f"from {old_pressure:.2f} bar to {pressure:.2f} bar"
            ),
        )

    # =========================================================
    # HMI SETPOINTS — umbrales ISA-18.2 (LL / L / H / HH)
    # En la vida real: el operador introduce un valor en la
    # pantalla HMI → el PLC lo recibe en su DB → ajusta el
    # proceso → el alarm manager verifica los umbrales.
    # =========================================================

    # Formato: (valor_umbral, operador, alarm_id, severity, mensaje_siem)
    # operador ">=" → activa cuando valor >= umbral
    # operador "<=" → activa cuando valor <= umbral
    HMI_ALARM_THRESHOLDS = {
        "TEMPERATURE": [
            (40.0, "<=", "TEMP_LL", "WARNING",
             "Temperatura LL — proceso excesivamente frío"),
            (60.0, "<=", "TEMP_L",  "INFO",
             "Temperatura L — por debajo del mínimo operativo (60 °C)"),
            (80.0, ">=", "TEMP_H",  "HIGH",
             "Temperatura H — sobre el máximo operativo (80 °C)"),
            (90.0, ">=", "TEMP_HH", "CRITICAL",
             "Temperatura HH — emergencia térmica, riesgo de daño"),
        ],
        "PRESSURE": [
            (2.0,  "<=", "PRES_LL", "WARNING",
             "Presión LL — posible pérdida de fluido de proceso"),
            (3.0,  "<=", "PRES_L",  "INFO",
             "Presión L — por debajo del mínimo operativo (3.0 bar)"),
            (4.5,  ">=", "PRES_H",  "HIGH",
             "Presión H — sobre el máximo operativo (4.5 bar)"),
            (5.5,  ">=", "PRES_HH", "CRITICAL",
             "Presión HH — riesgo de ruptura del recipiente"),
        ],
        "MOTOR_SPEED": [
            (400.0,  "<=", "MOTOR_LL", "WARNING",
             "Motor LL — velocidad extremadamente baja, posible parada"),
            (600.0,  "<=", "MOTOR_L",  "HIGH",
             "Motor L — velocidad por debajo del mínimo operativo"),
            (1550.0, ">=", "MOTOR_H",  "HIGH",
             "Motor H — velocidad sobre el límite nominal (1500 RPM)"),
            (1650.0, ">=", "MOTOR_HH", "CRITICAL",
             "Motor HH — sobrevelocidad crítica, riesgo mecánico"),
        ],
        "VALVE_POSITION": [
            (5.0,  "<=", "VALVE_LL", "WARNING",
             "Válvula LL — casi cerrada, flujo mínimo"),
            (92.0, ">=", "VALVE_HH", "HIGH",
             "Válvula HH — casi completamente abierta, sin control"),
        ],
    }

    def set_hmi_setpoint(self, variable: str, value: float) -> dict:
        """
        Aplica un setpoint introducido por el operador desde el panel HMI.

        Flujo real equivalente:
          1. Operador toca la pantalla del KP400 e introduce el valor
          2. El HMI escribe el setpoint en el DB del PLC (p.e. DB1.DBD20)
          3. El programa PLC lee el nuevo setpoint en el siguiente ciclo
          4. El alarm manager verifica umbrales ISA-18.2 (LL/L/H/HH)
          5. Se generan alarmas y eventos SIEM si procede
        """
        variable = variable.upper()

        handlers = {
            "TEMPERATURE":    self.apply_program_temperature,
            "PRESSURE":       self.apply_program_pressure,
            "MOTOR_SPEED":    self.apply_program_motor_speed,
            "VALVE_POSITION": self.apply_program_valve_position,
        }

        if variable not in handlers:
            raise ValueError(
                f"Variable '{variable}' no es ajustable desde el HMI. "
                f"Variables disponibles: {', '.join(handlers)}"
            )

        # Aplicar al proceso
        handlers[variable](value)

        # Verificar umbrales y disparar alarmas
        triggered = self._check_hmi_alarms(variable, value)

        # Severidad del evento SIEM según la alarma más grave disparada
        severity_rank = {"INFO": 0, "WARNING": 1, "HIGH": 2, "CRITICAL": 3}
        event_severity = "INFO"
        for t in triggered:
            if severity_rank.get(t["severity"], 0) > severity_rank.get(event_severity, 0):
                event_severity = t["severity"]

        alarm_note = (
            f" — {len(triggered)} alarma(s): "
            + ", ".join(t["alarm_id"] for t in triggered)
        ) if triggered else ""

        self.add_event(
            "HMI_SETPOINT", event_severity, "HMI-001",
            f"Operador ajustó {variable} a {value:.2f} desde panel HMI" + alarm_note,
        )

        return self.get_state()

    def _check_hmi_alarms(self, variable: str, value: float) -> list:
        """Verifica los umbrales ISA-18.2 para una variable y dispara alarmas."""
        thresholds = self.HMI_ALARM_THRESHOLDS.get(variable, [])
        triggered = []

        for threshold_value, operator, alarm_id, severity, message in thresholds:
            active = (
                (operator == ">=" and value >= threshold_value)
                or (operator == "<=" and value <= threshold_value)
            )
            if active:
                self.alarm_manager.trigger(
                    alarm_id=alarm_id,
                    severity=severity,
                    source="HMI-001",
                    message=(
                        f"{message} — "
                        f"Valor ingresado: {value:.2f}  "
                        f"(umbral: {threshold_value})"
                    ),
                )
                triggered.append({"alarm_id": alarm_id, "severity": severity})

        return triggered

    # =========================================================
    # GENERIC EQUIPMENT STATUS
    # =========================================================

    def set_equipment_status(
        self,
        asset_id: str,
        status: str,
    ):

        equipment = self.get_equipment(
            asset_id
        )

        if not equipment:

            raise ValueError(
                f"Equipment {asset_id} not found"
            )

        try:

            new_status = EquipmentStatus(
                status.upper()
            )

        except ValueError:

            raise ValueError(
                f"Invalid equipment status: {status}"
            )

        old_status = equipment.status.value

        equipment.set_status(
            new_status
        )

        self.add_event(
            event_type="EQUIPMENT_STATUS_CHANGE",
            severity=(
                "HIGH"
                if new_status
                in [
                    EquipmentStatus.COMPROMISED,
                    EquipmentStatus.OFFLINE,
                ]
                else "INFO"
            ),
            source=asset_id,
            message=(
                f"Equipment status changed "
                f"from {old_status} to "
                f"{new_status.value}"
            ),
        )

    # =========================================================
    # ATTACK ENGINE — MÉTODOS DE SIMULACIÓN DE ATAQUES
    # =========================================================

    def execute_attack(self, attack_type: str) -> dict:
        """Ejecuta un escenario de ataque educativo y devuelve resultado + salida terminal."""
        from simulation.attack_engine import AttackEngine, SCENARIOS

        if attack_type not in SCENARIOS:
            raise ValueError(f"Ataque desconocido: {attack_type}")

        engine = AttackEngine(self)
        terminal = engine.terminal_output(attack_type)

        dispatch = {
            "port_scan":     self._attack_port_scan,
            "s7_enum":       self._attack_s7_enum,
            "plc_inject":    self._attack_plc_inject,
            "hmi_exploit":   self._attack_hmi_exploit,
            "scada_dos":     self._attack_scada_dos,
            "full_sabotage": self._attack_full_sabotage,
        }

        effects = dispatch[attack_type]()

        return {
            "attack_type": attack_type,
            "scenario": SCENARIOS[attack_type],
            "terminal_output": terminal,
            "effects": effects,
            "plant_state": self.get_state(),
        }

    def _attack_port_scan(self) -> list[str]:
        """Reconocimiento de red — solo genera eventos en el SIEM."""
        self.add_event(
            "NETWORK_SCAN_DETECTED", "HIGH", "NETWORK",
            "Escaneo de puertos detectado desde 192.168.1.100 "
            "— activos OT expuestos en red plana",
        )
        self.add_event(
            "RECON_ALERT", "MEDIUM", "IDS",
            "SYN scan sigiloso en puertos industriales 102, 502, 44818, 4840",
        )
        return ["SIEM_ALERT", "NETWORK_SCAN_LOGGED"]

    def _attack_s7_enum(self) -> list[str]:
        """Enumeración S7comm — exfiltra datos de proceso sin autenticación."""
        self.add_event(
            "S7COMM_UNAUTHORIZED_ACCESS", "CRITICAL", "PLC-001",
            "Acceso S7comm no autorizado desde 192.168.1.100 "
            "— datos de proceso exfiltrados",
        )
        self.add_event(
            "PLC_DATA_EXFILTRATION", "HIGH", "PLC-001",
            f"Datos leídos: T={self.process.temperature:.1f}°C "
            f"P={self.process.pressure:.2f}bar "
            f"Motor={self.process.motor_speed:.0f}RPM",
        )
        self.alarm_manager.trigger(
            "S7_RECON", "HIGH", "PLC-001",
            "Acceso de lectura S7comm no autenticado — datos de proceso robados",
        )
        return ["PLC_DATA_EXFILTRATED", "SIEM_ALERT"]

    def _attack_plc_inject(self) -> list[str]:
        """
        Inyección de código malicioso al PLC vía S7comm.
        Bypasea el validador (simula que el atacante tiene acceso directo al PLC).
        Efectos: paro de motor, válvula totalmente abierta, supresión de alarmas.
        """
        # 1. Cargar programa malicioso bypasseando el validador
        self.plc_program.source = MALICIOUS_PROGRAM
        self.plc_program.version += 1
        self.plc_program.status = "COMPROMISED"
        self.plc_program.running = True
        self.plc_program.last_error = "Código malicioso inyectado via S7comm no autenticado"

        # 2. Aplicar efectos físicos directamente
        self.process.change_motor_speed(0)
        self.plc.write_register("motor_speed", 0)

        self.process.change_valve_position(100)
        self.plc.write_register("valve_position", 100)

        # 3. Marcar PLC como comprometido
        plc_eq = self.get_equipment("PLC-001")
        if plc_eq:
            plc_eq.set_status(EquipmentStatus.COMPROMISED)

        motor_eq = self.get_equipment("M-001")
        if motor_eq:
            motor_eq.set_status(EquipmentStatus.OFFLINE)

        valve_eq = self.get_equipment("V-001")
        if valve_eq:
            valve_eq.set_status(EquipmentStatus.WARNING)

        # 4. Disparar alarmas críticas
        self.alarm_manager.trigger(
            "CODE_INJECTION", "CRITICAL", "PLC-001",
            "Lógica escalera maliciosa inyectada via S7comm — "
            "enclavamientos de seguridad DESHABILITADOS",
        )
        self.alarm_manager.trigger(
            "MOTOR_SABOTAGE", "CRITICAL", "M-001",
            "Motor forzado a 0 RPM por programa PLC malicioso — "
            "producción PARADA",
        )
        self.alarm_manager.trigger(
            "VALVE_SABOTAGE", "CRITICAL", "V-001",
            "Válvula forzada a 100% por programa PLC malicioso — "
            "pérdida de fluido de proceso",
        )
        self.alarm_manager.trigger(
            "SAFETY_SUPPRESSED", "CRITICAL", "PLC-001",
            "Rutina de supresión de alarmas activa — "
            "operadores NO ven el estado real del proceso",
        )

        # 5. Eventos SIEM
        self.add_event(
            "PLC_CODE_INJECTION", "CRITICAL", "PLC-001",
            "Bloque OB1 malicioso descargado via sesión S7comm no autorizada",
        )
        self.add_event(
            "SAFETY_INTERLOCK_BYPASS", "CRITICAL", "PLC-001",
            "Enclavamientos de seguridad deshabilitados — "
            "rutina de supresión de alarmas activa",
        )
        self.add_event(
            "PRODUCTION_SABOTAGE", "CRITICAL", "M-001",
            "Motor parado de emergencia por código inyectado — producción PERDIDA",
        )
        self.add_event(
            "PROCESS_FLUID_LOSS", "CRITICAL", "V-001",
            "Válvula completamente abierta — pérdida de fluido de proceso",
        )

        return ["PLC_COMPROMISED", "MOTOR_STOPPED", "VALVE_OPEN", "ALARMS_SUPPRESSED"]

    def _attack_hmi_exploit(self) -> list[str]:
        """Explotación del HMI via EternalBlue — obtiene acceso SYSTEM."""
        hmi = self.get_equipment("HMI-001")
        if hmi:
            hmi.set_status(EquipmentStatus.COMPROMISED)

        self.alarm_manager.trigger(
            "HMI_COMPROMISE", "CRITICAL", "HMI-001",
            "Workstation HMI comprometida via CVE-2017-0144 (EternalBlue) "
            "— acceso SYSTEM obtenido",
        )

        self.add_event(
            "HMI_EXPLOITATION", "CRITICAL", "HMI-001",
            "Exploit EternalBlue exitoso — acceso SYSTEM en HMI de operador",
        )
        self.add_event(
            "CREDENTIAL_THEFT", "CRITICAL", "HMI-001",
            "Credenciales WinCC SCADA extraídas por atacante: scada_operator/Siemens2024!",
        )

        return ["HMI_COMPROMISED", "CREDENTIALS_STOLEN"]

    def _attack_scada_dos(self) -> list[str]:
        """DoS contra el servidor SCADA — supervisión offline."""
        scada = self.get_equipment("SCADA-001")
        if scada:
            scada.set_status(EquipmentStatus.OFFLINE)

        self.alarm_manager.trigger(
            "SCADA_OFFLINE", "CRITICAL", "SCADA-001",
            "Servidor SCADA no responde — control supervisorio PERDIDO",
        )

        self.add_event(
            "OPCUA_DOS", "CRITICAL", "SCADA-001",
            "Servicio OPC-UA no disponible — 50,000 peticiones malformadas/minuto",
        )
        self.add_event(
            "SUPERVISORY_CONTROL_LOST", "CRITICAL", "SCADA-001",
            "Operadores han perdido visibilidad del proceso — "
            "control remoto IMPOSIBLE",
        )

        return ["SCADA_OFFLINE", "SUPERVISORY_CONTROL_LOST"]

    def _attack_full_sabotage(self) -> list[str]:
        """
        Sabotaje total multi-vector:
        - Inyección de código PLC
        - Sobrescritura directa de temperatura y presión a valores críticos
        - Explotación de HMI y SCADA
        - Todos los activos marcados como comprometidos
        """
        # Vector 1: código PLC
        self._attack_plc_inject()

        # Vector 2: HMI
        self._attack_hmi_exploit()

        # Vector 3: SCADA
        self._attack_scada_dos()

        # Vector 4: Forzar valores de proceso a niveles críticos
        # (bypass directo de registros — imposible desde código PLC normal)
        self.process.temperature = 95.0
        self.process.pressure = 6.2
        self.plc.write_register("temperature", 95.0)
        self.plc.write_register("pressure", 6.2)

        # Marcar resto del equipamiento comprometido
        for asset_id in ["GW-001", "ENG-001", "CNC-001"]:
            eq = self.get_equipment(asset_id)
            if eq:
                eq.set_status(EquipmentStatus.COMPROMISED)

        # Alarmas adicionales de proceso crítico
        self.alarm_manager.trigger(
            "CRITICAL_TEMPERATURE", "CRITICAL", "TT-001",
            "Temperatura 95.0°C — límite crítico superado (seguro: 80°C)",
        )
        self.alarm_manager.trigger(
            "CRITICAL_PRESSURE", "CRITICAL", "PT-001",
            "Presión 6.2 bar — límite del recipiente superado (seguro: 4.5 bar)",
        )
        self.alarm_manager.trigger(
            "PLANT_FULLY_COMPROMISED", "CRITICAL", "OT-CYBER-RANGE",
            "TODOS LOS ACTIVOS OT COMPROMETIDOS — ataque multi-vector en curso",
        )

        self.add_event(
            "FULL_PLANT_SABOTAGE", "CRITICAL", "OT-CYBER-RANGE",
            "Ataque coordinado multi-vector: inyección de código + "
            "sobrescritura de registros + movimiento lateral",
        )
        self.add_event(
            "PHYSICAL_DAMAGE_IMMINENT", "CRITICAL", "OT-CYBER-RANGE",
            "Proceso en estado CRÍTICO — T=95°C P=6.2bar — "
            "riesgo de daño físico INMINENTE",
        )

        return [
            "FULL_COMPROMISE", "CRITICAL_TEMPERATURE", "CRITICAL_PRESSURE",
            "ALL_ASSETS_COMPROMISED",
        ]

    def restore_plant(self) -> dict:
        """Restaura la planta a estado operativo normal tras un escenario de ataque."""
        # Proceso
        self.process.temperature = 68.0
        self.process.pressure = 3.8
        self.process.motor_speed = 1450.0
        self.process.valve_position = 50.0
        self.process.production_running = True
        self.process.production_rate = 100.0
        self.process.process_alarm = False

        # PLC
        self.plc.run()
        self.plc.write_register("motor_speed", 1450.0)
        self.plc.write_register("valve_position", 50.0)
        self.plc.write_register("temperature", 68.0)
        self.plc.write_register("pressure", 3.8)

        # Programa PLC
        self.plc_program.source = ""
        self.plc_program.status = "NOT_LOADED"
        self.plc_program.running = False
        self.plc_program.last_error = ""
        self.plc_runtime.flags["ALARM"] = False

        # Equipos — todos de vuelta a ONLINE
        for equipment in self.equipment:
            equipment.set_status(EquipmentStatus.ONLINE)

        # Limpiar todas las alarmas
        self.alarm_manager.alarms.clear()

        self.add_event(
            "PLANT_RESTORED", "INFO", "OT-CYBER-RANGE",
            "Planta restaurada a estado operativo normal tras escenario de ataque",
        )

        return self.get_state()

    def set_process_values(
        self,
        temperature:    float | None = None,
        pressure:       float | None = None,
        motor_speed:    float | None = None,
        valve_position: float | None = None,
    ) -> dict:
        """Establece valores de proceso directamente desde la interfaz del operador."""
        changed = []

        if temperature is not None:
            t = max(0.0, min(150.0, float(temperature)))
            self.process.temperature = t
            self.plc.write_register("temperature", t)
            changed.append(f"T={t:.1f}°C")

        if pressure is not None:
            p = max(0.0, min(20.0, float(pressure)))
            self.process.pressure = p
            self.plc.write_register("pressure", p)
            changed.append(f"P={p:.2f}bar")

        if motor_speed is not None:
            m = max(0.0, min(2000.0, float(motor_speed)))
            self.process.change_motor_speed(m)
            self.plc.write_register("motor_speed", m)
            changed.append(f"Motor={m:.0f}RPM")

        if valve_position is not None:
            v = max(0.0, min(100.0, float(valve_position)))
            self.process.change_valve_position(v)
            self.plc.write_register("valve_position", v)
            changed.append(f"Valve={v:.0f}%")

        if changed:
            self.add_event(
                "OPERATOR_PROCESS_SET", "INFO", "HMI-001",
                "Operator set process values from interface: " + ", ".join(changed),
            )

        return self.get_state()

    # =========================================================

    def get_inventory(self):

        return [
            equipment.get_info()
            for equipment in self.equipment
        ]

    # =========================================================
    # FULL PLANT STATE
    # =========================================================

    def get_state(self):

        return {

            "plant": {

                "line":
                    "Production Line 01",

                "status":
                    (
                        "RUNNING"
                        if self.process.production_running
                        else "STOPPED"
                    ),

            },

            "process":
                self.process.get_state(),

            "plc":
                self.plc.get_state(),

            "plc_program":
                self.plc_program.to_dict(),

            "alarms":
                self.alarm_manager.get_state(),

            "activity":
                self.activity,

            "assets":
                {aid: ap.to_dict() for aid, ap in self.assets_runtime.items()},

            "health":
                self._compute_health(),

            "equipment": [
                equipment.get_info()
                for equipment in self.equipment
            ],

            "events": [
                event.to_dict()
                for event in self.events[-50:]
            ],

        }