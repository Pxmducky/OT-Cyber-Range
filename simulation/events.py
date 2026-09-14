from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class OTEvent:
    event_type: str
    severity: str
    source: str
    message: str
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat(
                timespec="seconds"
            )

    def to_dict(self) -> dict:
        return asdict(self)