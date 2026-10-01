from contextlib import asynccontextmanager
import asyncio
import threading
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from simulation.plant import Plant, LEGITIMATE_PROGRAM


# ============================================================
# PLANT GLOBAL
# ============================================================

plant = Plant()
plant_lock = threading.RLock()


# ============================================================
# BACKGROUND SIMULATION
# ============================================================

async def simulation_loop():
    """
    Ejecuta el ciclo de simulación de la planta.
    El frontend puede consultar /api/state para obtener
    el estado actualizado.
    """

    while True:
        try:
            with plant_lock:
                plant.update()

        except Exception as exc:
            print(f"[SIMULATION ERROR] {exc}")

        await asyncio.sleep(1)


@asynccontextmanager
async def lifespan(app: FastAPI):

    print("=" * 60)
    print("OT CYBER RANGE")
    print("Starting industrial plant simulation...")
    print("=" * 60)

    # --------------------------------------------------------
    # Cargar programa PLC legítimo inicial
    # --------------------------------------------------------

    with plant_lock:
        try:
            errors = plant.load_plc_program(LEGITIMATE_PROGRAM)

            if errors:
                print("[PLC] Program validation failed:")
                for error in errors:
                    print(f"  - {error}")
            else:
                print("[PLC] Legitimate program loaded successfully")

        except Exception as exc:
            print(f"[PLC] Could not load legitimate program: {exc}")

    # --------------------------------------------------------
    # Iniciar simulación
    # --------------------------------------------------------

    task = asyncio.create_task(simulation_loop())

    print("[SIMULATION] Background process started")
    print("[API] FastAPI server ready")
    print("=" * 60)

    yield

    # --------------------------------------------------------
    # Detener simulación
    # --------------------------------------------------------

    task.cancel()

    try:
        await task
    except asyncio.CancelledError:
        pass

    print("[SIMULATION] Background process stopped")


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="OT Cyber Range API",
    description="Industrial OT Cyber Range simulation backend",
    version="1.0.0",
    lifespan=lifespan,
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# PYDANTIC MODELS
# ============================================================

class MotorRequest(BaseModel):
    speed: float = Field(..., ge=0, le=2000)


class ValveRequest(BaseModel):
    position: float = Field(..., ge=0, le=100)


class RegisterWriteRequest(BaseModel):
    register: str
    value: float


class ProcessRequest(BaseModel):
    temperature: Optional[float] = Field(
        default=None,
        ge=0,
        le=150,
    )

    pressure: Optional[float] = Field(
        default=None,
        ge=0,
        le=20,
    )

    motor_speed: Optional[float] = Field(
        default=None,
        ge=0,
        le=2000,
    )

    valve_position: Optional[float] = Field(
        default=None,
        ge=0,
        le=100,
    )


class SetpointRequest(BaseModel):
    variable: str
    value: float


class EquipmentStatusRequest(BaseModel):
    status: str


class PLCProgramRequest(BaseModel):
    source: str


class AttackRequest(BaseModel):
    attack_type: str


class AlarmActionRequest(BaseModel):
    alarm_id: str


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "name": "OT Cyber Range API",
        "version": "1.0.0",
        "status": "online",
        "simulation": "running",
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "simulation": "running",
    }


# ============================================================
# FULL PLANT STATE
# ============================================================

@app.get("/api/state")
def get_state():

    with plant_lock:
        return plant.get_state()


# ============================================================
# INVENTORY
# ============================================================

@app.get("/api/inventory")
def get_inventory():

    with plant_lock:
        return {
            "count": len(plant.equipment),
            "equipment": plant.get_inventory(),
        }


# ============================================================
# EVENTS
# ============================================================

@app.get("/api/events")
def get_events():

    with plant_lock:
        return {
            "events": [
                event.to_dict()
                for event in plant.events
            ]
        }


# ============================================================
# ALARMS
# ============================================================

@app.get("/api/alarms")
def get_alarms():

    with plant_lock:
        return plant.get_alarms()


# ============================================================
# ACKNOWLEDGE ALARM
# ============================================================

@app.post("/api/alarms/{alarm_id}/acknowledge")
def acknowledge_alarm(alarm_id: str):

    with plant_lock:

        try:
            alarm = plant.acknowledge_alarm(alarm_id)

            return {
                "success": True,
                "alarm": alarm,
            }

        except Exception as exc:

            raise HTTPException(
                status_code=400,
                detail=str(exc),
            )


# ============================================================
# RESET ALARM
# ============================================================

@app.post("/api/alarms/{alarm_id}/reset")
def reset_alarm(alarm_id: str):

    with plant_lock:

        try:
            alarm = plant.reset_alarm(alarm_id)

            return {
                "success": True,
                "alarm": alarm,
            }

        except Exception as exc:

            raise HTTPException(
                status_code=400,
                detail=str(exc),
            )


# ============================================================
# MOTOR CONTROL
# ============================================================

@app.post("/api/motor/speed")
def change_motor_speed(request: MotorRequest):

    with plant_lock:

        plant.change_motor_speed(
            request.speed
        )

        return {
            "success": True,
            "state": plant.get_state(),
        }


# ============================================================
# VALVE CONTROL
# ============================================================

@app.post("/api/valve/position")
def change_valve_position(request: ValveRequest):

    with plant_lock:

        plant.change_valve_position(
            request.position
        )

        return {
            "success": True,
            "state": plant.get_state(),
        }


# ============================================================
# PROCESS VALUES
# ============================================================

@app.post("/api/process")
def set_process_values(request: ProcessRequest):

    with plant_lock:

        state = plant.set_process_values(
            temperature=request.temperature,
            pressure=request.pressure,
            motor_speed=request.motor_speed,
            valve_position=request.valve_position,
        )

        return {
            "success": True,
            "state": state,
        }


# ============================================================
# HMI SETPOINT
# ============================================================

@app.post("/api/hmi/setpoint")
def set_hmi_setpoint(request: SetpointRequest):

    with plant_lock:

        try:

            state = plant.set_hmi_setpoint(
                variable=request.variable,
                value=request.value,
            )

            return {
                "success": True,
                "state": state,
            }

        except ValueError as exc:

            raise HTTPException(
                status_code=400,
                detail=str(exc),
            )

        except Exception as exc:

            raise HTTPException(
                status_code=500,
                detail=str(exc),
            )


# ============================================================
# PLC REGISTER WRITE
# ============================================================

@app.post("/api/plc/register")
def write_plc_register(request: RegisterWriteRequest):

    with plant_lock:

        try:

            plant.write_plc_register(
                register=request.register,
                value=request.value,
            )

            return {
                "success": True,
                "register": request.register,
                "value": request.value,
                "state": plant.get_state(),
            }

        except Exception as exc:

            raise HTTPException(
                status_code=400,
                detail=str(exc),
            )


# ============================================================
# PLC STATE
# ============================================================

@app.post("/api/plc/run")
def run_plc():

    with plant_lock:

        plant.run_plc()

        return {
            "success": True,
            "plc": plant.plc.get_state(),
        }


@app.post("/api/plc/stop")
def stop_plc():

    with plant_lock:

        plant.stop_plc()

        return {
            "success": True,
            "plc": plant.plc.get_state(),
        }


# ============================================================
# PRODUCTION
# ============================================================

@app.post("/api/production/start")
def resume_production():

    with plant_lock:

        plant.resume_production()

        return {
            "success": True,
            "state": plant.get_state(),
        }


@app.post("/api/production/stop")
def stop_production():

    with plant_lock:

        plant.stop_production()

        return {
            "success": True,
            "state": plant.get_state(),
        }


# ============================================================
# PLC PROGRAM
# ============================================================

@app.get("/api/plc/program")
def get_plc_program():

    with plant_lock:

        return plant.get_plc_program()


# ============================================================
# VALIDATE PLC PROGRAM
# ============================================================

@app.post("/api/plc/program/validate")
def validate_plc_program(request: PLCProgramRequest):

    with plant_lock:

        try:

            errors = plant.validate_plc_program(
                request.source
            )

            return {
                "valid": len(errors) == 0,
                "errors": errors,
            }

        except Exception as exc:

            raise HTTPException(
                status_code=400,
                detail=str(exc),
            )


# ============================================================
# LOAD PLC PROGRAM
# ============================================================

@app.post("/api/plc/program/load")
def load_plc_program(request: PLCProgramRequest):

    with plant_lock:

        errors = plant.load_plc_program(
            request.source
        )

        if errors:

            return {
                "success": False,
                "loaded": False,
                "errors": errors,
                "program": plant.get_plc_program(),
            }

        return {
            "success": True,
            "loaded": True,
            "errors": [],
            "program": plant.get_plc_program(),
        }


# ============================================================
# RUN PLC PROGRAM
# ============================================================

@app.post("/api/plc/program/run")
def run_plc_program():

    with plant_lock:

        try:

            program = plant.run_plc_program()

            return {
                "success": True,
                "program": program,
                "state": plant.get_state(),
            }

        except Exception as exc:

            raise HTTPException(
                status_code=400,
                detail=str(exc),
            )


# ============================================================
# STOP PLC PROGRAM
# ============================================================

@app.post("/api/plc/program/stop")
def stop_plc_program():

    with plant_lock:

        try:

            program = plant.stop_plc_program()

            return {
                "success": True,
                "program": program,
                "state": plant.get_state(),
            }

        except Exception as exc:

            raise HTTPException(
                status_code=400,
                detail=str(exc),
            )


# ============================================================
# RESET PLC PROGRAM
# ============================================================

@app.post("/api/plc/program/reset")
def reset_plc_program():

    with plant_lock:

        try:

            program = plant.reset_plc_program()

            return {
                "success": True,
                "program": program,
                "state": plant.get_state(),
            }

        except Exception as exc:

            raise HTTPException(
                status_code=400,
                detail=str(exc),
            )


# ============================================================
# EQUIPMENT STATUS
# ============================================================

@app.post("/api/equipment/{asset_id}/status")
def set_equipment_status(
    asset_id: str,
    request: EquipmentStatusRequest,
):

    with plant_lock:

        try:

            plant.set_equipment_status(
                asset_id=asset_id,
                status=request.status,
            )

            return {
                "success": True,
                "equipment": plant.get_equipment(
                    asset_id
                ).get_info(),
            }

        except ValueError as exc:

            raise HTTPException(
                status_code=400,
                detail=str(exc),
            )


# ============================================================
# ATTACK ENGINE
# ============================================================

@app.get("/api/attacks")
def get_attacks():

    from simulation.attack_engine import SCENARIOS

    return {
        "attacks": SCENARIOS,
    }


@app.post("/api/attack")
def execute_attack(request: AttackRequest):

    with plant_lock:

        try:

            result = plant.execute_attack(
                request.attack_type
            )

            return {
                "success": True,
                **result,
            }

        except ValueError as exc:

            raise HTTPException(
                status_code=400,
                detail=str(exc),
            )

        except Exception as exc:

            raise HTTPException(
                status_code=500,
                detail=str(exc),
            )


# ============================================================
# RESTORE PLANT
# ============================================================

@app.post("/api/restore")
def restore_plant():

    with plant_lock:

        state = plant.restore_plant()

        return {
            "success": True,
            "message": "Plant restored successfully",
            "state": state,
        }


# ============================================================
# MANUAL SIMULATION TICK
# ============================================================

@app.post("/api/simulation/tick")
def simulation_tick():

    with plant_lock:

        try:

            plant.update()

            return {
                "success": True,
                "state": plant.get_state(),
            }

        except Exception as exc:

            raise HTTPException(
                status_code=500,
                detail=str(exc),
            )