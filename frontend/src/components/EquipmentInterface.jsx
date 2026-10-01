/**
 * EquipmentInterface.jsx
 * Router principal de interfaces de equipo.
 * Despacha al componente correcto según asset.type del Excel.
 */

import PLCInterface         from "./interfaces/PLCInterface";
import HMIInterface         from "./interfaces/HMIInterface";
import {
  SensorInterface,
  DriveInterface,
  NetworkInterface,
  ServerInterface,
  WorkstationInterface,
  GenericInterface,
} from "./interfaces/DeviceInterfaces";

/**
 * Clasifica el tipo de equipo a partir del campo `type` del Excel.
 * Es case-insensitive y maneja variantes en español e inglés.
 */
function classifyType(type = "") {
  const t = type.toLowerCase().trim();

  if (t.includes("plc") || t.includes("controller") || t.includes("controlador"))
    return "PLC";

  if (t.includes("hmi") || t.includes("panel") || t.includes("operator"))
    return "HMI";

  if (t.includes("scada") || t.includes("supervisory"))
    return "SCADA";

  if (t.includes("mes") || t.includes("manufacturing exec"))
    return "MES";

  if (t.includes("hist") || t.includes("historian"))
    return "HISTORIAN";

  if (t.includes("engineering") || t.includes("ingenieria") ||
      t.includes("workstation") || t.includes("estacion"))
    return "WORKSTATION";

  if (t.includes("sensor") || t.includes("transmisor") || t.includes("transmitter") ||
      t.includes("temp") || t.includes("press") || t.includes("level") || t.includes("flow"))
    return "SENSOR";

  if (t.includes("motor") || t.includes("drive") || t.includes("variador") || t.includes("vfd"))
    return "DRIVE";

  if (t.includes("valve") || t.includes("valvula") || t.includes("válvula") || t.includes("actuator"))
    return "VALVE";

  if (t.includes("conveyor") || t.includes("banda") || t.includes("transport"))
    return "DRIVE"; // same interface

  if (t.includes("cnc") || t.includes("maquinado") || t.includes("machining") || t.includes("molder"))
    return "SENSOR"; // simplified — show live vars

  if (t.includes("robot"))
    return "DRIVE"; // simplified — show motion control

  if (t.includes("switch") || t.includes("conmutador"))
    return "NETWORK";

  if (t.includes("firewall") || t.includes("mguard") || t.includes("security"))
    return "NETWORK";

  if (t.includes("ewon") || t.includes("gateway") || t.includes("router") || t.includes("modem"))
    return "NETWORK";

  if (t.includes("vision") || t.includes("camera") || t.includes("camara"))
    return "SENSOR";

  if (t.includes("tester") || t.includes("analyzer") || t.includes("analizador"))
    return "SENSOR";

  if (t.includes("printer") || t.includes("impresora"))
    return "GENERIC";

  return "GENERIC";
}

/**
 * Componente principal.
 * Props:
 *   asset       — activo normalizado (campo `type` viene del Excel)
 *   labData     — datos completos del lab (para leer variables del Excel)
 *   plant       — estado de la planta (process, events)
 *   events      — array de eventos
 *   onBack      — callback para volver a la vista anterior
 */
export default function EquipmentInterface({ asset, labData, plant, events = [], onBack }) {
  if (!asset) return null;

  const deviceClass = classifyType(asset.type);
  const commonProps = { asset, labData, plant, events, onBack };

  switch (deviceClass) {
    case "PLC":
      return <PLCInterface {...commonProps}/>;

    case "HMI":
      return <HMIInterface {...commonProps}/>;

    case "SCADA":
    case "MES":
    case "HISTORIAN":
      return <ServerInterface {...commonProps}/>;

    case "WORKSTATION":
      return <WorkstationInterface {...commonProps}/>;

    case "SENSOR":
      return <SensorInterface {...commonProps}/>;

    case "DRIVE":
    case "VALVE":
      return <DriveInterface {...commonProps}/>;

    case "NETWORK":
      return <NetworkInterface {...commonProps}/>;

    default:
      return <GenericInterface {...commonProps}/>;
  }
}