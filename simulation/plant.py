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

    # =========================================================
    # INVENTORY
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

            "equipment": [
                equipment.get_info()
                for equipment in self.equipment
            ],

            "events": [
                event.to_dict()
                for event in self.events[-50:]
            ],

        }