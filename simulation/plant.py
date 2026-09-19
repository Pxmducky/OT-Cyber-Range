from simulation.equipment import (
    Equipment,
    EquipmentStatus,
)

from simulation.plc import PLC
from simulation.process import ProcessState
from simulation.events import OTEvent
from simulation.plc_program import PLCProgram
from simulation.plc_runtime import PLCRuntime


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
        return self.plc_program.to_dict()

    def get_plc_program(self):
        return self.plc_program.to_dict()

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

            "equipment": [
                equipment.get_info()
                for equipment in self.equipment
            ],

            "events": [
                event.to_dict()
                for event in self.events[-50:]
            ],

        }