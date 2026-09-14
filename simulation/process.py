import random
from dataclasses import dataclass


@dataclass
class ProcessState:

    production_running: bool = True

    production_rate: float = 100.0

    temperature: float = 68.0

    pressure: float = 3.8

    motor_speed: float = 1450.0

    valve_position: float = 50.0

    process_alarm: bool = False

    def update(self):

        if not self.production_running:

            self.motor_speed = max(
                0,
                self.motor_speed - 50
            )

            self.production_rate = max(
                0,
                self.production_rate - 5
            )

            self.process_alarm = True

            return

        # Variación normal de temperatura

        self.temperature += random.uniform(
            -0.25,
            0.25
        )

        # Variación normal de presión

        self.pressure += random.uniform(
            -0.025,
            0.025
        )

        # Límites operativos

        self.temperature = max(
            60,
            min(80, self.temperature)
        )

        self.pressure = max(
            3.0,
            min(4.5, self.pressure)
        )

        # El motor busca su velocidad nominal

        target_speed = 1450

        if self.motor_speed < target_speed:

            self.motor_speed += 10

        elif self.motor_speed > target_speed:

            self.motor_speed -= 10

        # Producción depende del motor

        self.production_rate = min(
            100,
            (self.motor_speed / 1450) * 100
        )

        self.process_alarm = False

    def change_motor_speed(
        self,
        speed: float
    ):

        self.motor_speed = speed

        if speed < 500:

            self.production_running = False

            self.production_rate = 0

            self.process_alarm = True

    def change_valve_position(
        self,
        position: float
    ):

        self.valve_position = max(
            0,
            min(100, position)
        )

        if (
            self.valve_position < 10
            or self.valve_position > 90
        ):

            self.process_alarm = True

    def stop(self):

        self.production_running = False

        self.production_rate = 0

        self.motor_speed = 0

        self.process_alarm = True

    def resume(self):

        self.production_running = True

        self.production_rate = 100

        self.motor_speed = 1450

        self.process_alarm = False

    def get_state(self):

        return {

            "production_running":
                self.production_running,

            "production_rate":
                round(
                    self.production_rate,
                    2
                ),

            "temperature":
                round(
                    self.temperature,
                    2
                ),

            "pressure":
                round(
                    self.pressure,
                    2
                ),

            "motor_speed":
                round(
                    self.motor_speed,
                    2
                ),

            "valve_position":
                round(
                    self.valve_position,
                    2
                ),

            "process_alarm":
                self.process_alarm,

        }
        