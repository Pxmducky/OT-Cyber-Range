from dataclasses import dataclass, field
from datetime import datetime
from .plc_validator import validate_program


@dataclass
class PLCProgram:
    name: str = "MAIN"
    source: str = ""
    version: int = 0
    status: str = "NOT_LOADED"
    loaded_at: str = ""
    running: bool = False
    last_error: str = ""
    execution_count: int = 0

    def validate(self):
        return validate_program(self.source)

    def load(self, source: str):
        errors = validate_program(source)
        if errors:
            self.status = "ERROR"
            self.last_error = "; ".join(errors)
            self.running = False
            return errors

        self.source = source
        self.version += 1
        self.status = "LOADED"
        self.loaded_at = datetime.now().isoformat(timespec="seconds")
        self.running = False
        self.last_error = ""
        self.execution_count = 0
        return []

    def to_dict(self):
        return {
            "name": self.name,
            "source": self.source,
            "version": self.version,
            "status": self.status,
            "loaded_at": self.loaded_at,
            "running": self.running,
            "last_error": self.last_error,
            "execution_count": self.execution_count,
        }
