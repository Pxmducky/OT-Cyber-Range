# OT-Cyber-Range — Project Status

Fecha de actualización: 2026-10-01

## Estado general

Aproximadamente 30% completado.

---

# Funcionando actualmente

## Frontend

- React
- Vite
- navegación principal
- interfaces de equipos OT
- interfaz PLC
- interfaz HMI
- interfaces de dispositivos
- visualización de planta
- visualización Purdue
- interfaz SIEM

## PLC

- interfaz de PLC
- editor Structured Text
- intérprete Structured Text
- ejecución en sandbox
- variables
- diagnóstico
- ciclo de scan
- plantillas

## Backend

- FastAPI
- Uvicorn
- estructura inicial del backend

## Desarrollo

- Git
- GitHub
- Docker
- Docker Compose
- VS Code

---

# En desarrollo

- simulación más realista de PLC
- comunicación entre equipos
- interacción HMI/PLC
- simulación de procesos industriales
- eventos SIEM
- escenarios de ataque
- simulación de reconocimiento con Nmap
- correlación de eventos
- integración frontend/backend

---

# Pendiente

- autenticación
- base de datos
- persistencia de activos
- escenarios completos de ataque
- simulación de tráfico OT
- mayor realismo del proceso industrial
- integración completa con SIEM
- despliegue mediante Docker
- documentación final

---

# Componentes actuales

## Frontend

App.jsx

components/

- EquipmentInterface.jsx
- DynamicPlant.jsx
- PhysicalPlant.jsx
- PurduePage.jsx
- SIEMPage.jsx

components/interfaces/

- PLCInterface.jsx
- HMIInterface.jsx
- DeviceInterfaces.jsx

utils/

- stInterpreter.js

---

# Decisiones importantes

- No utilizar Streamlit.
- Frontend basado en React + Vite.
- Backend basado en FastAPI.
- La interfaz de PLC utiliza Structured Text.
- La lógica del intérprete ST está separada de la interfaz.
- EquipmentInterface funciona como router de interfaces según asset.type.

---

# Problemas conocidos

Registrar aquí errores conocidos.

Actualmente:

- Mantener vigilancia sobre errores de imports duplicados.
- Verificar errores de renderizado antes de modificar múltiples componentes.

---

# Próximo objetivo

Definir y completar la simulación funcional de los equipos OT y su comunicación.

---

# Historial

## 2026-10-01

- Se implementó arquitectura de interfaces separadas.
- Se agregó intérprete Structured Text.
- Se continúa desarrollo del laboratorio OT.
