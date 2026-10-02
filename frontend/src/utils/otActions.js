/**
 * otActions.js
 * Punto único para que CUALQUIER interfaz de equipo dispare acciones con
 * impacto real en el backend, y mapa de colores por tipo de actividad para
 * colorear la topología (líneas + contorno de los equipos).
 */

const API_URL = "http://127.0.0.1:8000";

/**
 * Envía una acción de equipo al backend.
 * @returns el estado completo de la planta (incluye process, events, activity…)
 */
export async function equipmentAction({
  assetId, assetType = "", action, value = null, targetId = null, protocol = null,
}) {
  const res = await fetch(`${API_URL}/api/equipment/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      asset_id: assetId, asset_type: assetType, action,
      value, target_id: targetId, protocol,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── Color por tipo de actividad ── */
export const ACTIVITY_COLORS = {
  normal:  "#22c55e",   // verde  — operación normal
  command: "#22d3ee",   // teal   — comando de operador
  config:  "#818cf8",   // morado — cambio de configuración
  scan:    "#06b6d4",   // cian   — reconocimiento / escaneo
  warning: "#f59e0b",   // ámbar  — condición degradada
  blocked: "#f97316",   // naranja— tráfico bloqueado (firewall)
  attack:  "#ef4444",   // rojo   — actividad maliciosa / compromiso
  offline: "#4b5563",   // gris   — fuera de línea
};

export function activityColor(state) {
  return ACTIVITY_COLORS[state] || null;
}

/* Gravedad relativa, para resolver qué color gana en una conexión */
const RANK = { attack: 5, blocked: 4, warning: 3, scan: 2, config: 1, command: 1, normal: 0 };

/** Actividad de un activo concreto (o null). */
export function assetActivity(activity, id) {
  return (activity && id && activity[id]) || null;
}

/** Actividad dominante en una conexión A↔B (la más grave de sus extremos). */
export function connActivity(activity, a, b) {
  if (!activity) return null;
  let best = null;
  for (const r of [activity[a], activity[b]]) {
    if (r && (!best || (RANK[r.state] || 0) > (RANK[best.state] || 0))) best = r;
  }
  return best;
}

/* ── Carga de topología: envía el inventario del Excel al backend ── */
export async function loadTopology(assets = [], connections = [], variables = []) {
  const res = await fetch(`${API_URL}/api/plant/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assets, connections, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── Estado vivo de un activo concreto (su proceso individual) ── */
export async function fetchAssetState(assetId) {
  const res = await fetch(`${API_URL}/api/equipment/${encodeURIComponent(assetId)}`);
  if (!res.ok) return null;
  return res.json();
}

/* ── Color por nivel de criticidad / salud del proceso ── */
export const HEALTH_COLORS = {
  normal:   "#22c55e",  // verde   — operación normal
  warning:  "#f59e0b",  // naranja — proceso degradado / en riesgo
  critical: "#ef4444",  // rojo    — proceso crítico detenido / comprometido
  offline:  "#4b5563",  // gris    — fuera de línea
};

export function healthColor(h) {
  return HEALTH_COLORS[h] || null;
}

const _H_RANK = { normal: 0, warning: 1, critical: 2, offline: 1 };

/** Salud dominante de una conexión A↔B (la peor de sus extremos). */
export function connHealth(health, a, b) {
  if (!health) return "normal";
  const ha = health[a] || "normal", hb = health[b] || "normal";
  return (_H_RANK[ha] >= _H_RANK[hb]) ? ha : hb;
}

/* ── Helpers para la Estación de Ingeniería ── */
export async function fetchPlant() {
  const res = await fetch(`${API_URL}/api/plant`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
export async function plcDownloadProgram(source) {
  const res = await fetch(`${API_URL}/api/plc/program/download`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail?.message || `HTTP ${res.status}`);
  return data;
}
export async function plcRunProgram() {
  const res = await fetch(`${API_URL}/api/plc/program/run`, { method: "POST" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* Puertos OT por protocolo (para nmap/wireshark simulados sobre datos reales) */
export const PROTO_PORT = {
  S7COMM:102, S7:102, "OPC-UA":4840, OPCUA:4840, MODBUS:502, "ETHERNET/IP":44818,
  ETHERNETIP:44818, DNP3:20000, PROFINET:34962, HTTP:80, HTTPS:443, SSH:22,
  RDP:3389, SMB:445, FTP:21, SNMP:161, MQTT:1883,
};
export function protoPort(proto = "") {
  const k = proto.toUpperCase().replace(/\s+/g, "");
  return PROTO_PORT[k] || PROTO_PORT[proto.toUpperCase()] || null;
}

/* Programa ST seguro de referencia (válido para el validador del backend) */
export const SAFE_PLC_PROGRAM = `PROGRAM MAIN
NETWORK 1
IF TEMPERATURE >= 75 THEN
  MOTOR_SPEED := 1200;
END_IF
NETWORK 2
IF TEMPERATURE < 65 THEN
  MOTOR_SPEED := 1450;
END_IF
NETWORK 3
IF PRESSURE > 4.2 THEN
  VALVE_POSITION := 70;
END_IF
END_PROGRAM`;