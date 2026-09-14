from simulation.equipment import (
    Equipment,
    EquipmentStatus,
)
from simulation.events import OTEvent
from simulation.plc import PLC
from simulation.process import ProcessState


class Plant:

    def __init__(self):

        self.name = "OT Manufacturing Plant"
        self.line = "Production Line 01"

        self.process = ProcessState()

        # ==================================================
        # PLC PRINCIPAL
        # ==================================================

        self.plc = PLC(

            asset_id="PLC-001",

            name="Production PLC 01",

            manufacturer="Siemens",

            model="S7-1500",

            ip_address="172.16.100.10",

            vlan=440,

            network="OT-PLC",

        )

        # ==================================================
        # INVENTARIO OT
        # ==================================================

        self.equipment = {

            "PLC-001": self.plc,

            "ENG-001": Equipment(
                asset_id="ENG-001",
                name="Engineering Station 01",
                equipment_type="Engineering Station",
                manufacturer="Siemens",
                model="Engineering Workstation",
                ip_address="172.16.101.10",
                vlan=901,
                network="OT-ENGINEERING",
                properties={
                    "role": "PLC Engineering",
                    "protocol": "S7 / Ethernet",
                },
            ),

            "HMI-001": Equipment(
                asset_id="HMI-001",
                name="Operator HMI 01",
                equipment_type="HMI",
                manufacturer="Siemens",
                model="Comfort Panel",
                ip_address="172.16.102.10",
                vlan=902,
                network="OT-HMI",
                properties={
                    "role": "Operator Interface",
                    "protocol": "Industrial Ethernet",
                },
            ),

            "GW-001": Equipment(
                asset_id="GW-001",
                name="Remote Gateway 01",
                equipment_type="eWON / Gateway",
                manufacturer="HMS Networks",
                model="eWON Flexy",
                ip_address="172.16.103.10",
                vlan=903,
                network="OT-GATEWAY",
                properties={
                    "role": "Remote Access Gateway",
                    "protocol": "Industrial Ethernet",
                },
            ),

            "SCADA-001": Equipment(
                asset_id="SCADA-001",
                name="SCADA Server 01",
                equipment_type="SCADA",
                manufacturer="AVEVA",
                model="System Platform",
                ip_address="172.16.104.10",
                vlan=904,
                network="OT-SERVERS",
                properties={
                    "role": "Supervisory Control",
                    "protocol": "OPC UA",
                },
            ),

            "M-001": Equipment(
                asset_id="M-001",
                name="Production Motor 01",
                equipment_type="Motor",
                manufacturer="Siemens",
                model="SIMOTICS",
                ip_address="172.16.107.10",
                vlan=800,
                network="OT-MACHINES",
                properties={
                    "role": "Production Drive",
                    "nominal_rpm": 1450,
                },
            ),

            "CNC-001": Equipment(
                asset_id="CNC-001",
                name="Machining Center 01",
                equipment_type="CNC",
                manufacturer="Haas",
                model="VF-2",
                ip_address="172.16.108.10",
                vlan=800,
                network="OT-MACHINES",
                properties={
                    "role": "Machining",
                    "production_cell": "Cell A",
                },
            ),

            "TT-001": Equipment(
                asset_id="TT-001",
                name="Temperature Sensor 01",
                equipment_type="Temperature Sensor",
                manufacturer="Siemens",
                model="SITRANS",
                ip_address="172.16.110.10",
                vlan=440,
                network="OT-PLC",
                properties={
                    "measurement": "Temperature",
                    "unit": "°C",
                },
            ),

            "PT-001": Equipment(
                asset_id="PT-001",
                name="Pressure Sensor 01",
                equipment_type="Pressure Sensor",
                manufacturer="Siemens",
                model="SITRANS P",
                ip_address="172.16.110.11",
                vlan=440,
                network="OT-PLC",
                properties={
                    "measurement": "Pressure",
                    "unit": "bar",
                },
            ),

            "V-001": Equipment(
                asset_id="V-001",
                name="Process Valve 01",
                equipment_type="Valve",
                manufacturer="Siemens",
                model="Industrial Control Valve",
                ip_address="172.16.111.10",
                vlan=440,
                network="OT-PLC",
                properties={
                    "measurement": "Valve Position",
                    "unit": "%",
                },
            ),
        }

        # ==================================================
        # EVENTS
        # ==================================================

        self.events = []

        self.add_event(
            event_type="SYSTEM",
            severity="INFO",
            source="SYSTEM",
            message=(
                "OT plant simulation initialized "
                "with industrial asset inventory"
            ),
        )

    # ======================================================
    # EVENTS
    # ======================================================

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

        self.events = self.events[-100:]

    # ======================================================
    # PROCESS UPDATE
    # ======================================================

    def update(self):

        self.process.update()

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

    # ======================================================
    # MOTOR
    # ======================================================

    def change_motor_speed(
        self,
        speed: float,
        source: str = "OPERATOR",
    ):

        self.process.change_motor_speed(speed)

        self.plc.write_register(
            "motor_speed",
            speed,
        )

        self.add_event(
            event_type="PLC_WRITE",
            severity="INFO",
            source=source,
            message=f"Motor speed set to {speed} RPM",
        )

        if speed < 500:

            self.plc.set_status(
                EquipmentStatus.COMPROMISED
            )

            self.add_event(
                event_type="PROCESS_ANOMALY",
                severity="CRITICAL",
                source="PROCESS",
                message=(
                    "Critical motor speed detected"
                ),
            )

            self.add_event(
                event_type="PRODUCTION_IMPACT",
                severity="CRITICAL",
                source="PROCESS",
                message=(
                    "Production line stopped"
                ),
            )

    # ======================================================
    # VALVE
    # ======================================================

    def change_valve_position(
        self,
        position: float,
        source: str = "OPERATOR",
    ):

        self.process.change_valve_position(
            position
        )

        self.plc.write_register(
            "valve_position",
            position,
        )

        self.add_event(
            event_type="PLC_WRITE",
            severity="INFO",
            source=source,
            message=(
                f"Valve position set to {position}%"
            ),
        )

        if position < 10 or position > 90:

            self.plc.set_status(
                EquipmentStatus.COMPROMISED
            )

            self.add_event(
                event_type="PROCESS_ANOMALY",
                severity="HIGH",
                source="PROCESS",
                message=(
                    "Abnormal valve position detected"
                ),
            )

    # ======================================================
    # STOP PRODUCTION
    # ======================================================

    def stop_production(
        self,
        source: str = "OPERATOR",
    ):

        self.process.stop()

        self.plc.stop()

        self.equipment["CNC-001"].set_status(
            EquipmentStatus.OFFLINE
        )

        self.equipment["M-001"].set_status(
            EquipmentStatus.OFFLINE
        )

        self.add_event(
            event_type="PROCESS_STOP",
            severity="CRITICAL",
            source=source,
            message="Production line stopped",
        )

    # ======================================================
    # RESUME PRODUCTION
    # ======================================================

    def resume_production(self):

        self.process.resume()

        self.plc.run()

        self.equipment["CNC-001"].set_status(
            EquipmentStatus.ONLINE
        )

        self.equipment["M-001"].set_status(
            EquipmentStatus.ONLINE
        )

        self.add_event(
            event_type="PROCESS_RECOVERY",
            severity="INFO",
            source="OPERATOR",
            message="Production line resumed",
        )

    # ======================================================
    # INVENTORY
    # ======================================================

    def get_inventory(self):

        return [
            equipment.get_info()
            for equipment in self.equipment.values()
        ]

    # ======================================================
    # COMPLETE STATE
    # ======================================================

    def get_state(self):

        return {

            "plant": {

                "name": self.name,

                "line": self.line,

                "status": (
                    "RUNNING"
                    if self.process.production_running
                    else "STOPPED"
                ),

            },

            "process":
                self.process.get_state(),

            "plc":
                self.plc.get_state(),

            "equipment":
                self.get_inventory(),

            "events": [

                event.to_dict()

                for event
                in self.events[-20:]

            ],

        }