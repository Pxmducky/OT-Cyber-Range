/**
 * PhysicalPlant.jsx
 * Vista top-down (planta desde arriba) de la línea de producción OT.
 * Dibuja cada equipo como su equivalente real en SVG, con:
 *  - Flujo de proceso animado en tuberías
 *  - Señales de control animadas PLC → campo
 *  - Datos de red animados (SCADA, HMI, Engineering, VPN)
 *  - Colores de estado en tiempo real (ONLINE / WARNING / COMPROMISED / OFFLINE)
 */

import { useState } from "react";
import { X } from "lucide-react";
import EquipmentInterface from "./EquipmentInterface";

/* =========================================================
   PALETA DE ESTADO
========================================================= */
const ST = {
  ONLINE:      { body:"#071a0d", border:"#22c55e", label:"#22c55e", glow:"rgba(34,197,94,.55)",  pulse:false },
  WARNING:     { body:"#1a1000", border:"#f59e0b", label:"#f59e0b", glow:"rgba(245,158,11,.5)",  pulse:false },
  COMPROMISED: { body:"#1a0404", border:"#ef4444", label:"#ef4444", glow:"rgba(239,68,68,.65)",  pulse:true  },
  OFFLINE:     { body:"#0d0d0d", border:"#374151", label:"#4b5563", glow:"rgba(55,65,81,.2)",    pulse:false },
};
const S = (a) => ST[a?.status?.toUpperCase()] ?? ST.ONLINE;

/* =========================================================
   COLORS DE RED / PROTOCOLO
========================================================= */
const NET = {
  field:   "#22c55e",  // VLAN 440 – Campo PLC
  hmi:     "#38bdf8",  // VLAN 902 – HMI
  scada:   "#818cf8",  // VLAN 904 – SCADA
  eng:     "#c084fc",  // VLAN 901 – Engineering
  gw:      "#fbbf24",  // VLAN 903 – Gateway
  inet:    "#64748b",  // WAN / Internet
};

/* =========================================================
   UTILIDADES SVG
========================================================= */
/**
 * Línea de red animada — reacciona al estado del ataque:
 *  "normal"      → color normal, velocidad normal
 *  "suspicious"  → ámbar, velocidad x2 (reconocimiento detectado)
 *  "compromised" → rojo con efecto glitch (ataque activo)
 *  "dead"        → rojo estático roto, sin movimiento (servicio caído)
 */
function DataWire({ d, color, speed = 1.4, rev = false, active = true, width = 1.5, lineState = "normal" }) {
  if (!active) return (
    <path d={d} fill="none" stroke="#1e293b" strokeWidth={width} strokeDasharray="5 5" opacity={0.3} />
  );

  /* ── DEAD: línea rota, sin tráfico ─────────────────────────── */
  if (lineState === "dead") {
    return (
      <g>
        {/* track rojo apagado */}
        <path d={d} fill="none" stroke="#3a0808" strokeWidth={width + 2} opacity={0.55} />
        {/* señal cortada — parpadeo irregular */}
        <path d={d} fill="none" stroke="#ef4444" strokeWidth={width} strokeDasharray="4 10" opacity={0.7}>
          <animate attributeName="opacity" values="0.7;0.05;0.5;0.05;0.7" dur="0.45s" repeatCount="indefinite" />
          <animate attributeName="stroke-dashoffset" values="0;14;0" dur="0.45s" repeatCount="indefinite" />
        </path>
        {/* estática / ruido visual */}
        <path d={d} fill="none" stroke="#ff2222" strokeWidth={width + 3} strokeDasharray="1 18" opacity={0.35}>
          <animate attributeName="stroke-dashoffset" values="0;19;3;11;0" dur="0.18s" repeatCount="indefinite" />
          <animate attributeName="opacity"           values="0.35;0;0.35;0;0.35" dur="0.18s" repeatCount="indefinite" />
        </path>
      </g>
    );
  }

  /* ── SUSPICIOUS: ámbar rápido (reconocimiento) ──────────────── */
  if (lineState === "suspicious") {
    const fastDur = `${speed * 0.45}s`;
    const from = rev ? 0 : 30;
    const to   = rev ? 30 : 0;
    return (
      <g>
        <path d={d} fill="none" stroke="#78350f" strokeWidth={width + 2} opacity={0.35} />
        <path d={d} fill="none" stroke="#f59e0b" strokeWidth={width + 0.5} strokeDasharray="10 6" opacity={0.9}>
          <animate attributeName="stroke-dashoffset" from={from} to={to} dur={fastDur} repeatCount="indefinite" />
        </path>
        {/* pulso secundario */}
        <path d={d} fill="none" stroke="#fcd34d" strokeWidth={width - 0.5} strokeDasharray="5 15" opacity={0.5}>
          <animate attributeName="stroke-dashoffset" from={to} to={from} dur={`${speed * 0.6}s`} repeatCount="indefinite" />
        </path>
      </g>
    );
  }

  /* ── COMPROMISED: rojo con glitch ───────────────────────────── */
  if (lineState === "compromised") {
    const from = rev ? 0 : 24;
    const to   = rev ? 24 : 0;
    return (
      <g>
        {/* glow rojo de fondo */}
        <path d={d} fill="none" stroke="#7f1d1d" strokeWidth={width + 4} opacity={0.4} />
        <path d={d} fill="none" stroke="#991b1b" strokeWidth={width + 1} opacity={0.25} />
        {/* datos maliciosos moviéndose muy rápido */}
        <path d={d} fill="none" stroke="#ef4444" strokeWidth={width + 0.5} strokeDasharray="8 5" opacity={0.92}>
          <animate attributeName="stroke-dashoffset" from={from} to={to} dur="0.3s" repeatCount="indefinite" />
        </path>
        {/* glitch layer 1 — irregular */}
        <path d={d} fill="none" stroke="#ff3333" strokeWidth={width + 2.5} strokeDasharray="2 22" opacity={0.7}>
          <animate attributeName="stroke-dashoffset" values={`0;24;4;18;0`}  dur="0.22s" repeatCount="indefinite" />
          <animate attributeName="opacity"           values="0.7;0;0.6;0;0.7" dur="0.22s" repeatCount="indefinite" />
        </path>
        {/* glitch layer 2 — blanco brillante ocasional */}
        <path d={d} fill="none" stroke="#fca5a5" strokeWidth={width - 0.5} strokeDasharray="1 30" opacity={0.8}>
          <animate attributeName="stroke-dashoffset" values="0;31;8;31;0"   dur="0.15s" repeatCount="indefinite" />
          <animate attributeName="opacity"           values="0.8;0;0;0;0.8" dur="0.15s" repeatCount="indefinite" />
        </path>
      </g>
    );
  }

  /* ── NORMAL ─────────────────────────────────────────────────── */
  const dur  = `${speed}s`;
  const from = rev ? 0 : 30;
  const to   = rev ? 30 : 0;
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={width} opacity={0.18} />
      <path d={d} fill="none" stroke={color} strokeWidth={width + 0.5} strokeDasharray="10 6" opacity={0.85}>
        <animate attributeName="stroke-dashoffset" from={from} to={to} dur={dur} repeatCount="indefinite" />
      </path>
    </g>
  );
}

/* =========================================================
   DETECCIÓN DE ESTADO DE RED SEGÚN ALARMAS ACTIVAS
   Mapea alarm_id → qué segmentos de red están afectados
========================================================= */
function detectNetworkState(alarms) {
  const ids = new Set((alarms || []).map(a => a.alarm_id));
  const has = (...keys) => keys.some(k => ids.has(k));

  const fullCompromise = has("PLANT_FULLY_COMPROMISED");

  return {
    /** VLAN 440 — cables de campo PLC → actuadores/sensores */
    field: fullCompromise || has("CODE_INJECTION", "MOTOR_SABOTAGE", "VALVE_SABOTAGE", "SAFETY_SUPPRESSED")
      ? "compromised"
      : has("S7_RECON", "S7COMM_UNAUTHORIZED_ACCESS", "PLC_DATA_EXFILTRATION")
      ? "suspicious"
      : "normal",

    /** VLAN 902 — enlace HMI ↔ PLC */
    hmi: fullCompromise || has("HMI_COMPROMISE", "CODE_INJECTION")
      ? "compromised"
      : "normal",

    /** VLAN 904 — red SCADA */
    scada: fullCompromise
      ? "compromised"
      : has("SCADA_OFFLINE")
      ? "dead"
      : has("HMI_COMPROMISE")    // credenciales WinCC robadas → sospechoso
      ? "suspicious"
      : "normal",

    /** VLAN 901 — Engineering */
    eng: fullCompromise
      ? "compromised"
      : "normal",

    /** VLAN 903 — Gateway / VPN */
    gw: fullCompromise
      ? "compromised"
      : "normal",

    /** WAN — salida a internet */
    inet: fullCompromise
      ? "compromised"
      : "normal",
  };
}

/** Tubería de proceso con fluido animado */
function Pipe({ d, w = 8, color = "#1e3a5f", flow = true, flowColor = "#3b82f6", speed = 0.9 }) {
  return (
    <g>
      {/* outer (acero) */}
      <path d={d} fill="none" stroke="#1e2a3a" strokeWidth={w + 4} strokeLinecap="round" strokeLinejoin="round" />
      {/* pipe body */}
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      {/* inner highlight */}
      <path d={d} fill="none" stroke="#243650" strokeWidth={w - 4} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
      {/* fluid */}
      {flow && (
        <path d={d} fill="none" stroke={flowColor} strokeWidth={w - 4} strokeLinecap="round"
          strokeDasharray="18 8" opacity={0.7}>
          <animate attributeName="stroke-dashoffset" from="60" to="0" dur={`${speed}s`} repeatCount="indefinite" />
        </path>
      )}
    </g>
  );
}

/** Indicador LED de estado */
function LED({ cx, cy, st }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={5.5} fill={st.body} stroke={st.border} strokeWidth={1} />
      <circle cx={cx} cy={cy} r={3} fill={st.border} opacity={0.9}>
        {st.pulse && <animate attributeName="opacity" values="1;0.2;1" dur="0.8s" repeatCount="indefinite" />}
      </circle>
    </g>
  );
}

/** Cuadro de valor de proceso */
function ValueTag({ x, y, label, value, color = "#94a3b8" }) {
  return (
    <g>
      <rect x={x - 36} y={y - 12} width={72} height={22} rx={3} fill="#090e18" stroke="#1e293b" strokeWidth={0.8} />
      <text x={x} y={y - 1} textAnchor="middle" fontSize={7} fill="#4b5563" fontFamily="monospace">{label}</text>
      <text x={x} y={y + 8} textAnchor="middle" fontSize={9} fill={color} fontFamily="monospace" fontWeight="bold">{value}</text>
    </g>
  );
}

/* =========================================================
   DIBUJOS DE EQUIPOS — vista top-down
========================================================= */

/** PLC Siemens S7-1500 — gabinete en DIN rail visto desde arriba */
function DrawPLC({ cx, cy, st, onClick }) {
  return (
    <g transform={`translate(${cx},${cy})`} style={{ cursor: "pointer" }} onClick={onClick}>
      {/* Glow */}
      <rect x={-58} y={-40} width={116} height={80} rx={6} fill={st.glow} filter="url(#glow)" />
      {/* Cabinet body */}
      <rect x={-56} y={-38} width={112} height={76} rx={5} fill={st.body} stroke={st.border} strokeWidth={1.5} />
      {/* DIN rail */}
      <rect x={-48} y={-3} width={96} height={6} rx={1} fill="#1e293b" stroke="#374151" strokeWidth={0.5} />
      {/* CPU 1511 module */}
      <rect x={-46} y={-32} width={28} height={62} rx={2} fill="#0d1f10" stroke={st.border} strokeWidth={1} />
      {/* CPU screen */}
      <rect x={-42} y={-25} width={20} height={14} rx={1} fill="#0a2a0e" />
      <rect x={-41} y={-24} width={18} height={12} rx={1} fill="#051a08" />
      <text x={-32} y={-16} textAnchor="middle" fontSize={5} fill="#22c55e" fontFamily="monospace">CPU</text>
      {/* CPU LEDs */}
      <circle cx={-39} cy={-6} r={2} fill={st.border} />
      <circle cx={-34} cy={-6} r={2} fill="#f59e0b" />
      <circle cx={-29} cy={-6} r={2} fill={st.border} />
      {/* I/O Module 1 */}
      <rect x={-15} y={-32} width={18} height={62} rx={1.5} fill="#0a1520" stroke="#1e3a5f" strokeWidth={0.7} />
      <line x1={-13} y1={-26} x2={1} y2={-26} stroke="#1e3a5f" strokeWidth={0.5} />
      {[...Array(8)].map((_,i) => (
        <rect key={i} x={-13} y={-23 + i*7} width={12} height={5} rx={0.5} fill="#071020" stroke="#1e293b" strokeWidth={0.3} />
      ))}
      {/* I/O Module 2 */}
      <rect x={6} y={-32} width={18} height={62} rx={1.5} fill="#0a1520" stroke="#1e3a5f" strokeWidth={0.7} />
      {[...Array(8)].map((_,i) => (
        <rect key={i} x={8} y={-23 + i*7} width={12} height={5} rx={0.5} fill="#071020" stroke="#1e293b" strokeWidth={0.3} />
      ))}
      {/* I/O Module 3 */}
      <rect x={27} y={-32} width={18} height={62} rx={1.5} fill="#0a1520" stroke="#1e3a5f" strokeWidth={0.7} />
      {[...Array(8)].map((_,i) => (
        <rect key={i} x={29} y={-23 + i*7} width={12} height={5} rx={0.5} fill="#071020" stroke="#1e293b" strokeWidth={0.3} />
      ))}
      {/* Cable entry bottom */}
      <rect x={-45} y={30} width={8} height={8} rx={1} fill="#050a0f" stroke="#1e293b" strokeWidth={0.5} />
      <rect x={-34} y={30} width={8} height={8} rx={1} fill="#050a0f" stroke="#1e293b" strokeWidth={0.5} />
      <rect x={-23} y={30} width={8} height={8} rx={1} fill="#050a0f" stroke="#1e293b" strokeWidth={0.5} />
      <rect x={8}   y={30} width={8} height={8} rx={1} fill="#050a0f" stroke="#1e293b" strokeWidth={0.5} />
      <rect x={20}  y={30} width={8} height={8} rx={1} fill="#050a0f" stroke="#1e293b" strokeWidth={0.5} />
      {/* Label */}
      <text x={0} y={52} textAnchor="middle" fontSize={8.5} fill={st.label} fontFamily="monospace" fontWeight="bold">PLC-001</text>
      <text x={0} y={62} textAnchor="middle" fontSize={7}   fill="#4b5563" fontFamily="monospace">S7-1500 · 172.16.100.10</text>
    </g>
  );
}

/** HMI KP400 — panel de operador montado en pared, vista superior */
function DrawHMI({ cx, cy, st, onClick }) {
  return (
    <g transform={`translate(${cx},${cy})`} style={{ cursor: "pointer" }} onClick={onClick}>
      <rect x={-38} y={-32} width={76} height={64} rx={4} fill={st.glow} filter="url(#glow)" />
      {/* Panel body (thin depth from top) */}
      <rect x={-36} y={-30} width={72} height={60} rx={3} fill={st.body} stroke={st.border} strokeWidth={1.5} />
      {/* Screen */}
      <rect x={-28} y={-22} width={56} height={38} rx={2} fill="#050e18" />
      <rect x={-26} y={-20} width={52} height={34} rx={1.5} fill="#03080f" />
      {/* Screen content simulation */}
      <rect x={-24} y={-18} width={48} height={8}  rx={1} fill="#071a0d" opacity={0.8} />
      <text x={0} y={-12} textAnchor="middle" fontSize={5} fill="#22c55e" fontFamily="monospace">PROD LINE 01</text>
      <rect x={-24} y={-7}  width={20} height={5}  rx={0.5} fill="#0a2015" />
      <rect x={-2}  y={-7}  width={26} height={5}  rx={0.5} fill="#0a2015" />
      <rect x={-24} y={-0}  width={14} height={5}  rx={0.5} fill="#0a2015" />
      <rect x={-8}  y={-0}  width={32} height={5}  rx={0.5} fill="#1a0505" />
      <rect x={-24} y={7}   width={48} height={5}  rx={0.5} fill="#0a2015" />
      {/* Touch buttons (bottom row) */}
      <circle cx={-20} cy={22} r={4} fill="#0d1a0f" stroke="#22c55e" strokeWidth={0.7} />
      <circle cx={-8}  cy={22} r={4} fill="#0d1a0f" stroke="#374151" strokeWidth={0.7} />
      <circle cx={4}   cy={22} r={4} fill="#1a0000" stroke="#ef4444" strokeWidth={0.7} />
      <circle cx={16}  cy={22} r={4} fill="#0d1a0f" stroke="#374151" strokeWidth={0.7} />
      {/* Wall mount */}
      <rect x={-36} y={-35} width={8} height={6}  rx={1} fill="#0d1520" stroke="#1e293b" strokeWidth={0.5} />
      <rect x={28}  y={-35} width={8} height={6}  rx={1} fill="#0d1520" stroke="#1e293b" strokeWidth={0.5} />
      {/* Labels */}
      <text x={0} y={45} textAnchor="middle" fontSize={8.5} fill={st.label} fontFamily="monospace" fontWeight="bold">HMI-001</text>
      <text x={0} y={55} textAnchor="middle" fontSize={7}   fill="#4b5563" fontFamily="monospace">KP400 · 172.16.102.10</text>
    </g>
  );
}

/** SCADA Server (WinCC) — rack de servidor 1U desde arriba */
function DrawServer({ cx, cy, st, label, ip, onClick }) {
  return (
    <g transform={`translate(${cx},${cy})`} style={{ cursor: "pointer" }} onClick={onClick}>
      <rect x={-55} y={-28} width={110} height={56} rx={4} fill={st.glow} filter="url(#glow)" />
      <rect x={-53} y={-26} width={106} height={52} rx={3} fill={st.body} stroke={st.border} strokeWidth={1.2} />
      {/* 1U Server */}
      <rect x={-48} y={-20} width={96} height={18} rx={2} fill="#050d18" stroke="#1e3a5f" strokeWidth={0.7} />
      {/* Drive bays */}
      {[...Array(6)].map((_,i) => (
        <rect key={i} x={-44 + i * 14} y={-17} width={10} height={11} rx={0.5} fill="#071020" stroke="#0d2040" strokeWidth={0.3} />
      ))}
      {/* Activity LEDs on server */}
      <circle cx={-40} cy={-2} r={2} fill={st.border}><animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" /></circle>
      <circle cx={-34} cy={-2} r={2} fill={st.border}><animate attributeName="opacity" values="1;0.3;1" dur="0.7s" repeatCount="indefinite" /></circle>
      <circle cx={-28} cy={-2} r={2} fill={st.border}><animate attributeName="opacity" values="1;0.3;1" dur="1.8s" repeatCount="indefinite" /></circle>
      {/* 2nd 1U */}
      <rect x={-48} y={1} width={96} height={14} rx={2} fill="#040c15" stroke="#1e3a5f" strokeWidth={0.7} />
      {[...Array(4)].map((_,i) => (
        <rect key={i} x={-44 + i * 22} y={3} width={17} height={9} rx={0.5} fill="#060e1e" stroke="#0d2040" strokeWidth={0.3} />
      ))}
      {/* Port panel */}
      <rect x={-48} y={18} width={96} height={10} rx={1.5} fill="#030912" stroke="#1e293b" strokeWidth={0.5} />
      {[...Array(8)].map((_,i) => (
        <rect key={i} x={-44 + i * 11} y={20} width={7} height={6} rx={0.5} fill="#071020" />
      ))}
      <text x={0} y={38} textAnchor="middle" fontSize={8.5} fill={st.label} fontFamily="monospace" fontWeight="bold">{label}</text>
      <text x={0} y={48} textAnchor="middle" fontSize={7}   fill="#4b5563" fontFamily="monospace">{ip}</text>
    </g>
  );
}

/** Engineering Workstation — escritorio con monitor, vista superior */
function DrawWorkstation({ cx, cy, st, onClick }) {
  return (
    <g transform={`translate(${cx},${cy})`} style={{ cursor: "pointer" }} onClick={onClick}>
      <rect x={-52} y={-32} width={104} height={64} rx={4} fill={st.glow} filter="url(#glow)" />
      {/* Desk surface */}
      <rect x={-50} y={-30} width={100} height={60} rx={3} fill="#0a0e18" stroke={st.border} strokeWidth={1.2} />
      {/* Monitor */}
      <rect x={-36} y={-24} width={72} height={44} rx={2} fill="#050d18" stroke="#1e3a5f" strokeWidth={0.8} />
      <rect x={-33} y={-21} width={66} height={38} rx={1} fill="#03080f" />
      {/* TIA Portal simulation */}
      <rect x={-31} y={-19} width={62} height={6}  rx={0.5} fill="#0a1a0d" />
      <text x={0} y={-14} textAnchor="middle" fontSize={5} fill="#22c55e" fontFamily="monospace">TIA PORTAL V19</text>
      <rect x={-31} y={-11} width={16} height={22} rx={0.5} fill="#071020" />
      <rect x={-13} y={-11} width={44} height={22} rx={0.5} fill="#050d18" />
      {/* Code lines */}
      {[...Array(5)].map((_,i) => (
        <rect key={i} x={-11} y={-9 + i*4} width={30 + (i%3)*6} height={2} rx={0.5} fill="#1e3a5f" opacity={0.7} />
      ))}
      <rect x={-31} y={13} width={62} height={4} rx={0.5} fill="#071a0d" />
      {/* Keyboard */}
      <rect x={-28} y={22} width={56} height={8} rx={1.5} fill="#050912" stroke="#1e293b" strokeWidth={0.5} />
      {[...Array(10)].map((_,i) => (
        <rect key={i} x={-26 + i * 5} y={23.5} width={4} height={5} rx={0.5} fill="#0a1020" />
      ))}
      <text x={0} y={46} textAnchor="middle" fontSize={8.5} fill={st.label} fontFamily="monospace" fontWeight="bold">ENG-001</text>
      <text x={0} y={56} textAnchor="middle" fontSize={7}   fill="#4b5563" fontFamily="monospace">TIA Portal · 172.16.105.10</text>
    </g>
  );
}

/** Gateway eWON Cosy+ — dispositivo DIN pequeño */
function DrawGateway({ cx, cy, st, onClick }) {
  return (
    <g transform={`translate(${cx},${cy})`} style={{ cursor: "pointer" }} onClick={onClick}>
      <rect x={-32} y={-28} width={64} height={56} rx={4} fill={st.glow} filter="url(#glow)" />
      <rect x={-30} y={-26} width={60} height={52} rx={3} fill={st.body} stroke={st.border} strokeWidth={1.2} />
      {/* Device body */}
      <rect x={-24} y={-18} width={48} height={28} rx={2} fill="#050d18" stroke="#1e293b" strokeWidth={0.7} />
      {/* Antenna symbol */}
      <line x1={0} y1={-26} x2={0} y2={-20} stroke={st.border} strokeWidth={1.5} />
      <path d="M-8,-22 Q0,-28 8,-22" fill="none" stroke={st.border} strokeWidth={1} />
      <path d="M-5,-25 Q0,-30 5,-25" fill="none" stroke={st.border} strokeWidth={0.7} opacity={0.6} />
      {/* LEDs */}
      <circle cx={-15} cy={-4} r={3} fill="#22c55e"><animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" /></circle>
      <circle cx={-7}  cy={-4} r={3} fill={st.border}><animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" /></circle>
      <circle cx={1}   cy={-4} r={3} fill={st.border} />
      {/* Ports */}
      <rect x={-22} y={5} width={8} height={5} rx={0.5} fill="#040c15" stroke="#1e293b" strokeWidth={0.3} />
      <rect x={-11} y={5} width={8} height={5} rx={0.5} fill="#040c15" stroke="#1e293b" strokeWidth={0.3} />
      <rect x={0}   y={5} width={8} height={5} rx={0.5} fill="#040c15" stroke="#1e293b" strokeWidth={0.3} />
      <text x={0} y={42} textAnchor="middle" fontSize={8}   fill={st.label} fontFamily="monospace" fontWeight="bold">GW-001</text>
      <text x={0} y={52} textAnchor="middle" fontSize={6.5} fill="#4b5563" fontFamily="monospace">eWON Cosy+ · VPN</text>
    </g>
  );
}

/** Motor SIMOTICS — bombeo/motor visto desde arriba, con rotor animado */
function DrawMotor({ cx, cy, st, speed = 1450, onClick }) {
  const period = speed > 50 ? Math.max(0.3, 3 - (speed / 1450) * 2.5) : 99;
  const animStyle = speed > 50 ? { animation: `spin ${period}s linear infinite`, transformOrigin: `${cx}px ${cy}px` } : {};
  return (
    <g style={{ cursor: "pointer" }} onClick={onClick}>
      {/* Glow */}
      <circle cx={cx} cy={cy} r={42} fill={st.glow} filter="url(#glow)" />
      {/* Outer casing */}
      <circle cx={cx} cy={cy} r={40} fill={st.body} stroke={st.border} strokeWidth={1.5} />
      {/* Fin cooling ribs */}
      {[...Array(12)].map((_,i) => {
        const a = (i / 12) * Math.PI * 2;
        const x1 = cx + Math.cos(a) * 30;
        const y1 = cy + Math.sin(a) * 30;
        const x2 = cx + Math.cos(a) * 40;
        const y2 = cy + Math.sin(a) * 40;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={st.border} strokeWidth={1.2} opacity={0.5} />;
      })}
      {/* Inner rotor (animated) */}
      <g style={animStyle}>
        <circle cx={cx} cy={cy} r={23} fill={st.body} stroke={st.border} strokeWidth={0.8} />
        {/* Impeller vanes */}
        {[0, 60, 120, 180, 240, 300].map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = cx + Math.cos(rad) * 8;
          const y1 = cy + Math.sin(rad) * 8;
          const x2 = cx + Math.cos(rad) * 20;
          const y2 = cy + Math.sin(rad) * 20;
          const xc = cx + Math.cos(rad + 0.5) * 14;
          const yc = cy + Math.sin(rad + 0.5) * 14;
          return (
            <path key={i}
              d={`M${x1},${y1} Q${xc},${yc} ${x2},${y2}`}
              fill="none" stroke={st.border} strokeWidth={2.5} strokeLinecap="round" opacity={0.7}
            />
          );
        })}
        {/* Shaft center */}
        <circle cx={cx} cy={cy} r={6} fill="#0a1520" stroke={st.border} strokeWidth={1} />
        <circle cx={cx} cy={cy} r={3} fill={st.border} opacity={0.7} />
      </g>
      {/* Shaft output */}
      <line x1={cx + 40} y1={cy} x2={cx + 52} y2={cy} stroke={st.border} strokeWidth={4} strokeLinecap="round" />
      {/* Label */}
      <text x={cx} y={cy + 60} textAnchor="middle" fontSize={8.5} fill={st.label} fontFamily="monospace" fontWeight="bold">M-001</text>
      <text x={cx} y={cy + 70} textAnchor="middle" fontSize={7}   fill="#4b5563" fontFamily="monospace">SIMOTICS · {speed.toFixed(0)} RPM</text>
    </g>
  );
}

/** CNC — celda de mecanizado, vista superior */
function DrawCNC({ cx, cy, st, running = true, onClick }) {
  return (
    <g transform={`translate(${cx},${cy})`} style={{ cursor: "pointer" }} onClick={onClick}>
      {/* Glow */}
      <rect x={-85} y={-72} width={170} height={144} rx={8} fill={st.glow} filter="url(#glow)" />
      {/* Machine enclosure */}
      <rect x={-83} y={-70} width={166} height={140} rx={7} fill={st.body} stroke={st.border} strokeWidth={1.5} />
      {/* Work zone (chip guard) */}
      <rect x={-65} y={-55} width={130} height={95} rx={3} fill="#040c12" stroke="#1e3a5f" strokeWidth={1} />
      {/* Coolant channels */}
      <line x1={-65} y1={-20} x2={65}  y2={-20} stroke="#0a1a30" strokeWidth={2} />
      <line x1={-65} y1={10}  x2={65}  y2={10}  stroke="#0a1a30" strokeWidth={2} />
      {/* Workpiece area */}
      <rect x={-30} y={-35} width={60} height={55} rx={2} fill="#050f1a" stroke="#1e293b" strokeWidth={0.7} />
      {/* Tool/Spindle */}
      <circle cx={0} cy={-7} r={12} fill="#0a1520" stroke={st.border} strokeWidth={1} />
      {running ? (
        <g style={{ animation: "spin 0.4s linear infinite", transformOrigin: "0px -7px" }}>
          {[0, 120, 240].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line key={i}
                x1={0} y1={-7}
                x2={Math.cos(rad) * 10} y2={-7 + Math.sin(rad) * 10}
                stroke={st.border} strokeWidth={2.5} strokeLinecap="round"
              />
            );
          })}
        </g>
      ) : (
        <circle cx={0} cy={-7} r={6} fill="#1e293b" />
      )}
      <circle cx={0} cy={-7} r={3} fill={running ? st.border : "#374151"} />
      {/* Tool holder */}
      <rect x={-4} y={5} width={8} height={18} rx={1} fill="#0d1f2a" stroke="#1e3a5f" strokeWidth={0.5} />
      {/* Chip removal */}
      {running && (
        <>
          <circle cx={22}  cy={5}  r={2} fill="#3b82f6" opacity={0.4}><animate attributeName="cx" values="22;40;22" dur="0.8s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.4;0;0.4" dur="0.8s" repeatCount="indefinite" /></circle>
          <circle cx={-20} cy={15} r={2} fill="#3b82f6" opacity={0.4}><animate attributeName="cx" values="-20;-45;-20" dur="1.1s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.4;0;0.4" dur="1.1s" repeatCount="indefinite" /></circle>
        </>
      )}
      {/* Control panel on machine */}
      <rect x={50} y={-55} width={28} height={40} rx={2} fill="#050d18" stroke="#1e293b" strokeWidth={0.5} />
      <rect x={52} y={-53} width={24} height={22} rx={1} fill="#030812" />
      <circle cx={58} cy={-24} r={3} fill={running ? "#22c55e" : "#374151"} />
      <circle cx={68} cy={-24} r={3} fill="#ef4444" />
      {/* Labels */}
      <text x={0} y={85}  textAnchor="middle" fontSize={9}   fill={st.label} fontFamily="monospace" fontWeight="bold">CNC-001</text>
      <text x={0} y={96}  textAnchor="middle" fontSize={7}   fill="#4b5563" fontFamily="monospace">Machining Cell · {running ? "PRODUCING" : "STOPPED"}</text>
    </g>
  );
}

/** Válvula de control — vista superior (butterfly valve) */
function DrawValve({ cx, cy, st, position = 50, onClick }) {
  const angle = ((position / 100) * 70) - 35;   // -35° (cerrada) a +35° (abierta)
  const rad   = (angle * Math.PI) / 180;
  const dx    = Math.cos(rad) * 14;
  const dy    = Math.sin(rad) * 14;
  return (
    <g transform={`translate(${cx},${cy})`} style={{ cursor: "pointer" }} onClick={onClick}>
      {/* Glow */}
      <circle cx={0} cy={0} r={24} fill={st.glow} filter="url(#glow)" />
      {/* Pipe connection stubs */}
      <rect x={-35} y={-6} width={16} height={12} rx={1} fill="#1e3a5f" />
      <rect x={19}  y={-6} width={16} height={12} rx={1} fill="#1e3a5f" />
      {/* Valve body */}
      <circle cx={0} cy={0} r={20} fill={st.body} stroke={st.border} strokeWidth={1.5} />
      {/* Pipe bore (through) */}
      <ellipse cx={0} cy={0} rx={16} ry={7} fill="#040c15" />
      {/* Butterfly disc */}
      <line x1={-dx} y1={-dy} x2={dx} y2={dy}
        stroke={st.border} strokeWidth={5} strokeLinecap="round" opacity={0.9}
      />
      <line x1={-dx} y1={-dy} x2={dx} y2={dy}
        stroke={st.label} strokeWidth={2.5} strokeLinecap="round"
      />
      {/* Actuator stem */}
      <line x1={0} y1={-20} x2={0} y2={-30} stroke={st.border} strokeWidth={3} strokeLinecap="round" />
      <rect x={-6} y={-36} width={12} height={10} rx={2} fill={st.body} stroke={st.border} strokeWidth={1} />
      {/* Position label */}
      <text x={0} y={38}  textAnchor="middle" fontSize={8.5} fill={st.label} fontFamily="monospace" fontWeight="bold">V-001</text>
      <text x={0} y={48}  textAnchor="middle" fontSize={7}   fill="#4b5563" fontFamily="monospace">{position.toFixed(0)}% open</text>
    </g>
  );
}

/** Transmisor de temperatura TT-001 — termopozo inline */
function DrawTempSensor({ cx, cy, st, value, onClick }) {
  return (
    <g transform={`translate(${cx},${cy})`} style={{ cursor: "pointer" }} onClick={onClick}>
      <circle cx={0} cy={0} r={18} fill={st.glow} filter="url(#glow)" />
      {/* Transmitter body */}
      <circle cx={0} cy={0} r={16} fill={st.body} stroke={st.border} strokeWidth={1.2} />
      {/* T symbol */}
      <text x={0} y={3} textAnchor="middle" fontSize={12} fill={st.label} fontFamily="monospace" fontWeight="bold">T</text>
      {/* Thermowell probe (goes into pipe) */}
      <line x1={0} y1={16} x2={0} y2={26} stroke={st.border} strokeWidth={3} strokeLinecap="round" />
      <line x1={0} y1={-16} x2={0} y2={-26} stroke={st.border} strokeWidth={3} strokeLinecap="round" />
      {/* Labels */}
      <text x={0} y={42}  textAnchor="middle" fontSize={8.5} fill={st.label} fontFamily="monospace" fontWeight="bold">TT-001</text>
      <text x={0} y={52}  textAnchor="middle" fontSize={7}   fill={value > 80 ? "#ef4444" : "#4b5563"} fontFamily="monospace">{value?.toFixed(1)}°C</text>
    </g>
  );
}

/** Transmisor de presión PT-001 — manómetro inline */
function DrawPressSensor({ cx, cy, st, value, onClick }) {
  const angle = Math.min(Math.max(((value - 3.0) / 1.5) * 120 - 60, -60), 60);
  const rad   = ((angle - 90) * Math.PI) / 180;
  const nx    = Math.cos(rad) * 9;
  const ny    = Math.sin(rad) * 9;
  return (
    <g transform={`translate(${cx},${cy})`} style={{ cursor: "pointer" }} onClick={onClick}>
      <circle cx={0} cy={0} r={18} fill={st.glow} filter="url(#glow)" />
      <circle cx={0} cy={0} r={16} fill={st.body} stroke={st.border} strokeWidth={1.2} />
      {/* Gauge arc */}
      <path d="M-11,6 A12,12 0 1,1 11,6" fill="none" stroke="#1e293b" strokeWidth={2} />
      <path d="M-11,6 A12,12 0 1,1 11,6" fill="none" stroke={value > 4.3 ? "#ef4444" : st.border} strokeWidth={1.5}
        strokeDasharray={`${Math.min(value / 4.5 * 40, 40)} 40`} />
      {/* Needle */}
      <line x1={0} y1={0} x2={nx} y2={ny} stroke={st.label} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={0} cy={0} r={2} fill={st.border} />
      {/* P label */}
      <text x={0} y={4} textAnchor="middle" fontSize={6} fill={st.label} fontFamily="monospace" fontWeight="bold">P</text>
      {/* Connection */}
      <line x1={0} y1={16} x2={0} y2={26} stroke={st.border} strokeWidth={3} strokeLinecap="round" />
      <text x={0} y={42}  textAnchor="middle" fontSize={8.5} fill={st.label} fontFamily="monospace" fontWeight="bold">PT-001</text>
      <text x={0} y={52}  textAnchor="middle" fontSize={7}   fill={value > 4.3 ? "#ef4444" : "#4b5563"} fontFamily="monospace">{value?.toFixed(2)} bar</text>
    </g>
  );
}

/** Tanque/recipiente de proceso — vista superior */
function DrawVessel({ cx, cy, st, level = 75, onClick }) {
  return (
    <g transform={`translate(${cx},${cy})`} style={{ cursor: "pointer" }} onClick={onClick}>
      {/* Glow */}
      <circle cx={0} cy={0} r={54} fill={st.glow} filter="url(#glow)" />
      {/* Outer shell */}
      <circle cx={0} cy={0} r={52} fill={st.body} stroke={st.border} strokeWidth={1.5} />
      {/* Insulation band */}
      <circle cx={0} cy={0} r={46} fill="none" stroke="#1e293b" strokeWidth={3} strokeDasharray="8 4" />
      {/* Level fill (as arc/clip) */}
      <clipPath id="vessel-clip">
        <circle cx={0} cy={0} r={40} />
      </clipPath>
      <rect x={-40} y={40 - level * 0.8} width={80} height={level * 0.8} fill="#1e3a5f" opacity={0.5} clipPath="url(#vessel-clip)" />
      {/* Inner wall */}
      <circle cx={0} cy={0} r={40} fill="none" stroke="#1e3a5f" strokeWidth={1} />
      {/* Manway (top access) */}
      <circle cx={0} cy={0} r={12} fill="#0a1520" stroke="#2a4a6f" strokeWidth={1} />
      {[0, 60, 120, 180, 240, 300].map((d, i) => {
        const r = (d * Math.PI) / 180;
        return <circle key={i} cx={Math.cos(r)*12} cy={Math.sin(r)*12} r={2} fill="#1e3a5f" />;
      })}
      {/* Nozzles */}
      <rect x={44}  y={-4}  width={10} height={8} rx={1} fill="#1e3a5f" />
      <rect x={-54} y={-4}  width={10} height={8} rx={1} fill="#1e3a5f" />
      <rect x={-4}  y={44}  width={8}  height={10} rx={1} fill="#1e3a5f" />
      {/* Level bubble animation */}
      {level > 20 && (
        <>
          <circle cx={-12} cy={15} r={3} fill="#3b82f6" opacity={0.4}>
            <animate attributeName="cy" values="15;-5;15" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx={8} cy={20} r={2} fill="#3b82f6" opacity={0.3}>
            <animate attributeName="cy" values="20;0;20" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="2.2s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      <text x={0} y={72} textAnchor="middle" fontSize={8.5} fill={st.label} fontFamily="monospace" fontWeight="bold">VESSEL-001</text>
      <text x={0} y={82} textAnchor="middle" fontSize={7}   fill="#4b5563" fontFamily="monospace">Feed Tank · {level}% level</text>
    </g>
  );
}

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */
export default function PhysicalPlant({ plant, equipment = [], events = [] }) {

  const [selected,       setSelected]       = useState(null);
  const [interfaceAsset, setInterfaceAsset] = useState(null);

  const getA = (id) => equipment.find(a => a.asset_id === id);

  const assets = {
    plc:   getA("PLC-001"),
    hmi:   getA("HMI-001"),
    scada: getA("SCADA-001"),
    gw:    getA("GW-001"),
    eng:   getA("ENG-001"),
    cnc:   getA("CNC-001"),
    motor: getA("M-001"),
    tt:    getA("TT-001"),
    pt:    getA("PT-001"),
    valve: getA("V-001"),
  };

  const proc = plant?.process;
  const motorSpeed   = proc?.motor_speed   ?? 0;
  const valvePos     = proc?.valve_position ?? 50;
  const temperature  = proc?.temperature   ?? 68;
  const pressure     = proc?.pressure      ?? 3.8;
  const prodRunning  = proc?.production_running ?? true;
  const prodRate     = proc?.production_rate    ?? 100;

  const flowActive  = prodRunning && motorSpeed > 50;

  /* Estado de la alarma global para efectos */
  const alarms    = plant?.alarms?.active ?? [];
  const critical  = alarms.some(a => a.severity === "CRITICAL");

  /* Estado de cada segmento de red basado en alarmas activas */
  const netState  = detectNetworkState(alarms);
  const anyBreach = Object.values(netState).some(s => s === "compromised" || s === "dead");
  const anySuspicious = !anyBreach && Object.values(netState).some(s => s === "suspicious");

  if (interfaceAsset) {
    return (
      <EquipmentInterface
        asset={interfaceAsset}
        plant={plant}
        process={proc}
        events={events}
        onBack={() => setInterfaceAsset(null)}
      />
    );
  }

  /* ── helper status abreviado ── */
  const s  = (key) => S(assets[key]);
  const ok = ST.ONLINE;

  return (
    <div style={{ position:"relative", width:"100%", height:"calc(100vh - 185px)", minHeight:580, overflow:"hidden" }}>

      {/* ══ SVG PRINCIPAL ════════════════════════════════════════════════ */}
      <svg
        viewBox="0 0 1200 655"
        style={{ width:"100%", height:"100%", background:"#060b12" }}
        onClick={() => setSelected(null)}
      >

        {/* ── DEFS ─────────────────────────────────────────────────────── */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="strong-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Grid pattern */}
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#0d1520" strokeWidth="0.5" />
          </pattern>
          {/* Hazard stripe */}
          <pattern id="hazard" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="14" fill="#1a1200" />
            <rect x="7" width="7" height="14" fill="#0f0c00" />
          </pattern>
          {/* Arrow marker for data flows */}
          <marker id="arrow-green"  markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={NET.field} /></marker>
          <marker id="arrow-blue"   markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={NET.hmi}   /></marker>
          <marker id="arrow-indigo" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={NET.scada} /></marker>
          <marker id="arrow-purple" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={NET.eng}   /></marker>
          <marker id="arrow-amber"  markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={NET.gw}    /></marker>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
        </defs>

        {/* ── SUELO / FONDO ─────────────────────────────────────────────── */}
        <rect width="1200" height="655" fill="url(#grid)" />

        {/* ═══ ZONA SALA DE CONTROL (arriba) ═══ */}
        <rect x={0} y={0} width={1200} height={168} fill="#07111e" opacity={0.9} />
        <rect x={0} y={0} width={1200} height={168} fill="url(#grid)" opacity={0.3} />
        {/* Pared de separación */}
        <rect x={0} y={162} width={1200} height={6} fill="#1e2a3a" />
        <line x1={0} y1={162} x2={1200} y2={162} stroke="#2a3f5f" strokeWidth={1} />
        <line x1={0} y1={168} x2={1200} y2={168} stroke="#0d1520" strokeWidth={1} />
        {/* Etiqueta sala de control */}
        <text x={20} y={14} fontSize={9} fill="#2a4a6f" fontFamily="monospace" fontWeight="bold" letterSpacing="2">CONTROL ROOM</text>

        {/* ═══ ZONA SALA PLC / ARMARIO (izquierda) ═══ */}
        <rect x={0} y={168} width={225} height={487} fill="#07121a" opacity={0.85} />
        <rect x={0} y={168} width={225} height={487} fill="url(#grid)" opacity={0.2} />
        <rect x={219} y={168} width={6} height={487} fill="#1e2a3a" />
        <line x1={219} y1={168} x2={219} y2={655} stroke="#2a3f5f" strokeWidth={1} />
        {/* Etiqueta sala PLC */}
        <text x={15} y={190} fontSize={8} fill="#1e3a5f" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">PLC ROOM</text>

        {/* ═══ SUELO DE PRODUCCIÓN ═══ */}
        <rect x={225} y={168} width={975} height={487} fill="url(#grid)" opacity={0.6} />
        <text x={245} y={190} fontSize={9} fill="#1e2a3a" fontFamily="monospace" fontWeight="bold" letterSpacing="2">PRODUCTION FLOOR — LINE 01</text>

        {/* Marcas de suelo (rayas amarillas de seguridad) */}
        {[340, 580, 870, 1060].map((x, i) => (
          <g key={i}>
            <rect x={x - 50} y={555} width={100} height={18} fill="url(#hazard)" opacity={0.35} rx={2} />
          </g>
        ))}
        {/* Lineas de piso (caminos peatonales) */}
        <line x1={225} y1={368} x2={1190} y2={368} stroke="#0d1f30" strokeWidth={1.5} strokeDasharray="20 10" />

        {/* ═══ CANAL DE CABLES (cable tray) ═══ */}
        {/* Cable tray horizontal superior del piso (y≈390) */}
        <rect x={210} y={560} width={975} height={14} rx={2} fill="#0a1520" stroke="#1e293b" strokeWidth={0.8} opacity={0.8} />
        <line x1={210} y1={566} x2={1185} y2={566} stroke="#070f18" strokeWidth={2} />
        {/* Divisiones del cable tray */}
        {[...Array(18)].map((_,i) => (
          <line key={i} x1={265 + i * 52} y1={560} x2={265 + i * 52} y2={574} stroke="#0d1a28" strokeWidth={0.5} />
        ))}
        <text x={215} y={572} fontSize={7} fill="#1e3a5f" fontFamily="monospace">CABLE TRAY — VLAN 440</text>

        {/* Cable tray vertical PLC room */}
        <rect x={170} y={168} width={14} height={395} rx={2} fill="#0a1520" stroke="#1e293b" strokeWidth={0.8} opacity={0.8} />
        <line x1={177} y1={168} x2={177} y2={563} stroke="#070f18" strokeWidth={2} />
        {[...Array(13)].map((_,i) => (
          <line key={i} x1={170} y1={200 + i * 30} x2={184} y2={200 + i * 30} stroke="#0d1a28" strokeWidth={0.5} />
        ))}

        {/* ═══════════════════════════════════════════════
            TUBERÍAS DE PROCESO (proceso real)
        ═══════════════════════════════════════════════ */}

        {/* Bajada del tanque al header */}
        <Pipe d="M 338 488 L 338 535" w={12} flow={flowActive} speed={0.9} />

        {/* Header principal — corrida horizontal */}
        <Pipe d="M 290 535 L 1145 535" w={12} flow={flowActive} speed={0.7} />

        {/* Subida al motor */}
        <Pipe d="M 820 535 L 820 497" w={10} flow={flowActive} speed={0.9} />

        {/* Tubería de salida hacia CNC */}
        <Pipe d="M 860 490 C 900 490 920 478 960 478" w={8} flow={flowActive} speed={1.0} />

        {/* Drenaje / by-pass */}
        <Pipe d="M 460 535 L 460 518" w={8} flow={flowActive && valvePos > 10} speed={1.2}
          color="#0d2a4a" flowColor={valvePos > 80 ? "#60a5fa" : "#3b82f6"} />

        {/* ── Etiquetas de tuberías ── */}
        <rect x={360} y={528} width={80} height={14} rx={2} fill="#060e18" />
        <text x={400} y={538} textAnchor="middle" fontSize={7} fill="#1e3a5f" fontFamily="monospace">PROCESS LINE Ø100</text>
        <rect x={660} y={528} width={80} height={14} rx={2} fill="#060e18" />
        <text x={700} y={538} textAnchor="middle" fontSize={7} fill="#1e3a5f" fontFamily="monospace">PROCESS LINE Ø100</text>
        <rect x={880} y={528} width={80} height={14} rx={2} fill="#060e18" />
        <text x={920} y={538} textAnchor="middle" fontSize={7} fill="#1e3a5f" fontFamily="monospace">PROCESS LINE Ø100</text>

        {/* ═══════════════════════════════════════════════
            CABLES / SEÑALES DE CONTROL
            (PLC → campo: verde, animadas)
        ═══════════════════════════════════════════════ */}

        {/* PLC → Válvula V-001 (control 4-20mA)  ─ VLAN 440 */}
        <DataWire color={NET.field} speed={1.5}
          d="M 184 455 L 210 455 L 210 565 L 460 565 L 460 548"
          active={!!assets.plc && !!assets.valve}
          lineState={netState.field} />

        {/* TT-001 → PLC (temperatura, señal de entrada)  ─ VLAN 440 */}
        <DataWire color={NET.field} speed={1.2} rev
          d="M 600 548 L 600 565 L 210 565 L 210 465 L 184 465"
          active={!!assets.tt && !!assets.plc}
          lineState={netState.field} />

        {/* PT-001 → PLC  ─ VLAN 440 */}
        <DataWire color={NET.field} speed={1.0} rev
          d="M 680 548 L 680 570 L 205 570 L 205 475 L 184 475"
          active={!!assets.pt && !!assets.plc}
          lineState={netState.field} />

        {/* PLC → Motor M-001  ─ VLAN 440 */}
        <DataWire color={NET.field} speed={1.3}
          d="M 184 445 L 210 445 L 210 575 L 820 575 L 820 537"
          active={!!assets.plc && !!assets.motor}
          lineState={netState.field} />

        {/* PLC → CNC-001  ─ VLAN 440 */}
        <DataWire color={NET.field} speed={1.6}
          d="M 184 440 L 210 440 L 210 580 L 1070 580 L 1070 510"
          active={!!assets.plc && !!assets.cnc}
          lineState={netState.field} />

        {/* ═══ CABLES RED IT/OT (sala de control → PLC) ═══ */}

        {/* HMI → SCADA (sube a sala de control)  ─ VLAN 902 */}
        <DataWire color={NET.hmi} speed={1.5}
          d="M 112 295 L 112 168 L 300 168 L 300 130"
          active={!!assets.hmi && !!assets.scada}
          lineState={netState.hmi} />

        {/* PLC ↔ HMI — dirección A  ─ VLAN 902 */}
        <DataWire color={NET.hmi} speed={1.2}
          d="M 145 430 L 145 310"
          active={!!assets.plc && !!assets.hmi}
          lineState={netState.hmi} />
        {/* PLC ↔ HMI — dirección B (rev)  ─ VLAN 902 */}
        <DataWire color={NET.hmi} speed={1.2} rev
          d="M 155 430 L 155 310"
          active={!!assets.plc && !!assets.hmi}
          lineState={netState.hmi} />

        {/* PLC → SCADA  ─ VLAN 904 */}
        <DataWire color={NET.scada} speed={2.0}
          d="M 165 410 L 195 410 L 195 168 L 300 168 L 300 108"
          active={!!assets.plc && !!assets.scada}
          lineState={netState.scada} />

        {/* SCADA → Engineering  ─ VLAN 901 */}
        <DataWire color={NET.eng} speed={1.8}
          d="M 245 83 L 140 83"
          active={!!assets.scada && !!assets.eng}
          lineState={netState.eng} />

        {/* SCADA → Gateway  ─ VLAN 903 */}
        <DataWire color={NET.gw} speed={1.5}
          d="M 358 83 L 500 83"
          active={!!assets.scada && !!assets.gw}
          lineState={netState.gw} />

        {/* Gateway → Internet / WAN */}
        <DataWire color={NET.inet} speed={0.8}
          d="M 562 83 L 680 83"
          active={!!assets.gw}
          lineState={netState.inet} />

        {/* ═══════════════════════════════════════════════
            CLOUD / INTERNET
        ═══════════════════════════════════════════════ */}
        <g transform="translate(720,82)" opacity={0.6}>
          <ellipse cx={0}   cy={0}  rx={42} ry={28} fill="#0a1520" stroke="#374151" strokeWidth={1} />
          <ellipse cx={-20} cy={8}  rx={24} ry={18} fill="#0a1520" stroke="#374151" strokeWidth={1} />
          <ellipse cx={22}  cy={10} rx={26} ry={18} fill="#0a1520" stroke="#374151" strokeWidth={1} />
          <ellipse cx={0}   cy={14} rx={40} ry={16} fill="#0a1520" stroke="#374151" strokeWidth={1} />
          <text x={0} y={5} textAnchor="middle" fontSize={9} fill="#4b5563" fontFamily="monospace">INTERNET</text>
        </g>

        {/* ═══════════════════════════════════════════════
            EQUIPOS
        ═══════════════════════════════════════════════ */}

        {/* Engineering Workstation */}
        <DrawWorkstation cx={112} cy={83} st={s("eng")}
          onClick={(e) => { e.stopPropagation(); setSelected(assets.eng); }} />

        {/* SCADA Server */}
        <DrawServer cx={302} cy={83} st={s("scada")} label="SCADA-001" ip="WinCC · 172.16.104.10"
          onClick={(e) => { e.stopPropagation(); setSelected(assets.scada); }} />

        {/* Gateway eWON */}
        <DrawGateway cx={535} cy={83} st={s("gw")}
          onClick={(e) => { e.stopPropagation(); setSelected(assets.gw); }} />

        {/* HMI KP400 */}
        <DrawHMI cx={112} cy={272} st={s("hmi")}
          onClick={(e) => { e.stopPropagation(); setSelected(assets.hmi); }} />

        {/* PLC S7-1500 */}
        <DrawPLC cx={112} cy={450} st={s("plc")}
          onClick={(e) => { e.stopPropagation(); setSelected(assets.plc); }} />

        {/* Vessel/Tank */}
        <DrawVessel cx={338} cy={428} st={ok} level={Math.min(95, prodRate)}
          onClick={(e) => { e.stopPropagation(); setSelected(assets.cnc); }} />

        {/* Válvula V-001 */}
        <DrawValve cx={460} cy={500} st={s("valve")} position={valvePos}
          onClick={(e) => { e.stopPropagation(); setSelected(assets.valve); }} />

        {/* Temperatura TT-001 */}
        <DrawTempSensor cx={600} cy={500} st={s("tt")} value={temperature}
          onClick={(e) => { e.stopPropagation(); setSelected(assets.tt); }} />

        {/* Presión PT-001 */}
        <DrawPressSensor cx={682} cy={500} st={s("pt")} value={pressure}
          onClick={(e) => { e.stopPropagation(); setSelected(assets.pt); }} />

        {/* Motor M-001 */}
        <DrawMotor cx={820} cy={478} st={s("motor")} speed={motorSpeed}
          onClick={(e) => { e.stopPropagation(); setSelected(assets.motor); }} />

        {/* CNC */}
        <DrawCNC cx={1070} cy={462} st={s("cnc")} running={prodRunning}
          onClick={(e) => { e.stopPropagation(); setSelected(assets.cnc); }} />

        {/* ═══════════════════════════════════════════════
            INDICADORES DE BREACH — aparecen cuando hay ataque
        ═══════════════════════════════════════════════ */}

        {/* Banner de breach sobre la sala de control */}
        {anyBreach && (
          <g>
            <rect x={226} y={172} width={610} height={26} rx={4} fill="#1a0505" stroke="#ef4444" strokeWidth={1.2}>
              <animate attributeName="opacity" values="1;0.6;1" dur="0.8s" repeatCount="indefinite" />
            </rect>
            <text x={232} y={183} fontSize={8} fill="#ef4444" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">
              ⚠ NETWORK BREACH DETECTED
            </text>
            <text x={232} y={193} fontSize={7} fill="#b91c1c" fontFamily="monospace">
              {[
                netState.field   !== "normal" && `VLAN 440(field:${netState.field})`,
                netState.hmi     !== "normal" && `VLAN 902(HMI:${netState.hmi})`,
                netState.scada   !== "normal" && `VLAN 904(SCADA:${netState.scada})`,
                netState.eng     !== "normal" && `VLAN 901(ENG:${netState.eng})`,
                netState.gw      !== "normal" && `VLAN 903(GW:${netState.gw})`,
              ].filter(Boolean).join("  ·  ")}
            </text>
          </g>
        )}

        {/* Banner de reconocimiento (escaneo) */}
        {anySuspicious && (
          <g>
            <rect x={226} y={172} width={460} height={22} rx={4} fill="#1a0f00" stroke="#f59e0b" strokeWidth={1}>
              <animate attributeName="opacity" values="1;0.7;1" dur="1.2s" repeatCount="indefinite" />
            </rect>
            <text x={232} y={186} fontSize={8} fill="#f59e0b" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">
              ⚡ RECONNAISSANCE DETECTED — Scanning in progress
            </text>
          </g>
        )}

        {/* Nodos de alarma en puntos clave de la red */}

        {/* Nodo PLC — breach campo */}
        {(netState.field === "compromised" || netState.field === "suspicious") && (
          <g transform="translate(184,430)">
            <circle r={10} fill={netState.field === "compromised" ? "#1a0505" : "#1a0f00"}
              stroke={netState.field === "compromised" ? "#ef4444" : "#f59e0b"} strokeWidth={1.5}>
              <animate attributeName="r" values="10;13;10" dur="0.6s" repeatCount="indefinite" />
            </circle>
            <text textAnchor="middle" y={4} fontSize={9} fill={netState.field === "compromised" ? "#ef4444" : "#f59e0b"} fontWeight="bold">!</text>
          </g>
        )}

        {/* Nodo HMI — comprometido */}
        {netState.hmi !== "normal" && (
          <g transform="translate(112,272)">
            <circle r={8} fill="#1a0505" stroke="#ef4444" strokeWidth={1.5}>
              <animate attributeName="opacity" values="1;0.3;1" dur="0.5s" repeatCount="indefinite" />
            </circle>
            <text textAnchor="middle" y={3} fontSize={8} fill="#ef4444" fontWeight="bold">!</text>
          </g>
        )}

        {/* Nodo SCADA — dead */}
        {netState.scada === "dead" && (
          <g transform="translate(302,108)">
            <rect x={-22} y={-10} width={44} height={18} rx={3} fill="#1a0505" stroke="#ef4444" strokeWidth={1}>
              <animate attributeName="opacity" values="1;0.4;1" dur="0.4s" repeatCount="indefinite" />
            </rect>
            <text textAnchor="middle" y={3} fontSize={7} fill="#ef4444" fontFamily="monospace" fontWeight="bold">OFFLINE</text>
          </g>
        )}
        {netState.scada === "compromised" && (
          <g transform="translate(302,108)">
            <circle r={8} fill="#1a0505" stroke="#ef4444" strokeWidth={1.5}>
              <animate attributeName="r" values="8;11;8" dur="0.5s" repeatCount="indefinite" />
            </circle>
            <text textAnchor="middle" y={3} fontSize={8} fill="#ef4444" fontWeight="bold">!</text>
          </g>
        )}

        {/* Cable tray comprometido — resaltado rojo */}
        {netState.field === "compromised" && (
          <rect x={210} y={558} width={975} height={18} rx={2}
            fill="rgba(239,68,68,0.10)" stroke="rgba(239,68,68,0.5)" strokeWidth={1}>
            <animate attributeName="opacity" values="1;0.4;1" dur="0.7s" repeatCount="indefinite" />
          </rect>
        )}
        {netState.field === "suspicious" && (
          <rect x={210} y={558} width={975} height={18} rx={2}
            fill="rgba(245,158,11,0.08)" stroke="rgba(245,158,11,0.4)" strokeWidth={0.8} />
        )}

        {/* ═══ LEYENDA ════════════════════════════════ */}
        <g transform="translate(860,22)">
          <rect x={0} y={0} width={322} height={138} rx={5} fill="#060d18" stroke="#1e293b" strokeWidth={1} />
          <text x={12} y={18} fontSize={9} fill="#4b5563" fontFamily="monospace" fontWeight="bold" letterSpacing="2">NETWORK LEGEND</text>
          {[
            { color: NET.field,  label: "VLAN 440  —  PLC / Field Control" },
            { color: NET.hmi,    label: "VLAN 902  —  HMI Operator" },
            { color: NET.scada,  label: "VLAN 904  —  SCADA / Servers" },
            { color: NET.eng,    label: "VLAN 901  —  Engineering" },
            { color: NET.gw,     label: "VLAN 903  —  Remote Access VPN" },
            { color: NET.inet,   label: "WAN  ——  Internet / Cloud" },
          ].map((item, i) => (
            <g key={i} transform={`translate(12,${30 + i * 18})`}>
              <line x1={0} y1={6} x2={28} y2={6} stroke={item.color} strokeWidth={2} strokeDasharray="6 3" />
              <polygon points="24,3 30,6 24,9" fill={item.color} />
              <text x={36} y={10} fontSize={9} fill="#94a3b8" fontFamily="monospace">{item.label}</text>
            </g>
          ))}
        </g>

        {/* ═══ INDICADOR DE PRODUCCIÓN ══════════════════ */}
        <g transform="translate(860,175)">
          <rect x={0} y={0} width={322} height={82} rx={5} fill="#060d18" stroke="#1e293b" strokeWidth={1} />
          <text x={12} y={18} fontSize={9} fill="#4b5563" fontFamily="monospace" fontWeight="bold" letterSpacing="2">PRODUCTION STATUS</text>
          {/* Barra de producción */}
          <rect x={12} y={28} width={298} height={18} rx={3} fill="#0a1520" stroke="#1e293b" strokeWidth={0.5} />
          <rect x={14} y={30} width={Math.max(0, (prodRate / 100) * 294)} height={14} rx={2}
            fill={prodRate > 80 ? "#22c55e" : prodRate > 40 ? "#f59e0b" : "#ef4444"} opacity={0.8} />
          <text x={161} y={41} textAnchor="middle" fontSize={8} fill="white" fontFamily="monospace" fontWeight="bold">{prodRate.toFixed(0)}%</text>
          {/* Indicadores */}
          <circle cx={20} cy={65} r={5} fill={prodRunning ? "#22c55e" : "#ef4444"} />
          <text x={30} y={68} fontSize={9} fill={prodRunning ? "#22c55e" : "#ef4444"} fontFamily="monospace" fontWeight="bold">
            {prodRunning ? "LINE RUNNING" : "LINE STOPPED"}
          </text>
          <text x={200} y={68} fontSize={9} fill="#4b5563" fontFamily="monospace">Motor: {motorSpeed.toFixed(0)} RPM</text>
        </g>

        {/* Flechas de dirección de flujo sobre tuberías */}
        {flowActive && (
          <>
            <polygon points="400,531 410,535 400,539" fill="#3b82f6" opacity={0.7} />
            <polygon points="640,531 650,535 640,539" fill="#3b82f6" opacity={0.7} />
            <polygon points="875,531 885,535 875,539" fill="#3b82f6" opacity={0.7} />
          </>
        )}

      </svg>

      {/* ══ PANEL DETALLE EQUIPO ══════════════════════════════════════════ */}
      {selected && (
        <EquipmentDetails
          asset={selected}
          process={proc}
          onClose={() => setSelected(null)}
          onOpenInterface={() => { setInterfaceAsset(selected); setSelected(null); }}
        />
      )}

    </div>
  );
}


/* =========================================================
   EQUIPMENT DETAILS (panel lateral — sin cambios de API)
========================================================= */
function EquipmentDetails({ asset, process, onClose, onOpenInterface }) {
  const val = () => {
    if (asset.asset_id === "M-001")     return `${(process?.motor_speed    ?? 0).toFixed(0)} RPM`;
    if (asset.asset_id === "TT-001")    return `${(process?.temperature    ?? 0).toFixed(1)} °C`;
    if (asset.asset_id === "PT-001")    return `${(process?.pressure       ?? 0).toFixed(2)} bar`;
    if (asset.asset_id === "V-001")     return `${(process?.valve_position ?? 0).toFixed(0)} %`;
    if (asset.asset_id === "CNC-001")   return process?.production_running ? "PRODUCING" : "STOPPED";
    if (asset.asset_id === "PLC-001")   return process?.production_running ? "RUN" : "STOP";
    if (asset.asset_id === "HMI-001")   return "OPERATIONAL";
    if (asset.asset_id === "SCADA-001") return "MONITORING";
    if (asset.asset_id === "GW-001")    return "CONNECTED";
    return asset.status;
  };

  return (
    <div className="equipment-overlay" onClick={onClose}>
      <div className="equipment-detail-panel" onClick={e => e.stopPropagation()}>
        <button className="close-detail" onClick={onClose} type="button" aria-label="Close">
          <X size={18} />
        </button>
        <div className="eyebrow">OT ASSET</div>
        <h2>{asset.asset_id}</h2>
        <p className="detail-name">{asset.name}</p>
        <div className="detail-status"><span />{asset.status}</div>
        <div className="detail-grid">
          <DetailItem label="TYPE"         value={asset.type} />
          <DetailItem label="MANUFACTURER" value={asset.manufacturer} />
          <DetailItem label="MODEL"        value={asset.model} />
          <DetailItem label="IP ADDRESS"   value={asset.ip_address} />
          <DetailItem label="VLAN"         value={asset.vlan} />
          <DetailItem label="NETWORK"      value={asset.network} />
        </div>
        <div className="live-value">
          <span>CURRENT VALUE</span>
          <strong>{val()}</strong>
        </div>
        <button className="open-interface-button" onClick={onOpenInterface} type="button">
          OPEN EQUIPMENT INTERFACE
        </button>
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}