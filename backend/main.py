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

class AttackRequest(BaseModel):
    attack_type: str

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