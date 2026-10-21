"""
attacker.py — Consola Kali simulada del OT Cyber Range.

Interpreta comandos (nmap, plcscan, ping, s7-stop, …) y produce resultados
REALES derivados de la topología cargada desde el Excel y del estado de
seguridad de la planta (firewall, segmentación, eWON comprometido).

Principio pedagógico:
  - Sin segmentación / firewall en BYPASS / eWON comprometido  ->  el ataque es fácil.
  - Con firewall ENFORCING protegiendo OT                      ->  los equipos OT
    aparecen FILTRADOS y el alumno debe debilitar la seguridad antes de avanzar.
  - Las acciones destructivas (p.ej. parar un PLC) tienen CONSECUENCIAS REALES
    en la simulación (cascada + alarmas en el SIEM).

Sandbox: no ejecuta nada del host. Todo es texto generado a partir del modelo.
"""

PROTO_PORT = {
    "S7COMM": 102, "S7": 102, "OPC-UA": 4840, "OPCUA": 4840, "MODBUS": 502,
    "ETHERNET/IP": 44818, "ETHERNETIP": 44818, "DNP3": 20000, "PROFINET": 34962,
    "HTTP": 80, "HTTPS": 443, "SSH": 22, "RDP": 3389, "SMB": 445, "FTP": 21,
    "SNMP": 161, "MQTT": 1883,
}
PROTO_SVC = {
    "S7COMM": "iso-tsap  Siemens S7 PLC", "S7": "iso-tsap  Siemens S7 PLC",
    "OPC-UA": "opcua  OPC-UA server", "OPCUA": "opcua  OPC-UA server",
    "MODBUS": "modbus  Modbus TCP", "ETHERNET/IP": "enip  EtherNet/IP",
    "ETHERNETIP": "enip  EtherNet/IP", "DNP3": "dnp3  DNP3", "PROFINET": "profinet",
    "HTTP": "http  web HMI", "HTTPS": "ssl/http", "SSH": "ssh  OpenSSH 8.4",
    "RDP": "ms-wbt-server", "SMB": "microsoft-ds", "FTP": "ftp  vsftpd",
    "SNMP": "snmp  net-snmp", "MQTT": "mqtt  mosquitto",
}

import re
from datetime import datetime


def _now_str():
    return datetime.now().strftime("%a %b %d %H:%M:%S %Y")
from simulation.firewall import app_of

# Categorías consideradas "OT" (protegidas por el firewall perimetral).
OT_CATS = {"plc", "motor", "pump", "valve", "sensor", "machine", "hmi", "scada"}


def _port(p): return PROTO_PORT.get(p.upper().replace(" ", ""), PROTO_PORT.get(p.upper()))
def _svc(p):  return PROTO_SVC.get(p.upper().replace(" ", ""), PROTO_SVC.get(p.upper(), "unknown"))


class AttackerConsole:
    def __init__(self, plant):
        self.plant = plant
        self.ip = "192.168.100.66"      # Kali en IT/corporativo
        self.zone = "IT"
        self.files = {}                 # mini-FS en memoria para nano/echo/cat/ls

    # -------------------------------------------------- postura de seguridad
    def posture(self):
        """(segmented, reason, pivot) según las reglas reales del firewall."""
        rt = self.plant.assets_runtime
        pivot = any(ap.category == "gateway" and ap.state.get("compromised") for ap in rt.values())
        if pivot:
            return (False, "pivote vía eWON comprometido", True)
        fid = self.plant.perimeter_firewall()
        if not fid:
            return (False, "red plana sin firewall", False)
        mode = rt[fid].state.get("mode", "ENFORCING")
        if mode in ("BYPASS", "DISABLED"):
            return (False, "firewall en BYPASS", False)
        # ¿el firewall permite IT->OT de forma amplia? -> no segmentado
        action, _ = self.plant.firewalls[fid].evaluate("IT", "OT", "any")
        if action == "allow":
            return (False, "regla IT->OT demasiado permisiva", False)
        return (True, "firewall ENFORCING", False)

    def _from_zone(self):
        _, _, pivot = self.posture()
        return "OT" if pivot else self.zone

    def _allowed(self, ap, app="any", log=False):
        """¿El firewall permite el atacante -> ap para esa app?"""
        action, _ = self.plant.firewall_eval(
            self._from_zone(), self.plant.zone_of(ap.id), app,
            src=self.ip, dst=ap.ip, do_log=log,
        )
        return action == "allow"

    def _reachable(self, ap):
        # host alcanzable si el firewall permite al menos 'any' o ping
        return self._allowed(ap, "any") or self._allowed(ap, "ping")

    def _find(self, token):
        """Resuelve un token a un activo por IP o por ID."""
        token = (token or "").strip()
        for ap in self.plant.assets_runtime.values():
            if ap.ip == token or ap.id == token:
                return ap
        return None

    def _hosts(self):
        return [ap for ap in self.plant.assets_runtime.values() if ap.ip]

    # -------------------------------------------------- ejecutar comando
    def execute(self, command):
        cmd = (command or "").strip()
        if not cmd:
            return ""
        parts = cmd.split()
        prog = parts[0].lower()

        if prog in ("help", "?"):           return self._help()
        if prog == "clear":                 return "__CLEAR__"
        if prog in ("whoami", "id"):        return "root"
        if prog == "ifconfig":              return self._ifconfig()
        if prog == "ping":                  return self._ping(parts[1:])
        if prog == "nmap":                  return self._nmap(parts[1:])
        if prog in ("plcscan", "s7scan"):   return self._plcscan(parts[1:])
        if prog in ("s7-read", "s7read", "s7-dump"): return self._s7read(parts[1:])
        if prog in ("s7-stop", "s7stop"):   return self._s7_stop(parts[1:])
        if prog in ("modbus-read", "modread"):   return self._modbus(parts[1:], write=False)
        if prog in ("modbus-write", "modwrite"): return self._modbus(parts[1:], write=True)
        if prog in ("opcua-browse", "opcua"):    return self._opcua(parts[1:])
        if prog in ("curl", "wget", "hmi-login"):return self._http(parts[1:])
        if prog in ("dos", "ddos", "flood"):     return self._dos(parts[1:])
        if prog in ("hydra", "bruteforce"):      return self._hydra(parts[1:])
        if prog in ("arpspoof", "mitm", "ettercap"): return self._mitm(parts[1:])
        if prog == "msfconsole":            return "msf6 > consola Metasploit simulada. Usa los comandos del lab (help)."
        if prog == "pwd":                   return "/root"
        if prog == "uname":                 return ("Linux kali 6.8.0-kali7-amd64 #1 SMP x86_64 GNU/Linux"
                                                     if "-a" in parts else "Linux")
        if prog == "date":                  return _now_str()
        if prog == "ls":                    return self._ls(parts[1:])
        if prog == "cat":                   return self._cat(parts[1:])
        if prog == "rm":                    return self._rm(parts[1:])
        if prog == "echo":                  return self._echo(cmd, parts)
        if prog in ("nano", "vi", "vim", "edit"): return self._edit(parts[1:])
        return f"{prog}: command not found  (escribe 'help')"

    # -------------------------------------------------- comandos
    def _help(self):
        return (
            "Comandos (Kali @ OT Cyber Range) — reemplaza <ip> por la IP real de tu lab:\n"
            "  RECON\n"
            "    ifconfig | whoami           info de la máquina atacante\n"
            "    ping <ip>                   prueba de alcance\n"
            "    nmap -sn <red>              descubrimiento de hosts\n"
            "    nmap -sV <ip|red>           escaneo de puertos/servicios\n"
            "    nmap --script s7-info <ip>  enumeración de PLC Siemens\n"
            "    plcscan <ip>                enumeración de PLC (S7comm)\n"
            "    opcua-browse <ip>           enumeración OPC-UA (SCADA/HMI)\n"
            "  ACCESO / CREDENCIALES\n"
            "    hydra <ip> <servicio>       fuerza bruta (ssh/http/rdp)\n"
            "    curl <ip>  |  hmi-login <ip> [user] [pass]   web/HMI\n"
            "    arpspoof <ip1> <ip2>        MITM entre dos equipos\n"
            "  ATAQUE / CONSECUENCIA REAL\n"
            "    s7-stop <ip>                STOP a una CPU Siemens\n"
            "    modbus-write <ip> <reg> <val>   escribe un registro (mueve actuadores)\n"
            "    modbus-read <ip> <reg>      lee un registro\n"
            "    dos <ip>                    denegación de servicio (deja el equipo fuera)\n"
            "  ARCHIVOS / EDITOR\n"
            "    ls | cat <f> | rm <f>       lista / muestra / borra archivos del lab\n"
            "    echo 'texto' > <f>          crea un archivo  (>> para agregar)\n"
            "    nano <f> | vi <f>           abre el editor (panel Script) con ese archivo\n"
            "    pwd | uname -a | date       utilidades del sistema\n"
            "  SCRIPTS\n"
            "    Usa el botón 'Script' (o 'nano') para editar y ejecutar tu propio código.\n"
            "    clear                       limpia la pantalla\n"
        )

    def _ifconfig(self):
        return (f"eth0: inet {self.ip}  netmask 255.255.255.0\n"
                f"      zona: {self.zone} (corporativa)\n"
                f"      Kali GNU/Linux Rolling")

    def _ping(self, args):
        if not args:
            return "ping: usage: ping <ip>"
        ap = self._find(args[0])
        if not ap:
            return f"ping: {args[0]}: Name or service not known"
        if not self._reachable(ap):
            seg, reason, _ = self.posture()
            return (f"PING {ap.ip} ...\n"
                    f"Request timed out.  (bloqueado: {reason})\n"
                    f"--- {ap.ip} ping statistics ---\n"
                    f"4 packets transmitted, 0 received, 100% packet loss")
        return (f"PING {ap.ip} 56 bytes of data.\n"
                f"64 bytes from {ap.ip}: icmp_seq=1 ttl=64 time=0.8 ms\n"
                f"--- {ap.ip} ping statistics ---\n"
                f"4 packets transmitted, 4 received, 0% packet loss")

    def _nmap(self, args):
        flags = [a for a in args if a.startswith("-")]
        script = None
        if "--script" in args:
            i = args.index("--script")
            if i + 1 < len(args):
                script = args[i + 1]
        targets_tokens = [a for a in args if not a.startswith("-") and a != script]
        if script and "s7" in (script or ""):
            # nmap --script s7-info <ip> == enumeración PLC
            return self._plcscan([targets_tokens[-1]] if targets_tokens else [])

        mode = "sn" if "-sn" in flags else "ports" if "-p-" in flags else "sV"
        hosts = self._hosts()
        if targets_tokens:
            tok = targets_tokens[-1]
            if "/" in tok:                       # red CIDR (p.ej. 10.10.10.0/24) -> subred /24
                sub = tok.split("/")[0].rsplit(".", 1)[0]
                hosts = [h for h in hosts if h.ip.startswith(sub + ".")]
            else:                                # IP o id único -> SOLO ese host
                hosts = [h for h in hosts if h.ip == tok or h.id == tok]

        seg, reason, pivot = self.posture()
        banner = f"Starting Nmap 7.94 ( {self.ip} )  [postura: {'SEGMENTADA' if seg and not pivot else 'ABIERTA'} — {reason}]"
        out = [banner, ""]
        up = 0
        filtered_ot = 0
        self.plant.add_event("RECON_NMAP", "WARNING", "ATTACKER",
                             f"Escaneo nmap desde {self.ip} ({mode})")

        for h in hosts:
            # ¿algún puerto/servicio permitido por el firewall?
            ports_all = [(p, _port(p)) for p in h.protocols]
            ports_all = [(p, pt) for p, pt in ports_all if pt]
            port_states = [(p, pt, self._allowed(h, app_of(p), log=True)) for p, pt in ports_all]
            host_up = any(st for _, _, st in port_states) or self._allowed(h, "ping")

            if not host_up:
                filtered_ot += 1
                out.append(f"Nmap scan report for {h.id} ({h.ip})")
                out.append("Host seems down (todos los puertos filtrados por el firewall). Prueba -Pn.")
                out.append("")
                continue
            up += 1
            out.append(f"Nmap scan report for {h.id} ({h.ip})")
            out.append(f"Host is up (0.0010s latency).   [{h.type}]")
            if mode != "sn":
                if not port_states:
                    out.append("  (sin puertos OT conocidos)")
                else:
                    out.append("  PORT       STATE     SERVICE" + ("    VERSION" if mode == "sV" else ""))
                    for p, pt, allowed in port_states:
                        state = "open    " if allowed else "filtered"
                        line = f"  {str(pt)+'/tcp':<10} {state}  {p.lower():<8}"
                        if mode == "sV" and allowed:
                            line += "  " + _svc(p)
                        out.append(line)
            out.append("")

        out.append(f"Nmap done: {len(hosts)} IP(s) — {up} up, {filtered_ot} filtradas")
        if filtered_ot and seg and not pivot:
            out.append("")
            out.append(">> Los equipos OT están protegidos por el firewall.")
            out.append(">> Para avanzar: pon el firewall en BYPASS, agrega una regla PERMIT,")
            out.append(">> o compromete el eWON para pivotar a la red OT.")
        return "\n".join(out)

    def _plcscan(self, args):
        if not args:
            return "plcscan: usage: plcscan <ip>"
        ap = self._find(args[0])
        if not ap:
            return f"plcscan: {args[0]}: host desconocido"
        if ap.category != "plc":
            return f"plcscan: {ap.id} ({ap.ip}) no es un PLC (tipo: {ap.type})"
        if not self._allowed(ap, "s7comm", log=True):
            seg, reason, _ = self.posture()
            return (f"plcscan {ap.ip}\n"
                    f"  conexión al puerto 102/tcp rechazada / filtrada ({reason}).\n"
                    f"  El firewall bloquea S7comm desde la zona {self._from_zone()}.")
        self.plant.add_event("RECON_PLC_ENUM", "HIGH", "ATTACKER",
                             f"Enumeración S7 de {ap.id} desde {self.ip}")
        cpu = ap.state.get("cpu_state", "RUN")
        return (f"plcscan {ap.ip}  (puerto 102/tcp S7comm)\n"
                f"  Device:        {ap.id}  {ap.name}\n"
                f"  Type:          {ap.type}\n"
                f"  Vendor:        {ap.vendor or 'Siemens'}\n"
                f"  Model:         {ap.model or 'S7-1500'}\n"
                f"  Firmware:      {ap.firmware or 'V2.9'}\n"
                f"  CPU state:     {cpu}\n"
                f"  Protection:    {'none (sin contraseña)' }\n"
                f"  >> Vulnerable: la CPU acepta comandos STOP/START sin autenticación.")

    def _s7read(self, args):
        """Vuelca los bloques de datos (DB) del PLC: las variables de proceso
        que gobiernan la línea. 'Descifrar' lo que el PLC está controlando."""
        if not args:
            return "uso: s7-read <ip>   (lee los bloques de datos / variables del PLC)"
        ap = self._find(args[0])
        if not ap or ap.category != "plc":
            return f"s7-read: {args[0]}: no es un PLC alcanzable"
        if not self._allowed(ap, "s7comm", log=True):
            _, reason, _ = self.posture()
            return f"s7-read {ap.ip}: 102/tcp filtrado por el firewall ({reason}). Sin acceso a los DB."
        self.plant.add_event("RECON_PLC_READ", "HIGH", "ATTACKER",
                             f"Volcado de variables (DB) de {ap.id} desde {self.ip}")
        lines = [
            f"s7-read {ap.ip}  (102/tcp S7comm — lectura de bloques de datos)",
            f"  CPU: {ap.state.get('cpu_state','RUN')}   modo: {ap.state.get('mode','REMOTE')}"
            f"   scan: {ap.state.get('scan_ms',12.0)} ms   forces: {ap.state.get('forces',0)}",
            "  Variables de proceso (DB en claro, sin autenticación):",
        ]
        found = False
        for tid in sorted(self.plant._downstream(ap.id)):
            t = self.plant.assets_runtime.get(tid)
            if not t:
                continue
            st, c = t.state, t.category
            if c == "motor":
                lines.append(f"    DB1  {t.id:<16} MOTOR_SPEED    = {st.get('speed',0):7.0f} rpm  (SP {st.get('setpoint',0):.0f})"); found = True
            elif c == "pump":
                lines.append(f"    DB1  {t.id:<16} FLOW           = {st.get('flow',0):7.0f}      (SP {st.get('setpoint',0):.0f})"); found = True
            elif c == "valve":
                lines.append(f"    DB2  {t.id:<16} VALVE_POSITION = {st.get('position',0):7.0f} %"); found = True
            elif c == "sensor":
                lines.append(f"    DB3  {t.id:<16} {str(st.get('value',0)):>7} {st.get('unit','')}"); found = True
        if not found:
            lines.append("    (sin actuadores/sensores aguas abajo en la topología del Excel)")
        lines.append("  >> Variables escribibles: pueden forzarse (modbus-write) o detenerse (s7-stop).")
        return "\n".join(lines)

    def _s7_stop(self, args):
        if not args:
            return "s7-stop: usage: s7-stop <ip>"
        ap = self._find(args[0])
        if not ap or ap.category != "plc":
            return f"s7-stop: {args[0]}: no es un PLC alcanzable"
        if not self._allowed(ap, "s7comm", log=True):
            seg, reason, _ = self.posture()
            return f"s7-stop {ap.ip}: 102/tcp filtrado por el firewall ({reason}). Sin acceso a la CPU."
        # CONSECUENCIA REAL: detiene el PLC -> cascada a equipos conectados
        self.plant.apply_equipment_action(ap.id, ap.type, "STOP")
        return (f"s7-stop {ap.ip}\n"
                f"  [+] Conectado a {ap.id} (102/tcp)\n"
                f"  [+] Enviando S7 STOP a la CPU...\n"
                f"  [!] CPU DETENIDA. La línea de producción se detuvo.\n"
                f"  [!] Consecuencia: motores/válvulas aguas abajo fuera de servicio.\n"
                f"  [!] El SIEM registró el evento y disparó alarmas.")

    # ---------- MODBUS ----------
    def _modbus(self, args, write=False):
        if (write and len(args) < 3) or (not write and len(args) < 2):
            return "uso: modbus-write <ip> <reg> <val>  |  modbus-read <ip> <reg>"
        ap = self._find(args[0])
        if not ap:
            return f"modbus: {args[0]}: host desconocido"
        if not self._allowed(ap, "modbus", log=True):
            _, reason, _ = self.posture()
            return f"modbus {ap.ip}: 502/tcp filtrado por el firewall ({reason})."
        reg = args[1]
        if not write:
            val = None
            if ap.category in ("motor", "pump"):
                val = int(ap.state.get("speed" if ap.category=="motor" else "flow", 0))
            elif ap.category == "valve":
                val = int(ap.state.get("position", 0))
            self.plant.add_event("MODBUS_READ", "WARNING", ap.id, f"Lectura Modbus reg {reg} desde {self.ip}")
            return f"modbus-read {ap.ip} reg[{reg}] = {val if val is not None else 0}"
        value = args[2]
        try: v = float(value)
        except ValueError: return "modbus-write: el valor debe ser numérico"
        # CONSECUENCIA REAL: escribir un registro mueve el actuador
        act = None
        if ap.category in ("motor", "pump"): act = "SPEED"
        elif ap.category == "valve":         act = "POSITION"
        if act:
            self.plant.apply_equipment_action(ap.id, ap.type, act, value=v)
            return (f"modbus-write {ap.ip} reg[{reg}] <- {v:.0f}\n"
                    f"  [!] Actuador {ap.id} modificado SIN autenticación.\n"
                    f"  [!] Consecuencia real en el proceso + evento en el SIEM.")
        self.plant.add_event("MODBUS_WRITE", "HIGH", ap.id, f"Escritura Modbus reg {reg}={v} desde {self.ip}")
        return f"modbus-write {ap.ip} reg[{reg}] <- {v:.0f}  (registro escrito)"

    # ---------- OPC-UA ----------
    def _opcua(self, args):
        if not args: return "uso: opcua-browse <ip>"
        ap = self._find(args[0])
        if not ap: return f"opcua: {args[0]}: host desconocido"
        if not self._allowed(ap, "opcua", log=True):
            _, reason, _ = self.posture()
            return f"opcua {ap.ip}: 4840/tcp filtrado por el firewall ({reason})."
        self.plant.add_event("RECON_OPCUA", "WARNING", ap.id, f"Enumeración OPC-UA de {ap.id} desde {self.ip}")
        tags = {
            "scada": ["ns=2;Process.Temperature", "ns=2;Process.Pressure", "ns=2;Line.Running", "ns=2;Alarms.Active"],
            "historian": ["ns=2;Hist.Temperature", "ns=2;Hist.Throughput"],
        }.get(ap.category, ["ns=2;Device.Status", "ns=2;Device.Mode"])
        body = "\n".join(f"    {t}  (RW)" for t in tags)
        return (f"opcua-browse opc.tcp://{ap.ip}:4840\n"
                f"  Endpoint: {ap.vendor or 'Server'} ({ap.id})\n"
                f"  SecurityPolicy: None  (¡sin cifrado!)\n"
                f"  Nodos:\n{body}\n"
                f"  >> Vulnerable: anónimo permitido, nodos escribibles.")

    # ---------- HTTP / HMI ----------
    def _http(self, args):
        if not args: return "uso: curl <ip>   |   hmi-login <ip> [user] [pass]"
        ap = self._find(args[0])
        if not ap: return f"curl: {args[0]}: host desconocido"
        if not (self._allowed(ap, "web-browsing", log=True) or self._allowed(ap, "ssl")):
            _, reason, _ = self.posture()
            return f"curl {ap.ip}: 80/443 filtrado por el firewall ({reason})."
        user = args[1] if len(args) > 1 else "admin"
        pwd  = args[2] if len(args) > 2 else "admin"
        self.plant.add_event("HTTP_ACCESS", "WARNING", ap.id, f"Acceso web a {ap.id} desde {self.ip} ({user})")
        weak = pwd in ("admin", "1234", "password", "siemens", "")
        if ap.category in ("hmi", "scada", "gateway", "server", "historian", "mes"):
            auth = ("  [+] Login OK (credenciales por defecto admin/admin)\n"
                    "  [!] Acceso al panel: puedes leer/forzar variables del proceso."
                    if weak else "  [-] Login fallido.")
            return f"GET http://{ap.ip}/  →  200 OK  ({ap.type} web UI)\n{auth}"
        return f"GET http://{ap.ip}/  →  200 OK  (interfaz web de {ap.type})"

    # ---------- DoS ----------
    def _dos(self, args):
        if not args: return "uso: dos <ip>"
        ap = self._find(args[0])
        if not ap: return f"dos: {args[0]}: host desconocido"
        if not self._reachable(ap):
            _, reason, _ = self.posture()
            return f"dos {ap.ip}: host no alcanzable ({reason})."
        # CONSECUENCIA REAL por categoría
        c = ap.category
        if c in ("motor", "pump", "machine", "scada", "server", "mes", "historian"):
            self.plant.apply_equipment_action(ap.id, ap.type, "STOP")
        elif c == "plc":
            self.plant.apply_equipment_action(ap.id, ap.type, "STOP")
        elif c == "sensor":
            self.plant.apply_equipment_action(ap.id, ap.type, "FAULT")
        elif c == "valve":
            self.plant.apply_equipment_action(ap.id, ap.type, "CLOSE")
        else:
            ap.status = "OFFLINE"; ap.activity = "attack"
        self.plant.add_event("DOS_ATTACK", "CRITICAL", ap.id, f"Inundación SYN contra {ap.id} desde {self.ip}")
        return (f"dos {ap.ip}  (SYN flood, 50k pps)\n"
                f"  [!] {ap.id} dejó de responder — denegación de servicio.\n"
                f"  [!] Consecuencia real en el proceso + alarma crítica en el SIEM.")

    # ---------- Fuerza bruta ----------
    def _hydra(self, args):
        if len(args) < 1: return "uso: hydra <ip> <servicio>  (ssh/http/rdp/ftp)"
        ap = self._find(args[0])
        if not ap: return f"hydra: {args[0]}: host desconocido"
        svc = (args[1] if len(args) > 1 else "ssh").lower()
        app = {"ssh":"ssh","http":"web-browsing","rdp":"ms-rdp","ftp":"ftp"}.get(svc, svc)
        if not self._allowed(ap, app, log=True):
            _, reason, _ = self.posture()
            return f"hydra {ap.ip} {svc}: servicio filtrado por el firewall ({reason})."
        self.plant.add_event("BRUTEFORCE", "HIGH", ap.id, f"Fuerza bruta {svc} contra {ap.id} desde {self.ip}")
        return (f"Hydra v9.5 — {svc}://{ap.ip}\n"
                f"  [ATTEMPT] admin:admin ...\n"
                f"  [22][{svc}] host: {ap.ip}   login: admin   password: admin\n"
                f"  [+] 1 de 1 objetivo completado — credenciales débiles encontradas.")

    # ---------- MITM ----------
    def _mitm(self, args):
        if len(args) < 2: return "uso: arpspoof <ip1> <ip2>"
        a, b = self._find(args[0]), self._find(args[1])
        if not a or not b: return "arpspoof: uno de los hosts no existe"
        self.plant.add_event("MITM", "HIGH", a.id, f"ARP spoofing {a.id} <-> {b.id} desde {self.ip}")
        return (f"arpspoof: interceptando {a.ip} <-> {b.ip}\n"
                f"  [+] Envenenando tablas ARP...\n"
                f"  [+] Tráfico {a.id}<->{b.id} redirigido por {self.ip}.\n"
                f"  >> Ahora puedes leer/alterar la comunicación entre ambos.")

    # =========================================================
    # MINI-SISTEMA DE ARCHIVOS (nano / echo / cat / ls / rm)
    # Todo vive en memoria del laboratorio; nunca toca el host.
    # =========================================================
    def _ls(self, args):
        if not self.files:
            return "(directorio vacío — crea un archivo con: echo '...' > archivo  o  nano archivo)"
        return "  ".join(sorted(self.files))

    def _cat(self, args):
        if not args:
            return "uso: cat <archivo>"
        f = args[0]
        if f not in self.files:
            return f"cat: {f}: no existe ese archivo"
        return self.files[f]

    def _rm(self, args):
        if not args:
            return "uso: rm <archivo>"
        f = args[0]
        if f in self.files:
            del self.files[f]
            return ""
        return f"rm: {f}: no existe ese archivo"

    def _echo(self, raw, parts):
        # echo texto                 -> imprime
        # echo texto > archivo       -> escribe (reemplaza)
        # echo texto >> archivo      -> agrega
        body = raw[len(parts[0]):].strip()
        fname, append = None, False
        if ">>" in body:
            body, fname = body.split(">>", 1); append = True
        elif ">" in body:
            body, fname = body.split(">", 1)
        text = body.strip().strip('"').strip("'")
        if fname is None:
            return text
        fname = fname.strip()
        if not fname:
            return "echo: falta el nombre de archivo tras '>'"
        if append and fname in self.files:
            self.files[fname] += "\n" + text
        else:
            self.files[fname] = text
        return ""   # como en bash: la redirección no imprime nada

    def _edit(self, args):
        """nano/vi <archivo>: abre el editor del panel Script con el contenido
        del archivo (o vacío). El frontend intercepta el marcador __EDIT__."""
        fname = args[0] if args else "exploit.sh"
        content = self.files.get(fname, "")
        return f"__EDIT__\t{fname}\t{content}"

    # =========================================================
    # EJECUCIÓN DE SCRIPTS DEL USUARIO (sandbox)
    # =========================================================
    def run_script(self, text):
        """Ejecuta un script propio: variables + comandos del lab + traducción
        de idioms de Python (pymodbus/snap7/requests) a efectos del lab.
        Nunca ejecuta código del host."""
        out = ["[*] Ejecutando script en el sandbox del laboratorio...", ""]
        variables = {}
        last_ip = None
        CMDS = ("ifconfig","whoami","ping","nmap","plcscan","s7scan","s7-read","s7read","s7-stop","s7stop",
                "modbus-read","modbus-write","opcua-browse","opcua","curl","wget","hmi-login",
                "dos","ddos","flood","hydra","bruteforce","arpspoof","mitm","ettercap","help","clear")
        for raw in (text or "").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or line.startswith("//"):
                continue
            # asignación de variable  NOMBRE = valor
            m = re.match(r"^([A-Za-z_]\w*)\s*=\s*(.+)$", line)
            if m and m.group(1).lower() not in CMDS and "(" not in m.group(2):
                variables[m.group(1)] = m.group(2).strip().strip("\"'")
                out.append(f"[var] {m.group(1)} = {variables[m.group(1)]}")
                continue
            # sustitución de variables $VAR / {VAR}
            for k, v in variables.items():
                line = line.replace(f"${k}", v).replace("{" + k + "}", v)
            # recordar la última IP vista
            ipm = re.search(r"(\d{1,3}(?:\.\d{1,3}){3})", line)
            if ipm: last_ip = ipm.group(1)
            # ¿ya es un comando del lab?
            first = line.split()[0].lower() if line.split() else ""
            if first in CMDS:
                out.append(f"root@kali:~# {line}")
                res = self.execute(line)
                if res != "__CLEAR__":
                    out.append(res)
                continue
            # traducir idioms de Python a comandos del lab
            mapped = self._map_python(line, last_ip)
            if mapped:
                out.append(f"root@kali:~# {mapped}")
                out.append(self.execute(mapped))
            else:
                out.append(f"[py] {line}   (línea no ejecutable en sandbox, ignorada)")
        out.append("")
        out.append("[*] Script finalizado.")
        return "\n".join(out)

    def _map_python(self, line, last_ip):
        l = line
        # pymodbus: client.write_register(addr, value)
        m = re.search(r"write_register\s*\(\s*(\d+)\s*,\s*(\d+)", l)
        if m and last_ip: return f"modbus-write {last_ip} {m.group(1)} {m.group(2)}"
        m = re.search(r"read_(?:holding_registers|register)\s*\(\s*(\d+)", l)
        if m and last_ip: return f"modbus-read {last_ip} {m.group(1)}"
        # snap7 / S7: plc.read_area() / db_read() -> volcado de DB
        if re.search(r"read_area|db_read|read_db|\.get_db", l, re.I) and last_ip:
            return f"s7-read {last_ip}"
        # snap7 / S7: plc.stop(), cpu stop
        if re.search(r"\.stop\s*\(\)|s7.*stop|cpu.*stop", l, re.I) and last_ip:
            return f"s7-stop {last_ip}"
        # requests.get('http://ip')
        m = re.search(r"https?://([\d.]+)", l)
        if m and re.search(r"requests\.|urlopen|curl|get\(", l, re.I):
            return f"curl {m.group(1)}"
        # socket.connect((ip, port))
        m = re.search(r"connect\s*\(\s*\(?\s*['\"]([\d.]+)['\"]\s*,\s*(\d+)", l)
        if m: return f"nmap -sV {m.group(1)}"
        return None