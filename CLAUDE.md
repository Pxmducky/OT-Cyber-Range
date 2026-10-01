# OT-Cyber-Range

## Objetivo

OT-Cyber-Range es un laboratorio virtual para simulación, aprendizaje y demostración de ciberseguridad industrial OT/ICS.

El proyecto permite representar equipos industriales, procesos OT, interfaces de operación, simulación de PLC, escenarios de ataque y monitoreo de eventos.

---

# Arquitectura general

## Frontend

Tecnologías:

- React
- Vite
- JavaScript
- JSX

Ubicación:

frontend/

## Backend

Tecnologías:

- Python
- FastAPI
- Uvicorn

Ubicación:

backend/

---

# Estructura principal

frontend/
├── src/
│   ├── App.jsx
│   ├── components/
│   └── utils/
│
└── package.json

backend/
└── main.py

---

# Componentes importantes

## App.jsx

Punto principal de navegación y composición de la aplicación frontend.

No modificarlo si la tarea puede resolverse dentro de un componente específico.

---

## EquipmentInterface.jsx

Router de interfaces de equipos.

Determina qué interfaz mostrar dependiendo del tipo de activo.

---

## PLCInterface.jsx

Interfaz de PLC.

Incluye funcionalidades relacionadas con:

- programación Structured Text
- ejecución del programa
- variables
- diagnóstico
- ciclo de scan
- simulación del PLC
- plantillas

---

## HMIInterface.jsx

Interfaz para representar y controlar una HMI dentro del laboratorio.

---

## DeviceInterfaces.jsx

Interfaces para otros dispositivos OT.

---

## stInterpreter.js

Intérprete/ejecutor de Structured Text basado en IEC 61131-3.

Debe mantenerse separado de la interfaz visual siempre que sea posible.

---

# Reglas de desarrollo

1. No usar Streamlit.

2. Mantener frontend y backend separados.

3. No modificar archivos que no sean necesarios para la tarea.

4. Antes de crear un componente nuevo, revisar si ya existe uno equivalente.

5. Evitar duplicar funcionalidad.

6. No duplicar imports.

7. No eliminar funcionalidad existente sin indicarlo explícitamente.

8. Mantener compatibilidad con React + Vite.

9. Mantener los componentes modulares.

10. Preferir cambios pequeños y localizados.

11. No reescribir archivos completos si solamente es necesario modificar una sección.

12. No instalar dependencias nuevas sin explicar primero para qué son necesarias.

13. No modificar package.json si la tarea no requiere una dependencia.

14. No modificar backend cuando la tarea pueda resolverse en frontend.

15. No modificar frontend cuando la tarea pueda resolverse exclusivamente en backend.

---

# Manejo del contexto

Antes de modificar código:

1. Identificar exactamente qué archivos están relacionados.
2. Leer únicamente esos archivos.
3. Explicar brevemente el problema encontrado.
4. Proponer la modificación.
5. Implementar únicamente lo necesario.
6. Revisar errores provocados por el cambio.
7. No analizar todo el repositorio salvo que exista una dependencia que lo requiera.

---

# Regla de archivos

Por defecto, trabajar con un máximo aproximado de 3 a 5 archivos por tarea.

Si se necesitan más archivos:

1. explicar por qué son necesarios
2. identificar las dependencias
3. leer únicamente los archivos adicionales necesarios

---

# Git

Antes de cambios importantes:

- crear un commit de respaldo
- realizar cambios
- revisar git diff
- probar la aplicación
- crear un nuevo commit si todo funciona

No realizar git reset, git checkout destructivo o eliminación de archivos sin autorización explícita.

---

# Debugging

Cuando exista un error:

1. identificar el archivo indicado por el error
2. revisar únicamente ese archivo y sus dependencias directas
3. localizar la causa
4. realizar el cambio mínimo
5. volver a ejecutar la aplicación
6. revisar si aparece un nuevo error

No rehacer toda la aplicación para solucionar un error localizado.

---

# Frontend

Mantener separadas:

- lógica
- interfaces
- simulación
- componentes visuales
- utilidades

Evitar colocar toda la lógica en App.jsx.

---

# PLC

La lógica relacionada con Structured Text debe permanecer principalmente en:

frontend/src/utils/stInterpreter.js

La interfaz visual debe permanecer principalmente en:

frontend/src/components/interfaces/PLCInterface.jsx

---

# Objetivo de desarrollo

El proyecto debe evolucionar de forma incremental.

No implementar múltiples funcionalidades grandes simultáneamente.

Cada funcionalidad debe poder probarse antes de continuar con la siguiente.
