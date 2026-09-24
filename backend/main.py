import asyncio

from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from simulation.plant import Plant
from simulation.attack_engine import SCENARIOS


app = FastAPI(
    title="OT Cyber Range",
    description="Industrial OT Cyber Range Simulation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


plant = Plant()


class PLCProgramRequest(BaseModel):
    source: str

class AlarmActionRequest(BaseModel):
    alarm_id: str

class ProcessSetRequest(BaseModel):
    temperature:    Optional[float] = None
    pressure:       Optional[float] = None
    motor_speed:    Optional[float] = None
    valve_position: Optional[float] = None


@app.post("/api/process/set")
def set_process_values(req: ProcessSetRequest):
    """Permite al operador cambiar los valores del proceso directamente desde la interfaz."""
    plant.set_process_values(
        temperature    = req.temperature,
        pressure       = req.pressure,
        motor_speed    = req.motor_speed,
        valve_position = req.valve_position,
    )
    return plant.get_state()


class AttackRequest(BaseModel):
    attack_type: str

class SetpointRequest(BaseModel):
    variable: str
    value: float

@app.get("/")
def root():
    return {
        "application": "OT Cyber Range",
        "status": "ONLINE",
        "simulation": "RUNNING",
    }


@app.get("/api/plant")
def get_plant():
    return plant.get_state()
# =====================================================================
# HMI COMMANDS
# =====================================================================

@app.post("/api/hmi/start")
def hmi_start():
    plant.resume_production()

    plant.add_event(
        "HMI_START",
        "INFO",
        "HMI-001",
        "Production started from HMI"
    )

    return plant.get_state()


@app.post("/api/hmi/stop")
def hmi_stop():
    plant.stop_production()

    plant.add_event(
        "HMI_STOP",
        "WARNING",
        "HMI-001",
        "Production stopped from HMI"
    )

    return plant.get_state()


@app.post("/api/hmi/reset")
def hmi_reset():
    plant.resume_production()

    plant.add_event(
        "HMI_RESET",
        "INFO",
        "HMI-001",
        "Production reset from HMI"
    )

    return plant.get_state()

@app.get("/api/plc")
def get_plc():
    return plant.plc.get_state()


@app.get("/api/events")
def get_events():
    return [event.to_dict() for event in plant.events[-50:]]


@app.get("/api/inventory")
def get_inventory():
    return plant.get_inventory()


@app.get("/api/alarms")
def get_alarms():
    return plant.get_alarms()


@app.post("/api/alarms/acknowledge")
def acknowledge_alarm(request: AlarmActionRequest):
    try:
        return plant.acknowledge_alarm(request.alarm_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@app.post("/api/alarms/reset")
def reset_alarm(request: AlarmActionRequest):
    try:
        return plant.reset_alarm(request.alarm_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@app.post("/api/plant/motor")
def change_motor(speed: float):
    plant.change_motor_speed(speed)
    return plant.get_state()


@app.post("/api/plant/valve")
def change_valve(position: float):
    plant.change_valve_position(position)
    return plant.get_state()


@app.post("/api/plant/stop")
def stop_production():
    plant.stop_production()
    return plant.get_state()


@app.post("/api/plant/resume")
def resume_production():
    plant.resume_production()
    return plant.get_state()


@app.post("/api/plc/run")
def run_plc():
    plant.run_plc()
    return plant.get_state()


@app.post("/api/plc/stop")
def stop_plc():
    plant.stop_plc()
    return plant.get_state()


@app.post("/api/plc/reset")
def reset_plc():
    plant.plc_runtime.reset()
    plant.alarm_manager.reset_all()
    plant.plc.run()
    plant.process.resume()
    plant.add_event(
        "PLC_RESET", "INFO", "PLC-001", "PLC reset executed"
    )
    return plant.get_state()


@app.get("/api/plc/program")
def get_plc_program():
    return plant.get_plc_program()


@app.post("/api/plc/program/validate")
def validate_plc_program(request: PLCProgramRequest):
    errors = plant.validate_plc_program(request.source)
    return {"valid": len(errors) == 0, "errors": errors}


@app.post("/api/plc/program/download")
def download_plc_program(request: PLCProgramRequest):
    errors = plant.load_plc_program(request.source)
    if errors:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "PLC program validation failed",
                "errors": errors,
            },
        )
    return plant.get_plc_program()


@app.post("/api/plc/program/run")
def run_plc_program():
    try:
        return plant.run_plc_program()
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error))


@app.post("/api/plc/program/stop")
def stop_plc_program():
    return plant.stop_plc_program()


@app.post("/api/plc/program/reset")
def reset_plc_program():
    return plant.reset_plc_program()


# =====================================================================
# HMI SETPOINTS
# El operador introduce valores desde el panel KP400.
# El sistema verifica umbrales ISA-18.2 (LL/L/H/HH) automáticamente.
# =====================================================================

@app.post("/api/hmi/setpoint")
def hmi_setpoint(request: SetpointRequest):
    """
    Aplica el setpoint de una variable de proceso introducido desde el HMI.
    Equivale en la vida real a: operador toca la pantalla, escribe el valor,
    el PLC lo recibe en su DB y el alarm manager verifica los umbrales.
    """
    try:
        return plant.set_hmi_setpoint(request.variable, request.value)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


# =====================================================================
# ATTACK ENGINE ENDPOINTS
# =====================================================================

@app.get("/api/attack/scenarios")
def get_attack_scenarios():
    """Lista todos los escenarios de ataque disponibles."""
    return SCENARIOS


@app.post("/api/attack/execute")
def execute_attack(request: AttackRequest):
    """
    Ejecuta un escenario de ataque educativo sobre la simulación.
    Devuelve la salida de terminal y el nuevo estado de la planta.
    """
    try:
        return plant.execute_attack(request.attack_type)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/api/plant/restore")
def restore_plant():
    """Restaura la planta a estado operativo normal tras un escenario de ataque."""
    return plant.restore_plant()


@app.post("/api/process/normalize")
def normalize_process():
    """
    Restablece los valores del proceso (T, P, motor, válvula) al rango operativo normal.
    Solo toca los valores de proceso — no afecta alarmas ni estado de equipos.
    Útil durante la recuperación paso a paso después de un ataque.
    """
    from simulation.equipment import EquipmentStatus

    plant.process.temperature      = 68.0
    plant.process.pressure         = 3.8
    plant.process.motor_speed      = 1450.0
    plant.process.valve_position   = 50.0
    plant.process.production_running = True
    plant.process.production_rate  = 100.0
    plant.process.process_alarm    = False

    plant.plc.write_register("temperature",    68.0)
    plant.plc.write_register("pressure",       3.8)
    plant.plc.write_register("motor_speed",    1450.0)
    plant.plc.write_register("valve_position", 50.0)

    plant.add_event(
        "PROCESS_NORMALIZED", "INFO", "OT-CYBER-RANGE",
        "Valores de proceso restaurados a rango operativo normal "
        "(T=68°C, P=3.8bar, Motor=1450RPM, Válvula=50%)",
    )
    return plant.get_state()


@app.post("/api/equipment/restore")
def restore_equipment():
    """
    Restablece el estado de todos los activos OT a ONLINE.
    Solo toca el estado de los equipos — no afecta proceso ni alarmas.
    """
    from simulation.equipment import EquipmentStatus

    for eq in plant.equipment:
        eq.set_status(EquipmentStatus.ONLINE)

    plant.add_event(
        "EQUIPMENT_RESTORED", "INFO", "OT-CYBER-RANGE",
        "Estado de todos los activos OT restaurado a ONLINE",
    )
    return plant.get_state()


@app.post("/api/plc/program/load-safe")
def load_safe_program():
    """
    Carga el programa PLC seguro desde backup durante recuperación de incidente.
    Equivale a: TIA Portal → Download to Device → desde copia de seguridad verificada.
    """
    from simulation.plant import LEGITIMATE_PROGRAM
    errors = plant.load_plc_program(LEGITIMATE_PROGRAM)
    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors})

    # Limpiar el estado COMPROMISED del PLC y restablecer equipos de campo
    from simulation.equipment import EquipmentStatus
    plc_eq = plant.get_equipment("PLC-001")
    if plc_eq:
        plc_eq.set_status(EquipmentStatus.ONLINE)

    for asset_id in ["M-001", "V-001"]:
        eq = plant.get_equipment(asset_id)
        if eq and eq.status in (
            EquipmentStatus.COMPROMISED, EquipmentStatus.OFFLINE
        ):
            eq.set_status(EquipmentStatus.ONLINE)

    plant.add_event(
        "SAFE_PROGRAM_RESTORED", "INFO", "PLC-001",
        "Programa PLC seguro restaurado desde backup — recuperación de incidente"
    )
    return plant.get_plc_program()


# =====================================================================

@app.websocket("/ws/plant")
async def plant_websocket(websocket: WebSocket):

    await websocket.accept()

    try:

        while True:

            plant.update()

            await websocket.send_json(
                plant.get_state()
            )

            await asyncio.sleep(1)

    except Exception as error:

        print(
            "WEBSOCKET ERROR:",
            repr(error)
        )