/**
 * DynamicPlant.jsx
 * Vista de planta industrial dinámica.
 * Acepta datos en FORMATO NORMALIZADO del excelParser (asset.id, asset.ip, etc.)
 * O en el formato de muestra interno (asset.id, asset.ip, etc.) — auto-detecta.
 */

import { useState, useMemo } from "react";
import { EquipmentIcon }        from "./EquipmentIcons";
import EquipmentInterface       from "./EquipmentInterface";
import { activityColor, connActivity, assetActivity, healthColor, connHealth } from "../utils/otActions";

function normAsset(a) {
  if (!a) return null;
  return {
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
    purdueLevel: String(a.purdueLevel ?? a.Purdue_Level ?? "1"),
    protocols:   Array.isArray(a.protocols)
                   ? a.protocols
                   : String(a.protocols ?? a.Protocols ?? "").split(/[;,]/).map(p=>p.trim()).filter(Boolean),
    description: a.description ?? a.Description ?? "",
    firmware:    a.firmware    ?? a.OS_Firmware  ?? "",
    application: a.application ?? a.Application  ?? "",
    asset_id:    a.id ?? a.ID ?? "?",
    _raw:        a._raw ?? a,
  };
}

function normConnection(c) {
  if (!c) return null;
  return {
    sourceId:  c.sourceId  ?? c.Source_ID ?? c.Source ?? "",
    targetId:  c.targetId  ?? c.Target_ID ?? c.Destination ?? "",
    protocol:  c.protocol  ?? c.Protocol  ?? "",
    port:      String(c.port ?? c.Port ?? ""),
    direction: c.direction ?? c.Direction ?? "bidirectional",
  };
}

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
    protocol.toUpperCase().includes(k.toUpperCase())
  );
  return PROTO_COLOR[key ?? "default"];
}

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

const SAMPLE_ASSETS = [
  { ID:"PLC-001", Name:"Main PLC L01",        Type:"PLC",       Vendor:"Siemens",  Model:"S7-1500",       Line:"LINE-01", IP_Address:"172.16.100.10", VLAN:"440", Purdue_Level:"1", Protocols:"S7comm,OPC-UA", Status:"ONLINE" },
  { ID:"HMI-001", Name:"Operator Panel L01",  Type:"HMI",       Vendor:"Siemens",  Model:"KP900 Comfort", Line:"LINE-01", IP_Address:"172.16.102.10", VLAN:"902", Purdue_Level:"2", Protocols:"S7comm",        Status:"ONLINE" },
  { ID:"SCADA-001",Name:"WinCC Server L01",   Type:"SCADA",     Vendor:"Siemens",  Model:"WinCC V7.5",    Line:"LINE-01", IP_Address:"172.16.104.10", VLAN:"904", Purdue_Level:"3", Protocols:"OPC-UA",         Status:"ONLINE" },
  { ID:"SW-001",  Name:"OT Switch L01",       Type:"Switch",    Vendor:"Hirschmann",Model:"RS20-0400",    Line:"LINE-01", IP_Address:"172.16.110.1",  VLAN:"440", Purdue_Level:"2", Protocols:"PROFINET,SNMP",  Status:"ONLINE" },
  { ID:"M-001",   Name:"Pump Motor L01",      Type:"Motor",     Vendor:"ABB",      Model:"M3BP 160",      Line:"LINE-01", IP_Address:"172.16.100.30", VLAN:"440", Purdue_Level:"0", Protocols:"PROFINET",       Status:"ONLINE" },
  { ID:"TT-001",  Name:"Temp Sensor L01",     Type:"Sensor",    Vendor:"Siemens",  Model:"SITRANS TS300", Line:"LINE-01", IP_Address:"172.16.100.40", VLAN:"440", Purdue_Level:"0", Protocols:"PROFINET",       Status:"ONLINE" },
  { ID:"V-001",   Name:"Control Valve L01",   Type:"Valve",     Vendor:"Fisher",   Model:"DVC6200",       Line:"LINE-01", IP_Address:"172.16.100.50", VLAN:"440", Purdue_Level:"0", Protocols:"PROFIBUS",       Status:"ONLINE" },
  { ID:"FW-001",  Name:"FortiGate 100F",      Type:"Firewall",  Vendor:"Fortinet", Model:"FortiGate 100F",Line:"SHARED",  IP_Address:"172.16.200.1",  VLAN:"—",   Purdue_Level:"3.5",Protocols:"IP",            Status:"ONLINE" },
  { ID:"ENG-001", Name:"Engineering WS",      Type:"Workstation",Vendor:"HP",      Model:"Z4 G5",         Line:"SHARED",  IP_Address:"172.16.201.10", VLAN:"901", Purdue_Level:"4", Protocols:"S7comm,OPC-UA", Status:"ONLINE" },
];

const SAMPLE_CONNECTIONS = [
  { sourceId:"PLC-001", targetId:"M-001",    protocol:"PROFINET", direction:"bidirectional" },
  { sourceId:"PLC-001", targetId:"TT-001",   protocol:"PROFINET", direction:"inbound"       },
  { sourceId:"PLC-001", targetId:"V-001",    protocol:"PROFIBUS", direction:"bidirectional" },
  { sourceId:"SW-001",  targetId:"PLC-001",  protocol:"PROFINET", direction:"bidirectional" },
  { sourceId:"SW-001",  targetId:"HMI-001",  protocol:"S7comm",   direction:"bidirectional" },
  { sourceId:"SW-001",  targetId:"SCADA-001",protocol:"OPC-UA",   direction:"bidirectional" },
];

const LINE_META = {
  "LINE-01": { label: "Línea 01 — Maquinado CNC",        color: "#22d3ee", icon: "⚙",  bg: "rgba(34,211,238,.06)"  },
  "LINE-02": { label: "Línea 02 — Moldeo por Inyección", color: "#ef4444", icon: "🏭", bg: "rgba(239,68,68,.06)"   },
  "LINE-03": { label: "Línea 03 — Ensamble y Pruebas",   color: "#22c55e", icon: "🔩", bg: "rgba(34,197,94,.06)"   },
  "SHARED":  { label: "Infraestructura Compartida",       color: "#f59e0b", icon: "🛡", bg: "rgba(245,158,11,.06)"  },
};

/* ── PHOTO MAP ── */
const PHOTO_MAP = {
  "plc-siemens":         "/equipment/plc-siemens.jpg",
  "plc-rockwell":        "/equipment/plc-siemens.jpg",
  "plc":                 "/equipment/plc-siemens.jpg",
  "hmi-siemens":         "/equipment/hmi-siemens.jpg",
  "hmi-rockwell":        "/equipment/hmi-siemens.jpg",
  "hmi":                 "/equipment/hmi-siemens.jpg",
  "scada":               "/equipment/engineering-station.jpg",
  "mes":                 "/equipment/engineering-station.jpg",
  "historian":           "/equipment/engineering-station.jpg",
  "engineering station": "/equipment/engineering-station.jpg",
  "workstation":         "/equipment/engineering-station.jpg",
  "ewon":                "/equipment/ewon-hms.jpg",
  "ewon-hms":            "/equipment/ewon-hms.jpg",
  "gateway":             "/equipment/ewon-hms.jpg",
  "switch-siemens":      "/equipment/switch-siemens.jpg",
  "switch-hirschmann":   "/equipment/switch-siemens.jpg",
  "switch-cisco":        "/equipment/switch-siemens.jpg",
  "switch":              "/equipment/switch-siemens.jpg",
  "sensor":              "/equipment/sensor.jpg",
  "valve":               "/equipment/valve.jpg",
  "motor":               "/equipment/motor.jpg",
  "drive":               "/equipment/motor.jpg",
  "conveyor":            "/equipment/motor.jpg",
  "firewall":            "/equipment/switch-siemens.jpg",
  "mguard":              "/equipment/switch-siemens.jpg",
  "security":            "/equipment/switch-siemens.jpg",
};

function getPhotoUrl(asset) {
  const type   = (asset.type   || "").toLowerCase().trim();
  const vendor = (asset.vendor || "").toLowerCase().split(" ")[0];
  return PHOTO_MAP[`${type}-${vendor}`] ?? PHOTO_MAP[type] ?? null;
}

/* ── EQUIPMENT CARD (SVG fallback, usado en SHARED overview) ── */
function EquipmentCard({ asset, size = 72, onClick, selected = false }) {
  const st = statusColor(asset.status);
  const pu = PURDUE[asset.purdueLevel] ?? PURDUE["1"];
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick?.(asset); }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        padding: "10px 8px", borderRadius: 10,
        border:  `1.5px solid ${selected ? st : "rgba(255,255,255,0.06)"}`,
        background: selected ? `${st}10` : "rgba(255,255,255,0.02)",
        cursor: "pointer", transition: "all .2s", width: size + 32,
        position: "relative", boxShadow: selected ? `0 0 12px ${st}44` : "none",
      }}
    >
      <div style={{ position:"absolute", top:6, right:6, width:8, height:8, borderRadius:"50%", background:st, boxShadow:`0 0 6px ${st}` }}/>
      <div style={{ position:"absolute", top:6, left:6, fontSize:8, fontFamily:"monospace", color:pu.color, background:pu.bg, border:`1px solid ${pu.color}44`, padding:"1px 4px", borderRadius:3 }}>
        L{asset.purdueLevel}
      </div>
      <div style={{ marginTop: 8 }}><EquipmentIcon asset={asset} size={size}/></div>
      <div style={{ fontSize:9, fontFamily:"monospace", fontWeight:700, color:"#94a3b8", letterSpacing:".06em", marginTop:2 }}>{asset.id}</div>
      <div style={{ fontSize:9, color:"#64748b", textAlign:"center", lineHeight:1.3, maxWidth:90 }}>{asset.name}</div>
      <div style={{ fontSize:8, fontFamily:"monospace", color:"#334155" }}>{asset.ip}</div>
    </div>
  );
}

/* ── EQUIPMENT PHOTO CARD ── */
function EquipmentPhotoCard({ asset, selected, onClick, compact = false, actColor = null, healthCol = null }) {
  const [imgErr, setImgErr] = useState(false);
  const photoUrl = getPhotoUrl(asset);
  const st  = healthCol || actColor || statusColor(asset.status);
  const pu  = PURDUE[asset.purdueLevel] ?? PURDUE["1"];
  const cardW = compact ? 86 : 106;
  const imgH  = compact ? 56 : 70;

  return (
    <div
      onClick={e => { e.stopPropagation(); onClick?.(asset); }}
      title={`${asset.id} — ${asset.name}\n${asset.ip}`}
      style={{
        width: cardW, borderRadius: 8,
        border: `1.5px solid ${selected ? st : "#1e293b"}`,
        background: selected ? `${st}12` : "#080e18",
        cursor: "pointer", overflow: "hidden", flexShrink: 0,
        boxShadow: selected ? `0 0 14px ${st}44` : "0 2px 8px rgba(0,0,0,.4)",
        transition: "all .18s", position: "relative",
      }}
    >
      <div style={{ height: 3, background: actColor || pu.color }}/>
      <div style={{ position:"absolute", top:7, right:7, width:7, height:7, borderRadius:"50%", background:st, boxShadow:`0 0 5px ${st}`, zIndex:2 }}/>
      <div style={{ position:"relative", height:imgH, background:"#040a12", overflow:"hidden" }}>
        {photoUrl && !imgErr ? (
          <img src={photoUrl} alt={asset.type}
            style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center", display:"block", filter:"brightness(0.88) contrast(1.1)" }}
            onError={() => setImgErr(true)}
          />
        ) : (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%" }}>
            <EquipmentIcon asset={asset} size={compact ? 46 : 58}/>
          </div>
        )}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:28, background:"linear-gradient(transparent, rgba(4,10,18,.9))" }}/>
      </div>
      <div style={{ padding:"5px 6px 6px" }}>
        <div style={{ fontSize:9, fontFamily:"monospace", fontWeight:700, color:st, letterSpacing:".04em", lineHeight:1.2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{asset.id}</div>
        <div style={{ fontSize:8, color:"#475569", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginTop:1 }}>{asset.type}</div>
        {!compact && <div style={{ fontSize:7, color:"#1e3a5f", fontFamily:"monospace", marginTop:2 }}>{asset.ip}</div>}
      </div>
    </div>
  );
}

/* ── MINI PHOTO (usado en LineOverviewCard previews) ── */
function MiniPhoto({ asset }) {
  const [imgErr, setImgErr] = useState(false);
  const photoUrl = getPhotoUrl(asset);
  return (
    <div title={`${asset.id} — ${asset.name}`} style={{ width:36, height:36, borderRadius:4, overflow:"hidden", border:"1px solid #1e293b", background:"#040a12" }}>
      {photoUrl && !imgErr ? (
        <img src={photoUrl} alt={asset.type}
          style={{ width:"100%", height:"100%", objectFit:"cover" }}
          onError={() => setImgErr(true)}/>
      ) : (
        <EquipmentIcon asset={asset} size={34}/>
      )}
    </div>
  );
}

/* ── TOPOLOGY VIEW ── */
function TopologyView({ assets, connections, selectedId, onAssetClick, lineColor, activity = {}, health = {} }) {
  const LEVEL_ORDER = ["3.5", "3", "2", "1", "0"];
  const CARD_W = 106;
  const CARD_H = 122;
  const GAP_X  = 20;
  const PAD_Y  = 24;

  const byLevel = {};
  assets.forEach(a => {
    const l = a.purdueLevel || "1";
    if (!byLevel[l]) byLevel[l] = [];
    byLevel[l].push(a);
  });
  const activeLevels = LEVEL_ORDER.filter(l => byLevel[l]?.length);

  const maxPerLevel = Math.max(...activeLevels.map(l => byLevel[l].length), 1);
  const svgW = Math.max(700, 64 + maxPerLevel * (CARD_W + GAP_X) - GAP_X);
  const svgH = PAD_Y * 2 + activeLevels.length * (CARD_H + 60) - 60;

  const pos = {};
  activeLevels.forEach((level, li) => {
    const row    = byLevel[level];
    const rowW   = row.length * (CARD_W + GAP_X) - GAP_X;
    const startX = (svgW - rowW) / 2;
    const y      = PAD_Y + li * (CARD_H + 60);
    row.forEach((a, ai) => {
      pos[a.id] = {
        cx: startX + ai * (CARD_W + GAP_X) + CARD_W / 2,
        cy: y + CARD_H / 2,
        x:  startX + ai * (CARD_W + GAP_X),
        y,
      };
    });
  });

  const assetIds     = new Set(assets.map(a => a.id));
  const visibleConns = connections.filter(c => assetIds.has(c.sourceId) && assetIds.has(c.targetId));

  return (
    <div style={{ position:"relative", overflowX:"auto", overflowY:"auto" }}>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ width:svgW, height:svgH, position:"absolute", top:0, left:0, pointerEvents:"none" }}
      >
        <defs>
          <radialGradient id="bg-glow" cx="50%" cy="50%">
            <stop offset="0%"   stopColor={lineColor} stopOpacity="0.06"/>
            <stop offset="100%" stopColor={lineColor} stopOpacity="0"/>
          </radialGradient>
        </defs>
        <ellipse cx={svgW/2} cy={svgH/2} rx={svgW*0.6} ry={svgH*0.5} fill="url(#bg-glow)"/>

        {activeLevels.map((level, li) => {
          const pu = PURDUE[level] ?? PURDUE["1"];
          const y  = PAD_Y + li * (CARD_H + 60);
          return (
            <g key={level}>
              <line x1={0} y1={y-8} x2={svgW} y2={y-8} stroke={pu.color} strokeWidth={0.5} strokeDasharray="4 8" opacity={0.3}/>
              <text x={8} y={y+12} fontSize={9} fill={pu.color} fontFamily="monospace" fontWeight="bold" opacity={0.7}>L{level}</text>
              <text x={8} y={y+22} fontSize={7} fill={pu.color} fontFamily="monospace" opacity={0.5}>{pu.label}</text>
            </g>
          );
        })}

        {visibleConns.map((conn, i) => {
          const from = pos[conn.sourceId];
          const to   = pos[conn.targetId];
          if (!from || !to) return null;
          const proto  = (conn.protocol || "").split(",")[0];
          const act    = connActivity(activity, conn.sourceId, conn.targetId);
          const ch     = connHealth(health, conn.sourceId, conn.targetId);
          const critColor = ch !== "normal" ? healthColor(ch) : null;
          const color  = critColor || (act && activityColor(act.state)) || protoColor(proto);
          const dir    = conn.direction ?? "bidirectional";
          const liveDur = (act || critColor) ? "0.5s" : "1.4s";
          const dx = to.cx - from.cx;
          const dy = to.cy - from.cy;
          const d  = `M${from.cx},${from.cy} C${from.cx+dx*0.1},${from.cy+dy*0.5} ${to.cx-dx*0.1},${to.cy-dy*0.5} ${to.cx},${to.cy}`;
          const midX = (from.cx + to.cx) / 2;
          const midY = (from.cy + to.cy) / 2 - 8;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={color} strokeWidth={4} opacity={0.08}/>
              <path d={d} fill="none" stroke={color} strokeWidth={(act || critColor) ? 2.6 : 1.8} strokeDasharray="10 5" opacity={(act || critColor) ? 1 : 0.75}>
                <animate attributeName="stroke-dashoffset"
                  from={dir === "inbound" ? 0 : 30}
                  to={dir   === "inbound" ? 30 : 0}
                  dur={liveDur} repeatCount="indefinite"/>
              </path>
              <rect x={midX-20} y={midY-7} width={40} height={12} rx={3} fill="#04080f" opacity={0.85}/>
              <text x={midX} y={midY+2} textAnchor="middle" fontSize={7} fill={color} fontFamily="monospace" opacity={0.9}>{proto}</text>
            </g>
          );
        })}
      </svg>

      <div style={{ position:"relative", width:svgW, height:svgH }}>
        {assets.map(asset => {
          const p = pos[asset.id];
          if (!p) return null;
          return (
            <div key={asset.id} style={{ position:"absolute", left:p.x, top:p.y, width:CARD_W, zIndex:10 }}>
              <EquipmentPhotoCard asset={asset} selected={selectedId === asset.id} onClick={onAssetClick}
                actColor={(() => { const a = assetActivity(activity, asset.id); return a ? activityColor(a.state) : null; })()}
                healthCol={healthColor(health[asset.id] || "normal")}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── LINE DETAIL VIEW ── */
function LineDetailView({ lineKey, assets, connections, lineMeta, onBack, onAssetClick, selectedId, activity = {}, health = {} }) {
  const meta      = lineMeta?.[lineKey] ?? LINE_META[lineKey] ?? { label: lineKey, color: "#4b5563", icon: "⚙", bg: "transparent" };
  const assetIds  = new Set(assets.map(a => a.id));
  const lineConns = connections.filter(c => assetIds.has(c.sourceId) || assetIds.has(c.targetId));
  const protocols = [...new Set(lineConns.map(c => (c.protocol || "").split(",")[0]).filter(Boolean))];

  return (
    <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 24px", borderBottom:`1px solid ${meta.color}22`, background:meta.bg, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:`1px solid ${meta.color}44`, color:meta.color, padding:"5px 12px", borderRadius:6, cursor:"pointer", fontFamily:"monospace", fontSize:10 }}>
          ← VOLVER
        </button>
        <span style={{ fontSize: 20 }}>{meta.icon}</span>
        <div>
          <div style={{ color:meta.color, fontFamily:"monospace", fontWeight:700, fontSize:14, letterSpacing:".05em" }}>{meta.label}</div>
          <div style={{ color:"#4b5563", fontSize:9, fontFamily:"monospace" }}>{assets.length} activos · {lineConns.length} conexiones</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:6, flexWrap:"wrap" }}>
          {protocols.map(p => (
            <span key={p} style={{ background:protoColor(p)+"18", border:`1px solid ${protoColor(p)}44`, color:protoColor(p), padding:"2px 8px", borderRadius:4, fontSize:8, fontFamily:"monospace" }}>{p}</span>
          ))}
        </div>
        <div style={{ color:"#1e293b", fontSize:8, fontFamily:"monospace", flexShrink:0 }}>clic en equipo → interfaz completa</div>
      </div>
      <div style={{ flex:1, overflowY:"auto", overflowX:"auto", padding:"16px 24px 24px" }}>
        <TopologyView assets={assets} connections={lineConns} selectedId={selectedId} onAssetClick={onAssetClick} lineColor={meta.color} activity={activity} health={health}/>
      </div>
    </div>
  );
}

/* ── LINE OVERVIEW CARD ── */
function LineOverviewCard({ lineKey, assets, lineMeta, onClick }) {
  const meta     = lineMeta?.[lineKey] ?? LINE_META[lineKey] ?? { label: lineKey, color: "#4b5563", icon: "⚙", bg: "transparent" };
  const warn     = assets.filter(a => ["WARNING","COMPROMISED","DAMAGED","OFFLINE"].includes(a.status?.toUpperCase())).length;
  const byPurdue = [3, 2, 1, 0].map(l => assets.filter(a => parseInt(a.purdueLevel) === l)).filter(g => g.length);
  const allProtos = [...new Set(assets.flatMap(a => (a.protocols || []).map(p => p.trim())))].slice(0, 5);

  return (
    <div
      onClick={() => onClick(lineKey)}
      style={{ flex:1, minWidth:280, maxWidth:400, background:"rgba(255,255,255,0.02)", border:`1.5px solid ${meta.color}33`, borderRadius:12, padding:"18px 20px", cursor:"pointer", transition:"all .25s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor=meta.color; e.currentTarget.style.background=meta.bg; e.currentTarget.style.boxShadow=`0 0 20px ${meta.color}22`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor=meta.color+"33"; e.currentTarget.style.background="rgba(255,255,255,.02)"; e.currentTarget.style.boxShadow="none"; }}
    >
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20 }}>{meta.icon}</span>
          <div>
            <div style={{ color:meta.color, fontFamily:"monospace", fontWeight:700, fontSize:11, letterSpacing:".06em" }}>{lineKey}</div>
            <div style={{ color:"#4b5563", fontSize:9 }}>{assets.length} activos</div>
          </div>
        </div>
        {warn > 0 && (
          <div style={{ background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.3)", color:"#ef4444", fontSize:9, padding:"3px 8px", borderRadius:4, fontFamily:"monospace" }}>
            ⚠ {warn} alerta{warn > 1 ? "s" : ""}
          </div>
        )}
      </div>
      <div style={{ color:"#64748b", fontSize:10, marginBottom:14 }}>{meta.label}</div>

      {byPurdue.map((group, gi) => (
        <div key={gi} style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8, alignItems:"center" }}>
          <div style={{ fontSize:7, fontFamily:"monospace", color:(PURDUE[group[0]?.purdueLevel]??PURDUE["1"]).color, minWidth:24 }}>
            L{group[0]?.purdueLevel}
          </div>
          {group.slice(0, 5).map(a => <MiniPhoto key={a.id} asset={a}/>)}
          {group.length > 5 && <span style={{ color:"#334155", fontSize:9, fontFamily:"monospace" }}>+{group.length-5}</span>}
        </div>
      ))}

      <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:10 }}>
        {allProtos.map(p => (
          <span key={p} style={{ fontSize:7, fontFamily:"monospace", color:protoColor(p), background:protoColor(p)+"12", border:`1px solid ${protoColor(p)}30`, padding:"1px 5px", borderRadius:3 }}>{p}</span>
        ))}
      </div>
      <div style={{ marginTop:14, textAlign:"right", color:meta.color, fontSize:9, fontFamily:"monospace" }}>VER DETALLE →</div>
    </div>
  );
}

/* ── MAIN COMPONENT ── */
export default function DynamicPlant({
  assets:      rawAssets      = SAMPLE_ASSETS,
  connections: rawConnections = SAMPLE_CONNECTIONS,
  labData      = null,
  events       = [],
  alarms       = [],
  activity     = {},
  health       = {},
  onAssetSelect,
  onImportRequest,
}) {
  const [activeLine,     setActiveLine]     = useState(null);
  const [selectedAsset,  setSelectedAsset]  = useState(null);
  const [interfaceAsset, setInterfaceAsset] = useState(null);

  const sourceAssets      = labData?.assets      ?? rawAssets;
  const sourceConnections = labData?.connections  ?? rawConnections;
  const sourceLines       = labData?.lines        ?? [];

  const assets      = useMemo(() => sourceAssets.map(normAsset).filter(Boolean),           [sourceAssets]);
  const connections = useMemo(() => sourceConnections.map(normConnection).filter(Boolean), [sourceConnections]);

  const lineMeta = useMemo(() => {
    const base   = { ...LINE_META };
    const colors = ["#22d3ee","#ef4444","#22c55e","#f59e0b","#818cf8","#a78bfa"];
    const icons  = ["🏭","⚙","🔩","🛡","🔧","🔬"];
    sourceLines.forEach(l => {
      if (!base[l.id]) {
        const idx  = Object.keys(base).length % colors.length;
        base[l.id] = { label: l.name ?? l.id, color: colors[idx], icon: icons[idx], bg: `${colors[idx]}08` };
      } else {
        base[l.id] = { ...base[l.id], label: l.name ?? base[l.id].label };
      }
    });
    return base;
  }, [sourceLines]);

  const byLine = useMemo(() => {
    const map = {};
    for (const a of assets) {
      const line = a.line || "SHARED";
      if (!map[line]) map[line] = [];
      map[line].push(a);
    }
    return map;
  }, [assets]);

  const lineOrder = useMemo(() => {
    const fromMeta = sourceLines.length
      ? sourceLines.map(l => l.id).filter(id => byLine[id])
      : ["LINE-01", "LINE-02", "LINE-03"];
    const extras = Object.keys(byLine).filter(l => !fromMeta.includes(l) && l !== "SHARED");
    return [...fromMeta, ...extras, ...(byLine["SHARED"] ? ["SHARED"] : [])];
  }, [sourceLines, byLine]);

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

  if (interfaceAsset) {
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

  if (!assets.length) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"calc(100vh - 200px)", gap:20, textAlign:"center" }}>
        <div style={{ fontSize: 64 }}>📋</div>
        <div style={{ fontSize:18, fontWeight:700, color:"#e2e8f0" }}>No hay inventario cargado</div>
        <div style={{ color:"#64748b", fontSize:13, maxWidth:420, lineHeight:1.6 }}>
          Importa tu archivo Excel de inventario de activos para visualizar la planta.
        </div>
        {onImportRequest && (
          <button onClick={onImportRequest} style={{ background:"rgba(59,130,246,0.15)", border:"1.5px solid #3b82f6", borderRadius:8, color:"#3b82f6", padding:"12px 28px", fontSize:13, fontFamily:"monospace", fontWeight:700, cursor:"pointer", letterSpacing:".06em", marginTop:8 }}>
            📂  IMPORTAR INVENTARIO EXCEL
          </button>
        )}
      </div>
    );
  }

  if (activeLine) {
    return (
      <div style={{ width:"100%", height:"calc(100vh - 130px)", overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <LineDetailView
          lineKey     = {activeLine}
          assets      = {byLine[activeLine] ?? []}
          connections = {connections}
          lineMeta    = {lineMeta}
          activity    = {activity}
          health      = {health}
          onBack      = {() => { setActiveLine(null); setSelectedAsset(null); }}
          onAssetClick= {handleAssetClick}
          selectedId  = {selectedAsset?.id}
        />
      </div>
    );
  }

  return (
    <div style={{ width:"100%", padding:"0 0 24px" }}>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, paddingBottom:16, borderBottom:"1px solid #0d1520" }}>
        <div style={{ fontSize:10, fontFamily:"monospace", color:"#334155", letterSpacing:".12em" }}>
          PLANTA INDUSTRIAL — {labData ? `${labData.meta?.importedAt?.split("T")[0] ?? "importado"}` : "datos de muestra"}
        </div>
        {onImportRequest && (
          <button onClick={onImportRequest} style={{ background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.3)", borderRadius:6, color:"#3b82f6", padding:"6px 14px", fontSize:10, fontFamily:"monospace", cursor:"pointer", letterSpacing:".06em" }}>
            📂 {labData ? "CAMBIAR INVENTARIO" : "IMPORTAR EXCEL"}
          </button>
        )}
      </div>

      <div style={{ display:"flex", gap:10, flexWrap:"wrap", paddingBottom:20, borderBottom:"1px solid #0d1520", marginBottom:24 }}>
        {[
          { label:"Total Activos",  value:totalAssets,  color:"#60a5fa" },
          { label:"En línea",       value:online,        color:"#22c55e" },
          { label:"Alertas",        value:alertCount,    color:alertCount > 0 ? "#ef4444" : "#4b5563" },
          { label:"Líneas activas", value:lineCount,     color:"#818cf8" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:"rgba(255,255,255,.02)", border:`1px solid ${color}22`, borderRadius:8, padding:"10px 18px", textAlign:"center", minWidth:110 }}>
            <div style={{ fontSize:22, fontWeight:800, fontFamily:"monospace", color, lineHeight:1 }}>{value}</div>
            <div style={{ fontSize:9, color:"#4b5563", marginTop:4, letterSpacing:".05em" }}>{label}</div>
          </div>
        ))}
        {criticalAlarm && (
          <div style={{ background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.4)", borderRadius:8, padding:"10px 18px", color:"#ef4444", fontFamily:"monospace", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", gap:8, animation:"pulse 1.2s infinite" }}>
            ⚠ ALARMAS CRÍTICAS
          </div>
        )}
      </div>

      <div style={{ display:"flex", flexWrap:"wrap", gap:20, marginBottom:32 }}>
        {lineOrder.filter(l => l !== "SHARED" && byLine[l]?.length).map(lineKey => (
          <LineOverviewCard key={lineKey} lineKey={lineKey} assets={byLine[lineKey] ?? []} lineMeta={lineMeta} onClick={setActiveLine}/>
        ))}
      </div>

      {byLine["SHARED"]?.length > 0 && (
        <div>
          <div style={{ fontSize:10, fontFamily:"monospace", color:"#334155", letterSpacing:".12em", marginBottom:14 }}>
            INFRAESTRUCTURA COMPARTIDA
          </div>
          <div
            onClick={() => setActiveLine("SHARED")}
            style={{ display:"flex", gap:20, flexWrap:"wrap", background:"rgba(255,255,255,.015)", border:"1px solid rgba(245,158,11,.2)", borderRadius:10, padding:"16px 20px", cursor:"pointer", transition:"all .2s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor="#f59e0b"}
            onMouseLeave={e => e.currentTarget.style.borderColor="rgba(245,158,11,.2)"}
          >
            {byLine["SHARED"].map(asset => (
              <EquipmentCard key={asset.id} asset={asset} size={68} selected={selectedAsset?.id === asset.id} onClick={handleAssetClick}/>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}`}</style>
    </div>
  );
}