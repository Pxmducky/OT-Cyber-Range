/**
 * DynamicPlant.jsx
 * Vista de planta industrial dinámica.
 * Acepta datos en FORMATO NORMALIZADO del excelParser (asset.id, asset.ip, etc.)
 * O en el formato de muestra interno (asset.id, asset.ip, etc.) — auto-detecta.
 */

import { useState, useMemo } from "react";
import { EquipmentIcon }        from "./EquipmentIcons";
import EquipmentInterface       from "./EquipmentInterface";

/* ── Normalización compatibilidad ─────────────────────────────────────────
   Acepta tanto el formato nuevo {id, ip, purdueLevel, ...}
   como el formato antiguo {ID, IP_Address, Purdue_Level, ...}
────────────────────────────────────────────────────────────────────────── */
function normAsset(a) {
  if (!a) return null;
  return {
    // Nuevo formato (excelParser) → tiene prioridad
    id:          a.id          ?? a.ID          ?? "?",
    name:        a.name        ?? a.Name        ?? "",
    type:        a.type        ?? a.Type        ?? "Unknown",
    vendor:      a.vendor      ?? a.Vendor      ?? "",
    model:       a.model       ?? a.Model       ?? "",
    ip:          a.ip          ?? a.IP_Address  ?? a.IP  ?? "—",
    mac:         a.mac         ?? a.MAC         ?? "—",
    vlan:        String(a.vlan ?? a.VLAN        ?? ""),
    line:        a.line        ?? a.Line        ?? "SHARED",
    status:      (a.status     ?? a.Status      ?? "ONLINE").toUpperCase(),
    purdueLevel: String(a.purdueLevel ?? a.purdueLevel ?? "1"),
    protocols:   Array.isArray(a.protocols)
                   ? a.protocols
                   : String(a.protocols ?? a.Protocols ?? "").split(/[;,]/).map(p=>p.trim()).filter(Boolean),
    description: a.description ?? a.Description ?? "",
    firmware:    a.firmware    ?? a.OS_Firmware  ?? "",
    application: a.application ?? a.Application  ?? "",
    // Para EquipmentInterface
    asset_id:    a.id ?? a.ID ?? "?",
    _raw:        a._raw ?? a,
  };
}

function normConnection(c) {
  if (!c) return null;
  return {
    sourceId:  c.sourceId  ?? c.sourceId ?? c.Source ?? "",
    targetId:  c.targetId  ?? c.targetId ?? c.Destination ?? "",
    protocol:  c.protocol  ?? c.Protocol  ?? "",
    port:      String(c.port ?? c.Port ?? ""),
    direction: c.direction ?? c.Direction ?? "bidirectional",
  };
}

/* ── Colores por protocolo ─────────────────────────────────────────────────── */
const PROTO_COLOR = {
  "S7comm":       "#22c55e",
  "PROFINET":     "#22c55e",
  "EtherNet/IP":  "#ef4444",
  "OPC-UA":       "#818cf8",
  "Modbus":       "#f59e0b",
  "PROFIBUS":     "#06b6d4",
  "HART":         "#a78bfa",
  "MQTT":         "#f97316",
  "PCDK":         "#ec4899",
  "IP":           "#64748b",
  "SNMP":         "#94a3b8",
  "default":      "#4b5563",
};

function protoColor(protocol = "") {
  const key = Object.keys(PROTO_COLOR).find(k =>
    protocol.includes(k.toUpperCase())
  );
  return PROTO_COLOR[key ?? "default"];
}

/* ── Color y label de nivel Purdue ────────────────────────────────────────── */
const PURDUE = {
  "0":   { color: "#22c55e", label: "Field (L0)",         bg: "rgba(34,197,94,.08)"   },
  "0-1": { color: "#34d399", label: "Field/Control",      bg: "rgba(52,211,153,.08)"  },
  "1":   { color: "#22d3ee", label: "Basic Control (L1)", bg: "rgba(34,211,238,.08)"  },
  "2":   { color: "#60a5fa", label: "Supervisory (L2)",   bg: "rgba(96,165,250,.08)"  },
  "3":   { color: "#818cf8", label: "Operations (L3)",    bg: "rgba(129,140,248,.08)" },
  "3.5": { color: "#f97316", label: "DMZ (L3.5)",         bg: "rgba(249,115,22,.08)"  },
  "4":   { color: "#f59e0b", label: "Business (L4)",      bg: "rgba(245,158,11,.08)"  },
  "5":   { color: "#e879f9", label: "Enterprise (L5)",    bg: "rgba(232,121,249,.08)" },
};

const statusColor = s => ({
  ONLINE:      "#22c55e",
  OFFLINE:     "#4b5563",
  WARNING:     "#f59e0b",
  COMPROMISED: "#ef4444",
  DAMAGED:     "#ef4444",
})[s?.toUpperCase()] ?? "#22c55e";

/* ── Datos de muestra (se reemplaza con el Excel del usuario) ──────────────── */
const SAMPLE_ASSETS = [
  { ID:"PLC-001", Name:"Main PLC L01",        Type:"PLC",         Vendor:"Siemens",           Model:"S7-1500 CPU 1515", Line:"LINE-01", IP_Address:"172.16.100.10", VLAN:"440", Purdue_Level:"1", Protocols:"S7comm,OPC-UA", Ports:"102,4840", Status:"ONLINE" },
  { ID:"HMI-001", Name:"Operator Panel L01",  Type:"HMI",         Vendor:"Siemens",           Model:"KP900 Comfort",    Line:"LINE-01", IP_Address:"172.16.102.10", VLAN:"902", Purdue_Level:"2", Protocols:"S7comm",         Ports:"102",      Status:"ONLINE" },
  { ID:"SCADA-001",Name:"WinCC Server L01",   Type:"SCADA",       Vendor:"Siemens",           Model:"WinCC V7.5",       Line:"LINE-01", IP_Address:"172.16.104.10", VLAN:"904", Purdue_Level:"3", Protocols:"OPC-UA",          Ports:"4840",     Status:"ONLINE" },
  { ID:"SW-001",  Name:"OT Switch L01",       Type:"Switch",      Vendor:"Hirschmann",        Model:"RS20-0400",        Line:"LINE-01", IP_Address:"172.16.110.1",  VLAN:"440", Purdue_Level:"2", Protocols:"PROFINET,SNMP",   Ports:"161,8080", Status:"ONLINE" },
  { ID:"CNC-001", Name:"DMG MORI NHX4000",    Type:"CNC",         Vendor:"DMG MORI",          Model:"NHX 4000",         Line:"LINE-01", IP_Address:"172.16.100.20", VLAN:"440", Purdue_Level:"1", Protocols:"PROFINET,OPC-UA", Ports:"8009,4840",Status:"ONLINE" },
  { ID:"CNC-002", Name:"DMG MORI NHX5000",    Type:"CNC",         Vendor:"DMG MORI",          Model:"NHX 5000",         Line:"LINE-01", IP_Address:"172.16.100.21", VLAN:"440", Purdue_Level:"1", Protocols:"PROFINET",        Ports:"8009",     Status:"ONLINE" },
  { ID:"M-001",   Name:"Pump Motor L01",      Type:"Motor",       Vendor:"ABB",               Model:"M3BP 160",         Line:"LINE-01", IP_Address:"172.16.100.30", VLAN:"440", Purdue_Level:"0", Protocols:"PROFINET",        Ports:"8008",     Status:"ONLINE" },
  { ID:"TT-001",  Name:"Temp Transmitter L01",Type:"Sensor",      Vendor:"Siemens",           Model:"SITRANS TS300",    Line:"LINE-01", IP_Address:"172.16.100.40", VLAN:"440", Purdue_Level:"0", Protocols:"PROFINET",        Ports:"8008",     Status:"ONLINE" },
  { ID:"PT-001",  Name:"Press Transmitter L01",Type:"Sensor",     Vendor:"Emerson",           Model:"Cerabar PMP55",    Line:"LINE-01", IP_Address:"172.16.100.41", VLAN:"440", Purdue_Level:"0", Protocols:"PROFINET",        Ports:"8008",     Status:"ONLINE" },
  { ID:"V-001",   Name:"Control Valve L01",   Type:"Valve",       Vendor:"Fisher",            Model:"DVC6200",          Line:"LINE-01", IP_Address:"172.16.100.50", VLAN:"440", Purdue_Level:"0", Protocols:"PROFIBUS",        Ports:"—",        Status:"ONLINE" },
  { ID:"PLC-002", Name:"Main PLC L02",        Type:"PLC",         Vendor:"Rockwell",          Model:"ControlLogix L85E",Line:"LINE-02", IP_Address:"172.16.101.10", VLAN:"441", Purdue_Level:"1", Protocols:"EtherNet/IP,OPC-UA",Ports:"44818,4840",Status:"ONLINE"},
  { ID:"HMI-002", Name:"PanelView Plus 7",    Type:"HMI",         Vendor:"Rockwell",          Model:"PanelView Plus 7", Line:"LINE-02", IP_Address:"172.16.103.10", VLAN:"903", Purdue_Level:"2", Protocols:"EtherNet/IP",     Ports:"44818",    Status:"ONLINE" },
  { ID:"SCADA-002",Name:"FactoryTalk Server", Type:"SCADA",       Vendor:"Rockwell",          Model:"FactoryTalk View", Line:"LINE-02", IP_Address:"172.16.105.10", VLAN:"905", Purdue_Level:"3", Protocols:"OPC-UA,EtherNet/IP",Ports:"4840",    Status:"ONLINE" },
  { ID:"SW-002",  Name:"OT Switch L02",       Type:"Switch",      Vendor:"Cisco",             Model:"IE-4000-8GT4G",    Line:"LINE-02", IP_Address:"172.16.111.1",  VLAN:"441", Purdue_Level:"2", Protocols:"EtherNet/IP,SNMP",Ports:"161,23",   Status:"ONLINE" },
  { ID:"INJ-001", Name:"Engel e-mac 180",     Type:"Molder",      Vendor:"Engel",             Model:"e-mac 180/50",     Line:"LINE-02", IP_Address:"172.16.101.20", VLAN:"441", Purdue_Level:"1", Protocols:"EtherNet/IP,OPC-UA",Ports:"44818",  Status:"ONLINE" },
  { ID:"INJ-002", Name:"Engel e-mac 280",     Type:"Molder",      Vendor:"Engel",             Model:"e-mac 280/80",     Line:"LINE-02", IP_Address:"172.16.101.21", VLAN:"441", Purdue_Level:"1", Protocols:"EtherNet/IP",     Ports:"44818",    Status:"ONLINE" },
  { ID:"ROBOT-001",Name:"FANUC R-2000iC",     Type:"Robot",       Vendor:"FANUC",             Model:"R-2000iC/210F",    Line:"LINE-02", IP_Address:"172.16.101.30", VLAN:"441", Purdue_Level:"1", Protocols:"EtherNet/IP",     Ports:"44818",    Status:"ONLINE" },
  { ID:"TT-002",  Name:"Temp Rosemount L02",  Type:"Sensor",      Vendor:"Emerson",           Model:"Rosemount 3144P",  Line:"LINE-02", IP_Address:"172.16.101.40", VLAN:"441", Purdue_Level:"0", Protocols:"EtherNet/IP",     Ports:"44818",    Status:"ONLINE" },
  { ID:"PT-002",  Name:"Press Rosemount L02", Type:"Sensor",      Vendor:"Emerson",           Model:"Rosemount 3051",   Line:"LINE-02", IP_Address:"172.16.101.41", VLAN:"441", Purdue_Level:"0", Protocols:"EtherNet/IP",     Ports:"44818",    Status:"ONLINE" },
  { ID:"M-002",   Name:"Hydraulic Drive L02", Type:"Motor",       Vendor:"Siemens",           Model:"SIMOTICS M-1PH8",  Line:"LINE-02", IP_Address:"172.16.101.50", VLAN:"441", Purdue_Level:"0", Protocols:"PROFINET",        Ports:"8008",     Status:"ONLINE" },
  { ID:"PLC-003", Name:"Main PLC L03",        Type:"PLC",         Vendor:"Siemens",           Model:"S7-1200 CPU 1214C",Line:"LINE-03", IP_Address:"172.16.106.10", VLAN:"442", Purdue_Level:"1", Protocols:"S7comm,OPC-UA",   Ports:"102,4840", Status:"ONLINE" },
  { ID:"HMI-003", Name:"Siemens TP1500",      Type:"HMI",         Vendor:"Siemens",           Model:"TP1500 Comfort",   Line:"LINE-03", IP_Address:"172.16.107.10", VLAN:"906", Purdue_Level:"2", Protocols:"S7comm",          Ports:"102",      Status:"ONLINE" },
  { ID:"SCADA-003",Name:"Ignition SCADA",     Type:"SCADA",       Vendor:"Inductive Automation",Model:"Ignition 8.1",   Line:"LINE-03", IP_Address:"172.16.108.10", VLAN:"908", Purdue_Level:"3", Protocols:"OPC-UA,MQTT",     Ports:"4840,1883",Status:"ONLINE" },
  { ID:"ROBOT-002",Name:"KUKA KR 210",        Type:"Robot",       Vendor:"KUKA",              Model:"KR 210 R2700",     Line:"LINE-03", IP_Address:"172.16.106.20", VLAN:"442", Purdue_Level:"1", Protocols:"EtherNet,OPC-UA", Ports:"49152,4840",Status:"ONLINE"},
  { ID:"VISION-001",Name:"Cognex InSight",    Type:"Vision",      Vendor:"Cognex",            Model:"In-Sight 9902",    Line:"LINE-03", IP_Address:"172.16.106.30", VLAN:"442", Purdue_Level:"2", Protocols:"EtherNet/IP",     Ports:"44818,80", Status:"ONLINE" },
  { ID:"CONVEYOR-001",Name:"SEW Conveyor",    Type:"Conveyor",    Vendor:"SEW-Eurodrive",     Model:"MOVIMOT MM15D",    Line:"LINE-03", IP_Address:"172.16.106.40", VLAN:"442", Purdue_Level:"0", Protocols:"PROFINET",        Ports:"8008",     Status:"ONLINE" },
  { ID:"TESTER-001",Name:"NI TestStation",    Type:"Tester",      Vendor:"National Instruments",Model:"PXIe-1088",      Line:"LINE-03", IP_Address:"172.16.106.50", VLAN:"442", Purdue_Level:"2", Protocols:"EtherNet",        Ports:"80,5111",  Status:"ONLINE" },
  { ID:"TT-003",  Name:"Temp Siemens L03",    Type:"Sensor",      Vendor:"Siemens",           Model:"SITRANS TH420",    Line:"LINE-03", IP_Address:"172.16.106.60", VLAN:"442", Purdue_Level:"0", Protocols:"HART",            Ports:"—",        Status:"ONLINE" },
  { ID:"FW-001",  Name:"FortiGate 100F",      Type:"Firewall",    Vendor:"Fortinet",          Model:"FortiGate 100F",   Line:"SHARED",  IP_Address:"172.16.200.1",  VLAN:"—",   Purdue_Level:"3.5",Protocols:"IP",             Ports:"—",        Status:"ONLINE" },
  { ID:"ENG-001", Name:"Engineering WS",      Type:"Workstation", Vendor:"HP",                Model:"Z4 G5",            Line:"SHARED",  IP_Address:"172.16.201.10", VLAN:"901", Purdue_Level:"4", Protocols:"S7comm,EtherNet/IP,OPC-UA",Ports:"102,44818,4840",Status:"ONLINE"},
];

const SAMPLE_CONNECTIONS = [
  { Source_ID:"PLC-001", Target_ID:"CNC-001",  Protocol:"PROFINET",   Direction:"bidirectional" },
  { Source_ID:"PLC-001", Target_ID:"CNC-002",  Protocol:"PROFINET",   Direction:"bidirectional" },
  { Source_ID:"PLC-001", Target_ID:"M-001",    Protocol:"PROFINET",   Direction:"bidirectional" },
  { Source_ID:"PLC-001", Target_ID:"TT-001",   Protocol:"PROFINET",   Direction:"inbound"       },
  { Source_ID:"PLC-001", Target_ID:"PT-001",   Protocol:"PROFINET",   Direction:"inbound"       },
  { Source_ID:"PLC-001", Target_ID:"V-001",    Protocol:"PROFIBUS",   Direction:"bidirectional" },
  { Source_ID:"SW-001",  Target_ID:"PLC-001",  Protocol:"PROFINET",   Direction:"bidirectional" },
  { Source_ID:"SW-001",  Target_ID:"HMI-001",  Protocol:"S7comm",     Direction:"bidirectional" },
  { Source_ID:"SW-001",  Target_ID:"SCADA-001",Protocol:"OPC-UA",     Direction:"bidirectional" },
  { Source_ID:"PLC-002", Target_ID:"INJ-001",  Protocol:"EtherNet/IP",Direction:"bidirectional" },
  { Source_ID:"PLC-002", Target_ID:"INJ-002",  Protocol:"EtherNet/IP",Direction:"bidirectional" },
  { Source_ID:"PLC-002", Target_ID:"ROBOT-001",Protocol:"EtherNet/IP",Direction:"bidirectional" },
  { Source_ID:"PLC-002", Target_ID:"M-002",    Protocol:"PROFINET",   Direction:"bidirectional" },
  { Source_ID:"SW-002",  Target_ID:"PLC-002",  Protocol:"EtherNet/IP",Direction:"bidirectional" },
  { Source_ID:"SW-002",  Target_ID:"HMI-002",  Protocol:"EtherNet/IP",Direction:"bidirectional" },
  { Source_ID:"SW-002",  Target_ID:"SCADA-002",Protocol:"OPC-UA",     Direction:"bidirectional" },
  { Source_ID:"PLC-003", Target_ID:"ROBOT-002",Protocol:"OPC-UA",     Direction:"bidirectional" },
  { Source_ID:"PLC-003", Target_ID:"VISION-001",Protocol:"EtherNet/IP",Direction:"bidirectional"},
  { Source_ID:"PLC-003", Target_ID:"CONVEYOR-001",Protocol:"PROFINET",Direction:"bidirectional" },
  { Source_ID:"PLC-003", Target_ID:"TESTER-001",Protocol:"EtherNet/IP",Direction:"bidirectional"},
  { Source_ID:"HMI-003", Target_ID:"PLC-003",  Protocol:"S7comm",     Direction:"bidirectional" },
  { Source_ID:"SCADA-003",Target_ID:"PLC-003", Protocol:"OPC-UA",     Direction:"bidirectional" },
  { Source_ID:"SCADA-001",Target_ID:"FW-001",  Protocol:"IP",         Direction:"bidirectional" },
  { Source_ID:"SCADA-002",Target_ID:"FW-001",  Protocol:"IP",         Direction:"bidirectional" },
  { Source_ID:"SCADA-003",Target_ID:"FW-001",  Protocol:"IP",         Direction:"bidirectional" },
  { Source_ID:"FW-001",  Target_ID:"ENG-001",  Protocol:"IP",         Direction:"bidirectional" },
  { Source_ID:"ENG-001", Target_ID:"PLC-001",  Protocol:"S7comm",     Direction:"bidirectional" },
  { Source_ID:"ENG-001", Target_ID:"PLC-002",  Protocol:"EtherNet/IP",Direction:"bidirectional" },
  { Source_ID:"ENG-001", Target_ID:"PLC-003",  Protocol:"S7comm",     Direction:"bidirectional" },
];

const LINE_META = {
  "LINE-01": { label: "Línea 01 — Maquinado CNC",        color: "#22d3ee", icon: "⚙",  bg: "rgba(34,211,238,.06)"  },
  "LINE-02": { label: "Línea 02 — Moldeo por Inyección", color: "#ef4444", icon: "🏭", bg: "rgba(239,68,68,.06)"   },
  "LINE-03": { label: "Línea 03 — Ensamble y Pruebas",   color: "#22c55e", icon: "🔩", bg: "rgba(34,197,94,.06)"   },
  "SHARED":  { label: "Infraestructura Compartida",       color: "#f59e0b", icon: "🛡", bg: "rgba(245,158,11,.06)"  },
};

/* ────────────────────────────────────────────────────────────────────────────
   EQUIPMENT CARD — tarjeta de equipo individual
──────────────────────────────────────────────────────────────────────────── */
function EquipmentCard({ asset, size = 72, onClick, selected = false }) {
  const st = statusColor(asset.status);
  const pu = PURDUE[asset.purdueLevel] ?? PURDUE["1"];

  return (
    <div
      onClick={e => { e.stopPropagation(); onClick?.(asset); }}
      style={{
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           6,
        padding:       "10px 8px",
        borderRadius:  10,
        border:        `1.5px solid ${selected ? st : "rgba(255,255,255,0.06)"}`,
        background:    selected ? `${st}10` : "rgba(255,255,255,0.02)",
        cursor:        "pointer",
        transition:    "all .2s",
        width:         size + 32,
        position:      "relative",
        boxShadow:     selected ? `0 0 12px ${st}44` : "none",
      }}
    >
      {/* Status indicator top-right */}
      <div style={{
        position:     "absolute",
        top:          6,
        right:        6,
        width:        8,
        height:       8,
        borderRadius: "50%",
        background:   st,
        boxShadow:    `0 0 6px ${st}`,
      }}/>

      {/* Purdue level badge */}
      <div style={{
        position:     "absolute",
        top:          6,
        left:         6,
        fontSize:     8,
        fontFamily:   "monospace",
        color:        pu.color,
        background:   pu.bg,
        border:       `1px solid ${pu.color}44`,
        padding:      "1px 4px",
        borderRadius: 3,
      }}>
        L{asset.purdueLevel}
      </div>

      {/* Equipment icon */}
      <div style={{ marginTop: 8 }}>
        <EquipmentIcon asset={asset} size={size}/>
      </div>

      {/* ID */}
      <div style={{
        fontSize:      9,
        fontFamily:    "monospace",
        fontWeight:    700,
        color:         "#94a3b8",
        letterSpacing: ".06em",
        marginTop:     2,
      }}>
        {asset.id}
      </div>

      {/* Name */}
      <div style={{
        fontSize:   9,
        color:      "#64748b",
        textAlign:  "center",
        lineHeight: 1.3,
        maxWidth:   90,
      }}>
        {asset.name}
      </div>

      {/* IP */}
      <div style={{
        fontSize:   8,
        fontFamily: "monospace",
        color:      "#334155",
      }}>
        {asset.ip}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LINE DETAIL VIEW — vista expandida de una línea de producción
──────────────────────────────────────────────────────────────────────────── */
function LineDetailView({ lineKey, assets, connections, onBack, onAssetClick, selectedId }) {
  const meta = LINE_META[lineKey] ?? { label: lineKey, color: "#4b5563", icon: "⚙", bg: "transparent" };

  // Agrupar por nivel Purdue (de arriba=L3 a abajo=L0)
  const levels = [
    { level: "3",   assets: assets.filter(a => a.purdueLevel === "3") },
    { level: "2",   assets: assets.filter(a => a.purdueLevel === "2") },
    { level: "1",   assets: assets.filter(a => a.purdueLevel === "1") },
    { level: "0-1", assets: assets.filter(a => ["0","0-1"].includes(a.purdueLevel)) },
  ].filter(l => l.assets.length > 0);

  // Conexiones dentro de esta línea
  const lineIds = new Set(assets.map(a => a.id));
  const lineConns = connections.filter(
    c => lineIds.has(c.sourceId) || lineIds.has(c.targetId)
  );

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {/* Header */}
      <div style={{
        display:        "flex",
        alignItems:     "center",
        gap:            14,
        padding:        "14px 24px",
        borderBottom:   `1px solid ${meta.color}22`,
        background:     meta.bg,
        marginBottom:   16,
      }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border:     `1px solid ${meta.color}44`,
            color:      meta.color,
            padding:    "6px 14px",
            borderRadius: 6,
            cursor:     "pointer",
            fontFamily: "monospace",
            fontSize:   11,
          }}
        >
          ← VOLVER
        </button>
        <span style={{ fontSize: 22 }}>{meta.icon}</span>
        <div>
          <div style={{ color: meta.color, fontFamily: "monospace", fontWeight: 700, fontSize: 15, letterSpacing: ".06em" }}>
            {meta.label}
          </div>
          <div style={{ color: "#4b5563", fontSize: 10, fontFamily: "monospace" }}>
            {assets.length} activos · {lineConns.length} conexiones
          </div>
        </div>
        {/* Leyenda de protocolos */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[...new Set(lineConns.map(c => c.Protocol.split(",")[0]))].map(p => (
            <span key={p} style={{
              background: protoColor(p) + "18",
              border:     `1px solid ${protoColor(p)}44`,
              color:      protoColor(p),
              padding:    "2px 8px",
              borderRadius: 4,
              fontSize:   9,
              fontFamily: "monospace",
            }}>{p}</span>
          ))}
        </div>
      </div>

      {/* Contenido scrollable */}
      <div style={{ overflowY: "auto", height: "calc(100% - 80px)", padding: "0 24px 24px" }}>

        {/* Por cada nivel Purdue (de SCADA arriba a campo abajo) */}
        {levels.map(({ level, assets: levelAssets }) => {
          const pu = PURDUE[level] ?? PURDUE["1"];
          return (
            <div key={level} style={{ marginBottom: 24 }}>
              {/* Nivel label */}
              <div style={{
                display:      "flex",
                alignItems:   "center",
                gap:          10,
                marginBottom: 12,
              }}>
                <div style={{
                  width:        6,
                  alignSelf:    "stretch",
                  borderRadius: 3,
                  background:   pu.color,
                }}/>
                <div>
                  <div style={{ color: pu.color, fontSize: 11, fontFamily: "monospace", fontWeight: 700, letterSpacing: ".08em" }}>
                    {pu.label}
                  </div>
                  <div style={{ color: "#334155", fontSize: 9, fontFamily: "monospace" }}>
                    {levelAssets.length} equipo{levelAssets.length > 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ flex: 1, height: 1, background: pu.color + "22" }}/>
              </div>

              {/* Equipos en este nivel */}
              <div style={{
                display:       "flex",
                flexWrap:      "wrap",
                gap:           14,
                paddingLeft:   14,
              }}>
                {levelAssets.map(asset => {
                  // Buscar conexiones hacia/desde este asset en esta línea
                  const myConns = lineConns.filter(
                    c => c.sourceId === asset.id || c.targetId === asset.id
                  );

                  return (
                    <div key={asset.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <EquipmentCard
                        asset={asset}
                        size={76}
                        selected={selectedId === asset.id}
                        onClick={onAssetClick}
                      />
                      {/* Etiquetas de conexión */}
                      {myConns.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", maxWidth: 108 }}>
                          {myConns.slice(0, 3).map((conn, i) => {
                            const proto = conn.Protocol.split(",")[0];
                            const peer  = conn.Source_ID === asset.id ? conn.Target_ID : conn.Source_ID;
                            return (
                              <span key={i} style={{
                                fontSize:   7,
                                fontFamily: "monospace",
                                color:      protoColor(proto),
                                background: protoColor(proto) + "12",
                                border:     `1px solid ${protoColor(proto)}30`,
                                padding:    "1px 5px",
                                borderRadius: 3,
                              }}>
                                {conn.Direction === "inbound" ? "←" : conn.Direction === "outbound" ? "→" : "↔"} {peer}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Mapa de conexiones — línea visual */}
        {lineConns.length > 0 && (
          <div style={{
            marginTop:    24,
            padding:      16,
            background:   "rgba(255,255,255,.02)",
            border:       "1px solid #1e293b",
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: "#334155", marginBottom: 12, letterSpacing: ".1em" }}>
              MAPA DE CONEXIONES
            </div>
            {lineConns.map((conn, i) => {
              const pc = protoColor(conn.Protocol.split(",")[0]);
              const arrow = conn.Direction === "inbound" ? "←" : conn.Direction === "outbound" ? "→" : "↔";
              return (
                <div key={i} style={{
                  display:     "flex",
                  alignItems:  "center",
                  gap:         8,
                  padding:     "5px 0",
                  borderBottom: i < lineConns.length - 1 ? "1px solid #0d1520" : "none",
                  fontSize:    9,
                  fontFamily:  "monospace",
                }}>
                  <span style={{ color: "#4b5563", minWidth: 80 }}>{conn.Source_ID}</span>
                  <span style={{ color: pc, flex: 1, textAlign: "center" }}>
                    ─ {conn.Protocol.split(",")[0]} {arrow} ─
                  </span>
                  <span style={{ color: "#4b5563", minWidth: 80, textAlign: "right" }}>{conn.Target_ID}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LINE OVERVIEW CARD — tarjeta resumen de una línea en la vista overview
──────────────────────────────────────────────────────────────────────────── */
function LineOverviewCard({ lineKey, assets, onClick }) {
  const meta  = LINE_META[lineKey] ?? { label: lineKey, color: "#4b5563", icon: "⚙", bg: "transparent" };
  const warn  = assets.filter(a => ["WARNING","COMPROMISED","DAMAGED","OFFLINE"].includes(a.status?.toUpperCase())).length;
  const byPurdue = [3, 2, 1, 0].map(l =>
    assets.filter(a => parseInt(a.purdueLevel) === l)
  ).filter(g => g.length);

  return (
    <div
      onClick={() => onClick(lineKey)}
      style={{
        flex:          1,
        minWidth:      280,
        maxWidth:      400,
        background:    "rgba(255,255,255,0.02)",
        border:        `1.5px solid ${meta.color}33`,
        borderRadius:  12,
        padding:       "18px 20px",
        cursor:        "pointer",
        transition:    "all .25s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = meta.color;
        e.currentTarget.style.background  = meta.bg;
        e.currentTarget.style.boxShadow   = `0 0 20px ${meta.color}22`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = meta.color + "33";
        e.currentTarget.style.background  = "rgba(255,255,255,.02)";
        e.currentTarget.style.boxShadow   = "none";
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{meta.icon}</span>
          <div>
            <div style={{ color: meta.color, fontFamily: "monospace", fontWeight: 700, fontSize: 11, letterSpacing: ".06em" }}>
              {lineKey}
            </div>
            <div style={{ color: "#4b5563", fontSize: 9 }}>{assets.length} activos</div>
          </div>
        </div>
        {warn > 0 && (
          <div style={{
            background:   "rgba(239,68,68,.12)",
            border:       "1px solid rgba(239,68,68,.3)",
            color:        "#ef4444",
            fontSize:     9,
            padding:      "3px 8px",
            borderRadius: 4,
            fontFamily:   "monospace",
          }}>
            ⚠ {warn} alerta{warn > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Mini label de línea */}
      <div style={{ color: "#64748b", fontSize: 10, marginBottom: 14 }}>{meta.label}</div>

      {/* Preview equipos (máx 6 por nivel, en miniatura) */}
      {byPurdue.map((group, gi) => (
        <div key={gi} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
          <div style={{
            fontSize:    7,
            fontFamily:  "monospace",
            color:       (PURDUE[group[0]?.purdueLevel] ?? PURDUE["1"]).color,
            minWidth:    24,
          }}>
            L{group[0]?.purdueLevel}
          </div>
          {group.slice(0, 5).map(a => (
            <div key={a.id} title={`${a.id} — ${a.name}`}>
              <EquipmentIcon asset={a} size={36}/>
            </div>
          ))}
          {group.length > 5 && (
            <span style={{ color: "#334155", fontSize: 9, fontFamily: "monospace" }}>+{group.length - 5}</span>
          )}
        </div>
      ))}

      {/* Protocolos usados */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10 }}>
        {[...new Set(assets.flatMap(a => (a.Protocols || "").split(",").map(p => p.trim())))].slice(0,5).map(p => (
          <span key={p} style={{
            fontSize:     7,
            fontFamily:   "monospace",
            color:        protoColor(p),
            background:   protoColor(p) + "12",
            border:       `1px solid ${protoColor(p)}30`,
            padding:      "1px 5px",
            borderRadius: 3,
          }}>{p}</span>
        ))}
      </div>

      <div style={{ marginTop: 14, textAlign: "right", color: meta.color, fontSize: 9, fontFamily: "monospace" }}>
        VER DETALLE →
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL — DynamicPlant
──────────────────────────────────────────────────────────────────────────── */
export default function DynamicPlant({
  assets:      rawAssets      = SAMPLE_ASSETS,
  connections: rawConnections = SAMPLE_CONNECTIONS,
  labData      = null,          // ← datos del excelParser (tiene prioridad)
  events       = [],
  alarms       = [],
  onAssetSelect,
  onImportRequest,              // ← callback para abrir ExcelImporter
}) {
  const [activeLine,     setActiveLine]     = useState(null);
  const [selectedAsset,  setSelectedAsset]  = useState(null);
  const [interfaceAsset, setInterfaceAsset] = useState(null);

  // Usar labData si está disponible, si no usar props directas
  const sourceAssets      = labData?.assets      ?? rawAssets;
  const sourceConnections = labData?.connections  ?? rawConnections;
  const sourceLines       = labData?.lines        ?? [];

  // Normalizar al formato interno
  const assets      = useMemo(() => sourceAssets.map(normAsset).filter(Boolean),      [sourceAssets]);
  const connections = useMemo(() => sourceConnections.map(normConnection).filter(Boolean), [sourceConnections]);

  // Metadatos de líneas (del Excel o generado)
  const lineMeta = useMemo(() => {
    const base = { ...LINE_META };
    if (sourceLines?.length) {
      sourceLines.forEach(l => {
        if (!base[l.id]) {
          const colors  = ["#22d3ee","#ef4444","#22c55e","#f59e0b","#818cf8","#a78bfa"];
          const icons   = ["🏭","⚙","🔩","🛡","🔧","🔬"];
          const idx     = Object.keys(base).length % colors.length;
          base[l.id]    = { label: l.name ?? l.id, color: colors[idx], icon: icons[idx], bg: `${colors[idx]}08` };
        } else {
          base[l.id] = { ...base[l.id], label: l.name ?? base[l.id].label };
        }
      });
    }
    return base;
  }, [sourceLines]);

  // Agrupar por línea
  const byLine = useMemo(() => {
    const map = {};
    for (const a of assets) {
      const line = a.line || "SHARED";
      if (!map[line]) map[line] = [];
      map[line].push(a);
    }
    return map;
  }, [assets]);

  // Orden de líneas
  const lineOrder = useMemo(() => {
    const fromMeta  = sourceLines.length
      ? sourceLines.map(l => l.id).filter(id => byLine[id])
      : ["LINE-01", "LINE-02", "LINE-03"];
    const extras    = Object.keys(byLine).filter(l => !fromMeta.includes(l) && l !== "SHARED");
    return [...fromMeta, ...extras, ...(byLine["SHARED"] ? ["SHARED"] : [])];
  }, [sourceLines, byLine]);

  // Contadores
  const totalAssets   = assets.length;
  const online        = assets.filter(a => a.status === "ONLINE").length;
  const alertCount    = assets.filter(a => ["WARNING","COMPROMISED","DAMAGED"].includes(a.status)).length;
  const lineCount     = lineOrder.filter(l => l !== "SHARED").length;
  const criticalAlarm = alarms.some(a => a.severity === "CRITICAL" && a.active);

  function handleAssetClick(asset) {
    setSelectedAsset(prev => prev?.id === asset.id ? null : asset);
    setInterfaceAsset(asset);
    onAssetSelect?.(asset);
  }

  /* ── EquipmentInterface (pantalla completa) ── */
  if (interfaceAsset) {
    // Adaptar al formato que espera EquipmentInterface
    const adapted = {
      ...interfaceAsset,
      asset_id:     interfaceAsset.id,
      name:         interfaceAsset.name,
      type:         interfaceAsset.type,
      ip_address:   interfaceAsset.ip,
      manufacturer: interfaceAsset.vendor,
      model:        interfaceAsset.model,
      status:       interfaceAsset.status,
      vlan:         interfaceAsset.vlan,
    };
    return (
      <EquipmentInterface
        asset={adapted}
        plant={{ process: null, events }}
        events={events}
        onBack={() => setInterfaceAsset(null)}
      />
    );
  }

  /* ── EMPTY STATE: sin datos ── */
  if (!assets.length) {
    return (
      <div style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        height:         "calc(100vh - 200px)",
        gap:            20,
        textAlign:      "center",
      }}>
        <div style={{ fontSize: 64 }}>📋</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
          No hay inventario cargado
        </div>
        <div style={{ color: "#64748b", fontSize: 13, maxWidth: 420, lineHeight: 1.6 }}>
          Importa tu archivo Excel de inventario de activos para visualizar la planta.
          Soporta cualquier Excel con activos, conexiones, VLANs y variables.
        </div>
        {onImportRequest && (
          <button
            onClick={onImportRequest}
            style={{
              background:   "rgba(59,130,246,0.15)",
              border:       "1.5px solid #3b82f6",
              borderRadius: 8,
              color:        "#3b82f6",
              padding:      "12px 28px",
              fontSize:     13,
              fontFamily:   "monospace",
              fontWeight:   700,
              cursor:       "pointer",
              letterSpacing: ".06em",
              marginTop:    8,
            }}
          >
            📂  IMPORTAR INVENTARIO EXCEL
          </button>
        )}
      </div>
    );
  }

  /* ── VISTA DETALLE DE UNA LÍNEA ── */
  if (activeLine) {
    const lineAssets = byLine[activeLine] ?? [];
    return (
      <div style={{ width: "100%", height: "calc(100vh - 130px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <LineDetailView
          lineKey       = {activeLine}
          assets        = {lineAssets}
          connections   = {connections}
          lineMeta      = {lineMeta}
          onBack        = {() => { setActiveLine(null); setSelectedAsset(null); }}
          onAssetClick  = {handleAssetClick}
          selectedId    = {selectedAsset?.id}
        />
      </div>
    );
  }

  /* ── VISTA OVERVIEW ── */
  return (
    <div style={{ width: "100%", padding: "0 0 24px" }}>

      {/* Header con botón de import */}
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        marginBottom:   20,
        paddingBottom:  16,
        borderBottom:   "1px solid #0d1520",
      }}>
        <div style={{ fontSize: 10, fontFamily: "monospace", color: "#334155", letterSpacing: ".12em" }}>
          PLANTA INDUSTRIAL — {labData ? `${labData.meta?.importedAt?.split("T")[0] ?? "importado"}` : "datos de muestra"}
        </div>
        {onImportRequest && (
          <button
            onClick={onImportRequest}
            style={{
              background:   "rgba(59,130,246,0.08)",
              border:       "1px solid rgba(59,130,246,0.3)",
              borderRadius: 6,
              color:        "#3b82f6",
              padding:      "6px 14px",
              fontSize:     10,
              fontFamily:   "monospace",
              cursor:       "pointer",
              letterSpacing: ".06em",
            }}
          >
            📂 {labData ? "CAMBIAR INVENTARIO" : "IMPORTAR EXCEL"}
          </button>
        )}
      </div>

      {/* KPI bar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingBottom: 20, borderBottom: "1px solid #0d1520", marginBottom: 24 }}>
        {[
          { label: "Total Activos",  value: totalAssets,  color: "#60a5fa" },
          { label: "En línea",       value: online,        color: "#22c55e" },
          { label: "Alertas",        value: alertCount,    color: alertCount > 0 ? "#ef4444" : "#4b5563" },
          { label: "Líneas activas", value: lineCount,     color: "#818cf8" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "rgba(255,255,255,.02)",
            border:     `1px solid ${color}22`,
            borderRadius: 8, padding: "10px 18px", textAlign: "center", minWidth: 110,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4, letterSpacing: ".05em" }}>{label}</div>
          </div>
        ))}
        {criticalAlarm && (
          <div style={{ background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.4)", borderRadius: 8, padding: "10px 18px", color: "#ef4444", fontFamily: "monospace", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, animation: "pulse 1.2s infinite" }}>
            ⚠ ALARMAS CRÍTICAS
          </div>
        )}
      </div>

      {/* Cards de líneas */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 32 }}>
        {lineOrder.filter(l => l !== "SHARED" && byLine[l]?.length).map(lineKey => (
          <LineOverviewCard
            key     = {lineKey}
            lineKey = {lineKey}
            assets  = {byLine[lineKey] ?? []}
            lineMeta= {lineMeta}
            onClick = {setActiveLine}
          />
        ))}
      </div>

      {/* Infraestructura compartida */}
      {byLine["SHARED"]?.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontFamily: "monospace", color: "#334155", letterSpacing: ".12em", marginBottom: 14 }}>
            INFRAESTRUCTURA COMPARTIDA
          </div>
          <div
            onClick={() => setActiveLine("SHARED")}
            style={{ display: "flex", gap: 20, flexWrap: "wrap", background: "rgba(255,255,255,.015)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 10, padding: "16px 20px", cursor: "pointer", transition: "all .2s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#f59e0b"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(245,158,11,.2)"}
          >
            {byLine["SHARED"].map(asset => (
              <EquipmentCard key={asset.id} asset={asset} size={68} selected={selectedAsset?.id === asset.id}
                onClick={handleAssetClick}/>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}`}</style>
    </div>
  );
}