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
        if prog in ("s7-stop", "s7stop"):   return self._s7_stop(parts[1:])
        if prog == "msfconsole":            return "msf6 > (usa: s7-stop <ip> para una prueba de concepto)"
        return f"{prog}: command not found  (escribe 'help')"

    # -------------------------------------------------- comandos
    def _help(self):
        return (
            "Comandos disponibles (Kali @ OT Cyber Range):\n"
            "  help                      esta ayuda\n"
            "  ifconfig | whoami         info de la máquina atacante\n"
            "  ping <ip>                 prueba de alcance\n"
            "  nmap -sn <red>            descubrimiento de hosts\n"
            "  nmap -sV <ip|red>         escaneo de puertos/servicios\n"
            "  nmap --script s7-info <ip>  enumeración de PLC Siemens\n"
            "  plcscan <ip>              enumeración de PLC\n"
            "  s7-stop <ip>              PoC: envía STOP a la CPU (¡consecuencia real!)\n"
            "  clear                     limpia la pantalla\n"
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
            sub = tok.rsplit(".", 1)[0] if "/" in tok or tok.count(".") == 3 else tok
            hosts = [h for h in hosts if h.ip == tok or h.id == tok or h.ip.startswith(sub)]

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