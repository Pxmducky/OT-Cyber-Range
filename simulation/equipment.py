from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class EquipmentStatus(Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    WARNING = "WARNING"
    COMPROMISED = "COMPROMISED"


@dataclass
class Equipment:

    asset_id: str
    name: str
    equipment_type: str

    manufacturer: str
    model: str

    ip_address: str
    vlan: int
    network: str

    status: EquipmentStatus = EquipmentStatus.ONLINE

    properties: dict[str, Any] = field(
        default_factory=dict
    )

    def set_status(
        self,
        status: EquipmentStatus
    ) -> None:

        self.status = status

    def add_property(
        self,
        key: str,
        value: Any
    ) -> None:

        self.properties[key] = value

    def get_info(self) -> dict:

        return {
            "asset_id": self.asset_id,
            "name": self.name,
            "type": self.equipment_type,
            "manufacturer": self.manufacturer,
            "model": self.model,
            "ip_address": self.ip_address,
            "vlan": self.vlan,
            "network": self.network,
            "status": self.status.value,
            "properties": self.properties,
        }
        