import asyncio

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from simulation.plant import Plant


app = FastAPI(

    title="OT Cyber Range",

    description=
        "Industrial OT Cyber Range Simulation",

    version="1.0.0"

)


app.add_middleware(

    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)


plant = Plant()


@app.get("/")
def root():

    return {

        "application":
            "OT Cyber Range",

        "status":
            "ONLINE",

        "simulation":
            "RUNNING",

    }


@app.get("/api/plant")
def get_plant():

    return plant.get_state()


@app.get("/api/plc")
def get_plc():

    return plant.plc.get_state()


@app.get("/api/events")
def get_events():

    return [

        event.to_dict()

        for event
        in plant.events[-50:]

    ]
    
@app.get("/api/inventory")
def get_inventory():

    return plant.get_inventory()


@app.post("/api/plant/motor")
def change_motor(
    speed: float
):

    plant.change_motor_speed(
        speed
    )

    return plant.get_state()


@app.post("/api/plant/valve")
def change_valve(
    position: float
):

    plant.change_valve_position(
        position
    )

    return plant.get_state()


@app.post("/api/plant/stop")
def stop_production():

    plant.stop_production()

    return plant.get_state()


@app.post("/api/plant/resume")
def resume_production():

    plant.resume_production()

    return plant.get_state()


@app.websocket("/ws/plant")
async def plant_websocket(
    websocket: WebSocket
):

    await websocket.accept()

    try:

        while True:

            plant.update()

            await websocket.send_json(
                plant.get_state()
            )

            await asyncio.sleep(1)

    except Exception:

        pass