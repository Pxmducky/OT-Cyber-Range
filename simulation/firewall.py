"""
firewall.py — Motor de firewall estilo Palo Alto (PAN-OS) del OT Cyber Range.

Un firewall real: zonas de seguridad, un rulebase ordenado (primera coincidencia)
basado en aplicaciones (App-ID), acción allow/deny, logging y registro de tráfico.
La evaluación es REAL: el atacante (attacker.py) consulta estas reglas, así que
una política de bloqueo cambia de verdad lo que se puede escanear/atacar.

Zonas usadas por el laboratorio:
  IT    — red corporativa (donde está el Kali del atacante)
  DMZ   — Historian / MES / servidores / eWON
  OT    — control y campo (PLC, HMI, SCADA, motores, válvulas, sensores)
"""

# App-ID por protocolo (lo que viaja), para reglas basadas en aplicación.
APP_OF_PROTO = {
    "S7COMM": "s7comm", "S7": "s7comm", "OPC-UA": "opcua", "OPCUA": "opcua",
    "MODBUS": "modbus", "ETHERNET/IP": "ethernet-ip", "ETHERNETIP": "ethernet-ip",
    "DNP3": "dnp3", "PROFINET": "profinet", "HTTP": "web-browsing", "HTTPS": "ssl",
    "SSH": "ssh", "RDP": "ms-rdp", "SMB": "ms-ds-smb", "FTP": "ftp",
    "SNMP": "snmp", "MQTT": "mqtt", "ICMP": "ping",
}


def app_of(proto):
    return APP_OF_PROTO.get((proto or "").upper().replace(" ", ""),
                            APP_OF_PROTO.get((proto or "").upper(), (proto or "any").lower()))


def default_rulebase():
    """Rulebase OT seguro por defecto (buenas prácticas IEC 62443)."""
    return [
        {"id": 1, "name": "OT-Intrazona",      "from": "OT",  "to": "OT",  "app": ["any"],              "action": "allow", "log": False},
        {"id": 2, "name": "DMZ-a-OT-OPC",      "from": "DMZ", "to": "OT",  "app": ["opcua"],            "action": "allow", "log": True},
        {"id": 3, "name": "IT-a-DMZ-Web",      "from": "IT",  "to": "DMZ", "app": ["web-browsing","ssl"],"action": "allow", "log": True},
        {"id": 4, "name": "Mgmt-SSH-a-DMZ",    "from": "IT",  "to": "DMZ", "app": ["ssh"],              "action": "allow", "log": True},
        {"id": 5, "name": "Bloqueo-IT-a-OT",   "from": "IT",  "to": "OT",  "app": ["any"],              "action": "deny",  "log": True},
    ]


def _zmatch(rule_zone, zone):
    return rule_zone in ("any", zone)


def _amatch(rule_apps, app):
    return "any" in rule_apps or app in rule_apps


class Firewall:
    def __init__(self, asset_id, name=""):
        self.asset_id = asset_id
        self.name = name or asset_id
        self.rules = default_rulebase()
        self.zones = ["IT", "DMZ", "OT"]
        self.traffic_log = []     # rolling [{ts,from,to,src,dst,app,action,rule}]
        self._seq = 0

    # ------------------------------------------------- evaluación
    def evaluate(self, from_zone, to_zone, app):
        """Devuelve (action, rule_name) por primera coincidencia; default deny."""
        for r in self.rules:
            if _zmatch(r.get("from", "any"), from_zone) and \
               _zmatch(r.get("to", "any"), to_zone) and \
               _amatch(r.get("app", ["any"]), app):
                return (r.get("action", "deny"), r.get("name", f"rule-{r.get('id')}"))
        return ("deny", "default-deny")

    def log(self, from_zone, to_zone, src, dst, app, action, rule):
        self._seq += 1
        self.traffic_log.append({
            "seq": self._seq, "ts": None,
            "from": from_zone, "to": to_zone, "src": src, "dst": dst,
            "app": app, "action": action, "rule": rule,
        })
        if len(self.traffic_log) > 200:
            self.traffic_log = self.traffic_log[-200:]

    # ------------------------------------------------- configuración
    def set_rules(self, rules):
        """Reemplaza el rulebase (commit desde la interfaz). Renumera ids."""
        clean = []
        for i, r in enumerate(rules or [], 1):
            apps = r.get("app") or ["any"]
            if isinstance(apps, str):
                apps = [a.strip() for a in apps.replace(";", ",").split(",") if a.strip()] or ["any"]
            clean.append({
                "id": i,
                "name": str(r.get("name", f"rule-{i}"))[:40],
                "from": str(r.get("from", "any")),
                "to": str(r.get("to", "any")),
                "app": apps,
                "action": "allow" if str(r.get("action", "deny")).lower() == "allow" else "deny",
                "log": bool(r.get("log", True)),
            })
        self.rules = clean
        return self.rules

    def counters(self):
        allowed = sum(1 for t in self.traffic_log if t["action"] == "allow")
        denied = sum(1 for t in self.traffic_log if t["action"] == "deny")
        return {"allowed": allowed, "denied": denied, "rules": len(self.rules)}

    def to_dict(self, mode="ENFORCING"):
        return {
            "asset_id": self.asset_id, "name": self.name, "mode": mode,
            "zones": self.zones, "rules": self.rules,
            "traffic": self.traffic_log[-80:], "counters": self.counters(),
        }