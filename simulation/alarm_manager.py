from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Callable


@dataclass
class Alarm:
    alarm_id: str
    severity: str
    source: str
    message: str
    active: bool = True
    acknowledged: bool = False
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat(timespec="seconds")

    def to_dict(self):
        return asdict(self)


class AlarmManager:
    """Central OT alarm state for the Cyber Range.

    The PLC/runtime raises alarms through this manager. The manager owns
    active/acknowledged state while Plant remains responsible for event history.
    """

    def __init__(self, event_callback: Callable):
        self.event_callback = event_callback
        self.alarms: dict[str, Alarm] = {}

    def trigger(self, alarm_id: str, severity: str, source: str, message: str):
        existing = self.alarms.get(alarm_id)

        if existing and existing.active:
            # Do not spam the SIEM every PLC scan cycle.
            return existing

        alarm = Alarm(
            alarm_id=alarm_id,
            severity=severity.upper(),
            source=source,
            message=message,
        )

        self.alarms[alarm_id] = alarm

        self.event_callback(
            "ALARM_TRIGGERED",
            alarm.severity,
            source,
            f"{alarm.message} [{alarm.alarm_id}]",
        )

        return alarm

    def acknowledge(self, alarm_id: str):
        alarm = self.alarms.get(alarm_id)

        if not alarm or not alarm.active:
            raise ValueError(f"Alarm {alarm_id} is not active")

        if not alarm.acknowledged:
            alarm.acknowledged = True
            self.event_callback(
                "ALARM_ACKNOWLEDGED",
                "INFO",
                alarm.source,
                f"Alarm acknowledged: {alarm.message} [{alarm.alarm_id}]",
            )

        return alarm

    def reset(self, alarm_id: str):
        alarm = self.alarms.get(alarm_id)

        if not alarm:
            raise ValueError(f"Alarm {alarm_id} not found")

        if alarm.active:
            alarm.active = False
            alarm.acknowledged = False
            self.event_callback(
                "ALARM_RESET",
                "INFO",
                alarm.source,
                f"Alarm reset: {alarm.message} [{alarm.alarm_id}]",
            )

        return alarm

    def reset_all(self):
        for alarm_id in list(self.alarms):
            if self.alarms[alarm_id].active:
                self.reset(alarm_id)

    def get_active(self):
        return [
            alarm.to_dict()
            for alarm in self.alarms.values()
            if alarm.active
        ]

    def get_state(self):
        return {
            "active": self.get_active(),
            "count": len(self.get_active()),
        }
