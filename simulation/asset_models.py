"""
asset_models.py — Proceso individual por activo del OT Cyber Range.

Modela cada activo del Excel como una planta real: estado vivo, acciones con
impacto, criticidad y salud (normal / warning / critical) por tipo de equipo.
No ejecuta nada del host: es un modelo de estado puro.

Categorías soportadas:
  plc · motor · pump · valve · sensor · machine · hmi · scada · historian ·
  mes · server · workstation · switch · firewall · gateway (eWON) · generic
"""

# Criticidad por defecto según el rol en el proceso/seguridad (el Excel puede
# sobre-escribirla con la columna criticality).
CRIT_BY_CAT = {
    "plc": "high", "scada": "high", "firewall": "high", "gateway": "high",
    "motor": "medium", "pump": "medium", "valve": "medium", "machine": "medium",
    "sensor": "medium", "hmi": "medium", "switch": "medium",
    "workstation": "medium", "server": "medium",
    "historian": "low", "mes": "low", "generic": "low",
}


def categorize(asset_type: str) -> str:
    t = (asset_type or "").upper()
    # red / acceso (antes que genéricos)
    if "EWON" in t or "VPN" in t or "REMOTE ACCESS" in t or "TELECONTROL" in t:
        return "gateway"
    if "FIREWALL" in t or "MGUARD" in t or "NGFW" in t or "IPS" in t:
        return "firewall"
    if "SWITCH" in t or "ROUTER" in t:
        return "switch"
    if "GATEWAY" in t:                                   return "gateway"
    # control
    if "PLC" in t or "RTU" in t or "CONTROLLER" in t or "DCS" in t:
        return "plc"
    # máquinas / actuadores
    if "CNC" in t or "ROBOT" in t or "MACHINE" in t:     return "machine"
    if any(k in t for k in ("MOTOR", "DRIVE", "VFD")):   return "motor"
    if "PUMP" in t or "BOMBA" in t:                      return "pump"
    if "VALVE" in t or "VALV" in t:                      return "valve"
    # instrumentación
    if any(k in t for k in ("SENSOR", "TRANSMIT", "ANALYZER",
                            "PRESSURE", "TEMPERATURE", "FLOW", "LEVEL")):
        return "sensor"
    # cómputo / supervisión
    if "HMI" in t or "PANEL" in t:                       return "hmi"
    if "SCADA" in t:                                     return "scada"
    if "HISTORIAN" in t or "HIST" in t:                  return "historian"
    if "MES" in t:                                       return "mes"
    if any(k in t for k in ("WORKSTATION", "ENGINEERING", "EWS", "IPC")):
        return "workstation"
    if "SERVER" in t:                                    return "server"
    return "generic"


class AssetProcess:
    def __init__(self, asset: dict, variables: list | None = None):
        self.id       = str(asset.get("id", "?"))
        self.name     = str(asset.get("name", ""))
        self.type     = str(asset.get("type", ""))
        self.category = categorize(self.type)
        self.status   = "ONLINE"
        self.activity = "normal"
        self.criticality = self._criticality(asset)
        self.state    = self._initial_state()
        self._seed_from_variables(variables or [])

    # ----------------------------------------------------- criticidad
    def _criticality(self, asset):
        c = str(asset.get("criticality", "")).strip().upper()
        if c in ("HIGH", "ALTA", "CRITICAL", "CRITICA", "CRÍTICA", "3", "A"):   return "high"
        if c in ("MEDIUM", "MEDIA", "MED", "2", "B"):                           return "medium"
        if c in ("LOW", "BAJA", "1", "C"):                                      return "low"
        return CRIT_BY_CAT.get(self.category, "low")

    # ----------------------------------------------------- estado inicial
    def _initial_state(self):
        c = self.category
        if c == "plc":
            return {"cpu_state": "RUN", "mode": "REMOTE", "scan_ms": 12.0, "forces": 0}
        if c == "motor":
            return {"running": True, "speed": 1450.0, "setpoint": 1450.0,
                    "current": 8.4, "torque": 42.0, "temp": 45.0, "fault": False}
        if c == "pump":
            return {"running": True, "flow": 280.0, "setpoint": 280.0,
                    "pressure": 3.2, "temp": 40.0, "fault": False}
        if c == "valve":
            return {"position": 50.0, "setpoint": 50.0, "mode": "AUTO", "fail": "FC"}
        if c == "sensor":
            return {"value": 68.4, "unit": "°C", "min": 0.0, "max": 150.0,
                    "forced": False, "fault": False, "quality": "GOOD"}
        if c == "machine":
            return {"running": False, "program": "—", "spindle": 0.0, "fault": False}
        if c == "hmi":
            return {"online": True, "user": "operador"}
        if c == "scada":
            return {"online": True, "cpu": 22.0, "mem": 48.0, "redundancy": "PRIMARY"}
        if c == "historian":
            return {"online": True, "lag_s": 0.0, "storage_pct": 62.0}
        if c == "mes":
            return {"online": True, "orders": 3}
        if c == "server":
            return {"online": True, "cpu": 18.0, "mem": 42.0}
        if c == "workstation":
            return {"online": True, "last_tool": None, "programming": False}
        if c == "switch":
            return {"ports_up": 6, "ports_total": 8}
        if c == "firewall":
            return {"mode": "ENFORCING", "rules_denied": 1, "last_rule": None}
        if c == "gateway":
            return {"tunnel": False, "remote_sessions": 0, "internet_exposed": True,
                    "vendor_cloud": "Talk2M", "compromised": False}
        return {"pings": 0}

    def _seed_from_variables(self, variables):
        mine = [v for v in variables if str(v.get("assetId", "")) == self.id]
        if self.category == "sensor" and mine:
            v = mine[0]
            try: self.state["value"] = float(v.get("initialValue", self.state["value"]))
            except (TypeError, ValueError): pass
            if v.get("unit"): self.state["unit"] = v["unit"]
            for k in ("min", "max"):
                try:
                    if v.get(k) not in (None, ""): self.state[k] = float(v[k])
                except (TypeError, ValueError): pass

    # ----------------------------------------------------- acciones
    def apply_action(self, action: str, value=None):
        a = (action or "").upper()
        c = self.category
        self.activity = "command"
        self.status = "ONLINE"

        # ---------- CONTROL ----------
        if c == "plc":
            if a in ("STOP", "PARO", "PARAR"):
                self.state["cpu_state"] = "STOP"; self.activity = "warning"
                return ("PLC_STOP", "CRITICAL", f"{self.id}: PLC en STOP")
            if a in ("RUN", "START", "MARCHA"):
                self.state["cpu_state"] = "RUN"
                return ("PLC_RUN", "INFO", f"{self.id}: PLC en RUN")
            if a in ("RESET",):
                self.state["cpu_state"] = "RUN"; self.state["forces"] = 0
                return ("PLC_RESET", "INFO", f"{self.id}: PLC reiniciado")
            if a in ("PROGRAM", "PROG"):
                self.state["mode"] = "PROGRAM"; self.activity = "config"
                return ("PLC_MODE_PROGRAM", "WARNING", f"{self.id}: llave en PROGRAM (reprogramación)")
            if a in ("REMOTE", "KEY_RUN"):
                self.state["mode"] = "REMOTE"
                return ("PLC_MODE_REMOTE", "INFO", f"{self.id}: llave en REMOTE/RUN")
            if a in ("CLEARFORCES", "CLEAR_FORCES"):
                self.state["forces"] = 0
                return ("PLC_CLEAR_FORCES", "INFO", f"{self.id}: forzados eliminados")

        # ---------- ACTUADORES ----------
        elif c in ("motor", "pump"):
            field = "speed" if c == "motor" else "flow"
            if a in ("START", "RUN", "MARCHA"):
                self.state["running"] = True; self.state["fault"] = False
                self.state[field] = self.state["setpoint"]
                return (f"{c.upper()}_START", "INFO", f"{self.id}: arranque")
            if a in ("STOP", "PARO", "PARAR"):
                self.state["running"] = False; self.state[field] = 0.0
                self.activity = "warning"
                return (f"{c.upper()}_STOP", "WARNING", f"{self.id}: paro")
            if a in ("SPEED", "SETPOINT", "POSITION") and value is not None:
                self.state["setpoint"] = float(value)
                if self.state["running"]: self.state[field] = float(value)
                return (f"{c.upper()}_SETPOINT", "INFO", f"{self.id}: setpoint -> {float(value):.0f}")
            if a in ("TRIP", "FAULT", "FALLA"):
                self.state["fault"] = True; self.state["running"] = False
                self.state[field] = 0.0; self.activity = "warning"
                return (f"{c.upper()}_TRIP", "CRITICAL", f"{self.id}: disparo por falla")
            if a in ("RESETFAULT", "RESET"):
                self.state["fault"] = False
                return (f"{c.upper()}_RESET", "INFO", f"{self.id}: falla reconocida")

        elif c == "valve":
            if a in ("OPEN", "ABRIR"):
                self.state["setpoint"] = 100.0; self.state["position"] = 100.0
                return ("VALVE_OPEN", "INFO", f"{self.id}: válvula abierta")
            if a in ("CLOSE", "CERRAR"):
                self.state["setpoint"] = 0.0; self.state["position"] = 0.0
                self.activity = "warning"
                return ("VALVE_CLOSE", "WARNING", f"{self.id}: válvula cerrada")
            if a in ("POSITION", "SETPOINT", "SPEED") and value is not None:
                self.state["setpoint"] = float(value)
                return ("VALVE_SETPOINT", "INFO", f"{self.id}: posición -> {float(value):.0f}%")
            if a in ("AUTO", "MANUAL"):
                self.state["mode"] = a
                return ("VALVE_MODE", "INFO", f"{self.id}: modo {a}")

        elif c == "machine":
            if a in ("START", "RUN"):
                self.state["running"] = True; self.state["fault"] = False; self.state["spindle"] = 1200.0
                return ("MACHINE_START", "INFO", f"{self.id}: ciclo iniciado")
            if a in ("STOP",):
                self.state["running"] = False; self.state["spindle"] = 0.0; self.activity = "warning"
                return ("MACHINE_STOP", "WARNING", f"{self.id}: ciclo detenido")
            if a in ("LOAD",):
                self.state["program"] = str(value or "PRG")
                return ("MACHINE_LOAD", "INFO", f"{self.id}: programa '{value}' cargado")
            if a in ("TRIP", "FAULT"):
                self.state["fault"] = True; self.state["running"] = False; self.activity = "warning"
                return ("MACHINE_FAULT", "CRITICAL", f"{self.id}: falla de máquina")

        # ---------- INSTRUMENTACIÓN ----------
        elif c == "sensor":
            if a in ("FORCE", "SET") and value is not None:
                self.state["value"] = float(value); self.state["forced"] = True
                self.state["quality"] = "FORCED"; self.activity = "warning"
                return ("SENSOR_FORCE", "WARNING", f"{self.id}: valor forzado -> {float(value)}")
            if a in ("FAULT", "FALLA"):
                self.state["fault"] = True; self.state["quality"] = "BAD"
                self.status = "WARNING"; self.activity = "warning"
                return ("SENSOR_FAULT", "CRITICAL", f"{self.id}: sensor en falla (señal perdida)")
            if a in ("CLEAR", "RELEASE", "LIBERAR"):
                self.state["forced"] = False; self.state["fault"] = False; self.state["quality"] = "GOOD"
                return ("SENSOR_CLEAR", "INFO", f"{self.id}: sensor liberado")

        # ---------- CÓMPUTO / SUPERVISIÓN ----------
        elif c in ("scada", "historian", "mes", "server"):
            if a in ("RESTART", "REINICIAR"):
                self.state["online"] = True
                if "cpu" in self.state: self.state["cpu"] = 70.0
                self.activity = "config"
                return ("SERVICE_RESTART", "INFO", f"{self.id}: servicio '{value or '—'}' reiniciado")
            if a in ("STOP",):
                self.state["online"] = False; self.status = "WARNING"; self.activity = "warning"
                sev = "CRITICAL" if c == "scada" else "WARNING"
                return ("SERVICE_STOP", sev, f"{self.id}: servicio detenido")
            if a in ("FAILOVER",) and c == "scada":
                self.state["redundancy"] = "SECONDARY"; self.activity = "config"
                return ("SCADA_FAILOVER", "WARNING", f"{self.id}: conmutación a nodo secundario")

        elif c == "hmi":
            if a in ("LOGOUT",):
                self.state["user"] = None
                return ("HMI_LOGOUT", "INFO", f"{self.id}: sesión cerrada")
            if a in ("LOGIN",):
                self.state["user"] = str(value or "operador")
                return ("HMI_LOGIN", "INFO", f"{self.id}: sesión iniciada")
            if a in ("LOCK",):
                self.state["user"] = None; self.activity = "config"
                return ("HMI_LOCK", "INFO", f"{self.id}: panel bloqueado")

        elif c == "workstation":
            tool = str(value or action)
            prog = any(k in tool.upper() for k in ("TIA", "STEP 7", "STUDIO", "PORTAL", "RSLOGIX"))
            if any(k in tool.upper() for k in ("NMAP", "WIRESHARK", "SCAN")):
                self.state["last_tool"] = tool; self.activity = "scan"
                return ("ENG_RECON", "WARNING", f"{self.id}: reconocimiento '{tool}'")
            self.state["last_tool"] = tool; self.state["programming"] = prog
            if prog: self.activity = "config"
            return ("ENG_TOOL", "WARNING" if prog else "INFO",
                    f"{self.id}: {'herramienta de programación' if prog else 'abrió'} '{tool}'")

        # ---------- RED / SEGURIDAD ----------
        elif c == "switch":
            if a in ("PORT_DOWN",):
                self.state["ports_up"] = max(0, self.state["ports_up"] - 1); self.activity = "warning"
                return ("PORT_DOWN", "WARNING", f"{self.id}: puerto caído")
            if a in ("PORT_UP",):
                self.state["ports_up"] = min(self.state["ports_total"], self.state["ports_up"] + 1)
                return ("PORT_UP", "INFO", f"{self.id}: puerto levantado")

        elif c == "firewall":
            if a in ("DENY", "BLOCK", "DESACTIVAR"):
                self.state["rules_denied"] += 1; self.state["last_rule"] = value; self.activity = "blocked"
                return ("FW_RULE_DENY", "HIGH", f"{self.id}: regla DENY aplicada")
            if a in ("PERMIT", "ALLOW", "ACTIVAR"):
                self.state["rules_denied"] = max(0, self.state["rules_denied"] - 1); self.activity = "config"
                return ("FW_RULE_PERMIT", "INFO", f"{self.id}: regla PERMIT aplicada")
            if a in ("BYPASS", "DISABLE"):
                self.state["mode"] = "BYPASS"; self.activity = "warning"
                return ("FW_BYPASS", "HIGH", f"{self.id}: firewall en BYPASS (sin inspección)")
            if a in ("ENFORCE", "ENABLE"):
                self.state["mode"] = "ENFORCING"; self.activity = "config"
                return ("FW_ENFORCE", "INFO", f"{self.id}: firewall en ENFORCING")

        elif c == "gateway":   # eWON / acceso remoto
            if a in ("CONNECT", "TUNNEL_UP"):
                self.state["tunnel"] = True; self.activity = "config"
                return ("EWON_TUNNEL_UP", "WARNING", f"{self.id}: túnel VPN establecido a {self.state['vendor_cloud']}")
            if a in ("DISCONNECT", "TUNNEL_DOWN"):
                self.state["tunnel"] = False; self.state["remote_sessions"] = 0
                return ("EWON_TUNNEL_DOWN", "INFO", f"{self.id}: túnel VPN cerrado")
            if a in ("REMOTE_START", "SESSION_START"):
                self.state["tunnel"] = True; self.state["remote_sessions"] += 1; self.activity = "warning"
                return ("EWON_REMOTE_SESSION", "WARNING",
                        f"{self.id}: sesión remota activa ({self.state['remote_sessions']})")
            if a in ("REMOTE_END", "SESSION_END"):
                self.state["remote_sessions"] = max(0, self.state["remote_sessions"] - 1)
                return ("EWON_REMOTE_END", "INFO", f"{self.id}: sesión remota cerrada")
            if a in ("ISOLATE",):
                self.state["internet_exposed"] = False; self.activity = "config"
                return ("EWON_ISOLATE", "INFO", f"{self.id}: aislado de Internet")
            if a in ("EXPOSE",):
                self.state["internet_exposed"] = True; self.activity = "warning"
                return ("EWON_EXPOSE", "HIGH", f"{self.id}: expuesto a Internet")
            if a in ("COMPROMISE",):
                self.state["compromised"] = True; self.activity = "attack"
                return ("EWON_COMPROMISE", "CRITICAL", f"{self.id}: acceso remoto comprometido")

        elif c == "generic":
            self.state["pings"] += 1
            return ("EQUIPMENT_PING", "INFO", f"{self.id}: actividad registrada")

        return ("EQUIPMENT_ACTION", "INFO", f"{self.id}: {action}")

    # ----------------------------------------------------- salud
    def health(self):
        c, s = self.category, self.state
        if c == "plc":
            if s.get("cpu_state") != "RUN":      return "critical"
            if s.get("mode") == "PROGRAM" or s.get("forces", 0) > 0: return "warning"
            return "normal"
        if c in ("motor", "pump"):
            if s.get("fault"):                   return "critical"
            if not s.get("running", True):
                return "critical" if self.criticality == "high" else "warning"
            if s.get("temp", 0) > 80 or s.get("current", 0) > 18: return "warning"
            if c == "pump" and s.get("running") and s.get("flow", 1) < 5: return "warning"  # dry-run
            return "normal"
        if c == "valve":
            if s.get("position", 50) <= 0:       return "warning"       # alimentación cortada
            if abs(s.get("setpoint", 0) - s.get("position", 0)) > 25: return "warning"  # atascada
            return "normal"
        if c == "machine":
            if s.get("fault"):                   return "critical"
            return "normal"
        if c == "sensor":
            if s.get("fault"):                   return "critical"      # controlador ciego
            if s.get("forced"):                  return "warning"
            if s.get("quality", "GOOD") != "GOOD": return "warning"
            v = s.get("value")
            if v is not None and (v < s.get("min", -1e9) or v > s.get("max", 1e9)): return "warning"
            return "normal"
        if c == "hmi":
            return "warning" if not s.get("online", True) else "normal"  # operador a ciegas
        if c == "scada":
            if not s.get("online", True):        return "critical"      # pérdida de supervisión
            if s.get("redundancy") == "FAILED":  return "warning"
            if s.get("cpu", 0) > 90:             return "warning"
            return "normal"
        if c in ("historian", "mes", "server"):
            if not s.get("online", True):        return "warning"       # sin impacto directo al control
            if s.get("cpu", 0) > 90:             return "warning"
            return "normal"
        if c == "workstation":
            return "warning" if s.get("programming") else "normal"
        if c == "switch":
            up, tot = s.get("ports_up", 0), s.get("ports_total", 1)
            if up == 0:                          return "critical"      # segmento aislado
            if up < tot / 2:                     return "warning"
            return "normal"
        if c == "firewall":
            if s.get("mode") in ("BYPASS", "DISABLED"): return "warning"  # superficie expuesta
            return "normal"
        if c == "gateway":
            if s.get("compromised"):             return "critical"
            if s.get("tunnel") and s.get("internet_exposed") and s.get("remote_sessions", 0) > 0:
                return "warning"                 # acceso remoto activo y expuesto
            return "normal"
        return "normal"

    # ----------------------------------------------------- avance
    def tick(self, rnd):
        c, s = self.category, self.state
        if c in ("motor", "pump"):
            field = "speed" if c == "motor" else "flow"
            if s.get("running") and not s.get("fault"):
                s[field] += (s["setpoint"] - s[field]) * 0.3 + rnd(-5, 5)
                s[field] = max(0.0, s[field])
                if c == "motor":
                    s["current"] = max(0.0, min(20.0, s["current"] + rnd(-0.3, 0.3)))
                    s["torque"]  = max(0.0, min(100.0, s["torque"] + rnd(-1, 1)))
                if c == "pump":
                    s["pressure"] = max(0.0, s["pressure"] + rnd(-0.1, 0.1))
                s["temp"] = max(30.0, min(95.0, s["temp"] + rnd(-0.4, 0.5)))
            else:
                s[field] = max(0.0, s[field] - 50)
                s["temp"] = max(25.0, s["temp"] - 0.3)
        elif c == "valve":
            s["position"] += (s["setpoint"] - s["position"]) * 0.4
        elif c == "sensor":
            if not s.get("forced") and not s.get("fault"):
                s["value"] = max(s.get("min", 0.0), min(s.get("max", 1e9), s["value"] + rnd(-0.4, 0.4)))
        elif c in ("scada", "server"):
            s["cpu"] = max(5.0, min(99.0, s["cpu"] + rnd(-4, 4)))
            s["mem"] = max(20.0, min(99.0, s["mem"] + rnd(-2, 2)))

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "type": self.type,
            "category": self.category, "status": self.status,
            "activity": self.activity, "criticality": self.criticality,
            "health": self.health(), "state": self.state,
        }