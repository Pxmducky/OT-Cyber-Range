from simulation.equipment import (
    Equipment,
    EquipmentStatus
)


class PLC(Equipment):

    def __init__(
        self,
        asset_id: str,
        name: str,
        manufacturer: str,
        model: str,
        ip_address: str,
        vlan: int,
        network: str,
    ):

        super().__init__(
            asset_id=asset_id,
            name=name,
            equipment_type="PLC",
            manufacturer=manufacturer,
            model=model,
            ip_address=ip_address,
            vlan=vlan,
            network=network,
        )

        self.cpu_state = "RUN"

        self.protocol = "Modbus TCP"

        self.modbus_port = 502

        self.inputs = {

            "I0.0": False,
            "I0.1": False,
            "I0.2": False,

        }

        self.outputs = {

            "Q0.0": True,
            "Q0.1": True,
            "Q0.2": False,

        }

        self.registers = {

            "temperature": 68.0,
            "pressure": 3.8,
            "motor_speed": 1450.0,
            "valve_position": 50.0,

        }

    def read_register(
        self,
        register: str
    ):

        if register not in self.registers:

            raise ValueError(
                f"Unknown register: {register}"
            )

        return self.registers[register]

    def write_register(
        self,
        register: str,
        value: float
    ):

        if register not in self.registers:

            raise ValueError(
                f"Unknown register: {register}"
            )

        self.registers[register] = value

    def stop(self):

        self.cpu_state = "STOP"

        self.outputs["Q0.0"] = False
        self.outputs["Q0.1"] = False

        self.set_status(
            EquipmentStatus.WARNING
        )

    def run(self):

        self.cpu_state = "RUN"

        self.outputs["Q0.0"] = True
        self.outputs["Q0.1"] = True

        self.set_status(
            EquipmentStatus.ONLINE
        )

    def get_state(self):

        return {

            "equipment":
                self.get_info(),

            "cpu_state":
                self.cpu_state,

            "protocol":
                self.protocol,

            "modbus_port":
                self.modbus_port,

            "inputs":
                self.inputs,

            "outputs":
                self.outputs,

            "registers":
                self.registers,

        }
        