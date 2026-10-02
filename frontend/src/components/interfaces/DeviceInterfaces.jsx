/**
 * DeviceInterfaces.jsx
 * Interfaces específicas: Sensor, Motor/Drive/Valve, Switch/Firewall/eWON,
 * SCADA/MES/Historian, Workstation/Genérico.
 *
 * Cada interfaz LEE el proceso individual del activo desde el backend
 * (GET /api/equipment/{id}) y sus botones MUTAN ese proceso
 * (POST /api/equipment/action). Si el inventario aún no se cargó al backend,
 * cae a una simulación local para no quedar en blanco.
 */

import { useState, useEffect, useRef } from "react";
import { equipmentAction, fetchAssetState, fetchPlant, plcDownloadProgram, plcRunProgram, protoPort, SAFE_PLC_PROGRAM } from "../../utils/otActions";

const C = { bg:"#05080f", bg2:"#08101a", bg3:"#0d1520", border:"#1e293b", text:"#e2e8f0", dim:"#4b5563", mono:"'Consolas','Courier New',monospace" };
const statusColor = s => ({ ONLINE:"#22c55e", OFFLINE:"#4b5563", WARNING:"#f59e0b", COMPROMISED:"#ef4444" })[s?.toUpperCase()] ?? "#22c55e";

/* Poll del estado vivo del activo en el backend (null si no está cargado). */
function useAssetState(asset) {
  const [data, setData] = useState(null);
  const [backendUp, setBackendUp] = useState(true);
  useEffect(() => {
    let timer, cancelled = false;
    const poll = async () => {
      try { const d = await fetchAssetState(asset.id); if (!cancelled) { setData(d); setBackendUp(true); } }
      catch { if (!cancelled) setBackendUp(false); }
      timer = setTimeout(poll, 1000);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [asset.id]);
  return { data, backendUp };
}

/* Dispara acciones con feedback. */
function useAction(asset) {
  const [msg, setMsg] = useState(null);
  const fire = async (action, extra = {}) => {
    try {
      await equipmentAction({ assetId: asset.id, assetType: asset.type, action, ...extra });
      setMsg({ ok: true, text: `${action} ✓` });
    } catch { setMsg({ ok: false, text: "Sin backend" }); }
    setTimeout(() => setMsg(null), 2200);
  };
  return { fire, msg };
}

/* ── Shared sub-components ────────────────────────────────────────── */
function InfoCard({ label, value, color="#22d3ee", mono=true }) {
  return (
    <div style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:6, padding:"10px 14px" }}>
      <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".08em", marginBottom:4 }}>{label}</div>
      <div style={{ color, fontSize:13, fontFamily: mono ? C.mono : "inherit", fontWeight:600 }}>{value}</div>
    </div>
  );
}

function BackBtn({ onBack }) {
  return (
    <button onClick={onBack} style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"4px 12px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono }}>
      ← VOLVER
    </button>
  );
}

function TopBar({ asset, onBack, accent="#22d3ee", msg, live, children }) {
  const st = statusColor(asset.status);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 20px", background:C.bg2, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
      <BackBtn onBack={onBack}/>
      <div style={{ display:"flex", alignItems:"center", gap:8, background:C.bg3, border:`1px solid ${accent}33`, borderRadius:6, padding:"5px 12px" }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:st, boxShadow:`0 0 6px ${st}` }}/>
        <div>
          <div style={{ color:accent, fontSize:11, fontFamily:C.mono, fontWeight:700 }}>{asset.id}</div>
          <div style={{ color:C.dim, fontSize:9 }}>{asset.type} — {asset.vendor}</div>
        </div>
      </div>
      <div style={{ color: live ? "#22c55e" : C.dim, fontSize:8, fontFamily:C.mono, border:`1px solid ${(live?"#22c55e":C.border)}`, borderRadius:4, padding:"2px 7px" }}>
        {live ? "● BACKEND" : "○ LOCAL"}
      </div>
      {msg && (
        <div style={{ color: msg.ok ? "#22c55e" : "#ef4444", fontSize:10, fontFamily:C.mono, border:`1px solid ${(msg.ok ? "#22c55e" : "#ef4444")}44`, borderRadius:4, padding:"2px 8px" }}>{msg.text}</div>
      )}
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SENSOR
═══════════════════════════════════════════════════════════════════ */
export function SensorInterface({ asset, labData, onBack }) {
  const { fire, msg } = useAction(asset);
  const { data } = useAssetState(asset);
  const liveState = data?.category === "sensor" ? data.state : null;

  const [value,  setValue]  = useState(null);
  const [unit,   setUnit]   = useState("°C");
  const [min,    setMin]    = useState(0);
  const [max,    setMax]    = useState(150);
  const [spHigh, setSpHigh] = useState(80);
  const [spLow,  setSpLow]  = useState(20);
  const [forceVal, setForceVal] = useState("");
  const tickRef = useRef(null);

  useEffect(() => {
    const t = (asset.type||"").toLowerCase();
    if (t.includes("pres")) { setUnit("bar"); setMax(10); setSpHigh(4.5); setSpLow(1.0); setValue(3.82); }
    else if (t.includes("flow")) { setUnit("L/min"); setMax(500); setSpHigh(400); setValue(280); }
    else { setUnit("°C"); setValue(68.4); }
    const assetVars = labData?.variables?.filter(v => v.assetId === asset.id) ?? [];
    if (assetVars.length > 0) {
      const v = assetVars[0];
      setValue(parseFloat(v.initialValue) || 68.4);
      if (v.max) setMax(parseFloat(v.max));
      if (v.min) setMin(parseFloat(v.min));
      if (v.unit) setUnit(v.unit);
    }
  }, [asset.id]);

  useEffect(() => {
    if (liveState) return;
    tickRef.current = setInterval(() => {
      setValue(prev => Math.max(min, Math.min(max, (prev ?? 68.4) + (Math.random()-0.5)*0.8)));
    }, 800);
    return () => clearInterval(tickRef.current);
  }, [liveState, min, max]);

  const shownValue = liveState ? liveState.value : value;
  const shownUnit  = liveState?.unit || unit;
  const shownMin   = liveState?.min ?? min;
  const shownMax   = liveState?.max ?? max;
  const forced = liveState?.forced, fault = liveState?.fault;
  const alarmHigh = shownValue > spHigh, alarmLow = shownValue < spLow;
  const alarm = alarmHigh || alarmLow || fault;
  const pct = shownValue != null ? Math.max(0, Math.min(100, ((shownValue-shownMin)/(shownMax-shownMin))*100)) : 50;
  const barColor = fault ? "#ef4444" : alarmHigh ? "#ef4444" : alarmLow ? "#3b82f6" : "#22c55e";

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:C.bg }}>
      <TopBar asset={asset} onBack={onBack} accent="#22c55e" msg={msg} live={!!liveState}/>
      <div style={{ flex:1, overflow:"auto", padding:16, display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ textAlign:"center", padding:"24px 0", background:C.bg2, borderRadius:10, border:`1px solid ${alarm ? "#ef4444" : C.border}`, position:"relative" }}>
          {forced && <div style={{ position:"absolute", top:8, left:12, color:"#f59e0b", fontSize:9, fontFamily:C.mono, fontWeight:700 }}>⚠ FORZADO</div>}
          {alarm && <div style={{ position:"absolute", top:8, right:12, color:"#ef4444", fontSize:10, fontFamily:C.mono, fontWeight:700, animation:"blink 1s infinite" }}>⚠ {fault ? "FALLA" : "ALARMA"}</div>}
          <div style={{ fontSize:9, color:C.dim, fontFamily:C.mono, letterSpacing:".15em", marginBottom:8 }}>VALOR ACTUAL</div>
          <div style={{ fontSize:52, fontWeight:900, fontFamily:C.mono, color:barColor, lineHeight:1 }}>{shownValue?.toFixed?.(2) ?? "—"}</div>
          <div style={{ fontSize:16, color:C.dim, fontFamily:C.mono, marginTop:4 }}>{shownUnit}</div>
          <div style={{ margin:"16px 24px 0", height:12, background:C.bg3, borderRadius:6, overflow:"hidden" }}>
            <div style={{ width:`${pct}%`, height:"100%", background:barColor, borderRadius:6, transition:"width .5s" }}/>
          </div>
        </div>

        <div style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:6, padding:"12px 14px" }}>
          <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em", marginBottom:8 }}>ACCIONES — impacto real en el proceso</div>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <input value={forceVal} onChange={e=>setForceVal(e.target.value)} placeholder="valor"
              style={{ background:C.bg2, border:`1px solid ${C.border}`, color:C.text, padding:"6px 10px", borderRadius:5, fontSize:11, fontFamily:C.mono, width:90, outline:"none" }}/>
            <button onClick={() => fire("FORCE", { value: Number(forceVal) })} disabled={forceVal===""}
              style={{ background:"rgba(245,158,11,.14)", border:"1px solid #f59e0b", color:"#f59e0b", padding:"6px 14px", borderRadius:5, cursor: forceVal===""?"not-allowed":"pointer", fontSize:10, fontFamily:C.mono, fontWeight:700 }}>FORZAR VALOR</button>
            <button onClick={() => fire("FAULT")}
              style={{ background:"rgba(239,68,68,.14)", border:"1px solid #ef4444", color:"#ef4444", padding:"6px 14px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono, fontWeight:700 }}>SIMULAR FALLA</button>
            <button onClick={() => fire("CLEAR")}
              style={{ background:"rgba(34,197,94,.12)", border:"1px solid #22c55e", color:"#22c55e", padding:"6px 14px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono, fontWeight:700 }}>LIBERAR</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DRIVE / MOTOR / PUMP / VALVE
═══════════════════════════════════════════════════════════════════ */
export function DriveInterface({ asset, labData, onBack }) {
  const { fire, msg } = useAction(asset);
  const { data } = useAssetState(asset);
  const cat = data?.category;
  const liveState = (cat === "motor" || cat === "pump" || cat === "valve") ? data.state : null;

  const isValve = (asset.type||"").toLowerCase().includes("valve") || cat === "valve";
  const [running, setRunning] = useState(true);
  const [speed,   setSpeed]   = useState(isValve ? 50 : 1450);
  const [setpt,   setSetpt]   = useState(isValve ? 50 : 1450);
  const [mode,    setMode]    = useState("AUTO");
  const label = isValve ? "%" : (cat === "pump" ? "L/min" : "RPM");
  const maxVal = isValve ? 100 : (cat === "pump" ? 500 : 1800);

  useEffect(() => {
    if (liveState) return;
    const iv = setInterval(() => {
      if (!running) return;
      setSpeed(p => Math.max(0, Math.min(maxVal, p + (Math.random()-0.5)*(isValve?0.5:15))));
    }, 600);
    return () => clearInterval(iv);
  }, [running, liveState, isValve, maxVal]);

  const liveField = liveState ? (isValve ? liveState.position : (cat==="pump" ? liveState.flow : liveState.speed)) : null;
  const shownSpeed = liveState ? Math.round(liveField ?? 0) : Math.round(speed);
  const shownRunning = liveState ? (isValve ? (liveState.position > 0) : liveState.running) : running;
  const speedPct = (shownSpeed / maxVal) * 100;
  const accent = isValve ? "#22c55e" : "#22d3ee";
  const current = liveState?.current, torque = liveState?.torque, temp = liveState?.temp;

  const start = () => { setRunning(true);  fire(isValve ? "OPEN" : "START"); };
  const stop  = () => { setRunning(false); fire(isValve ? "CLOSE" : "STOP"); };
  const applySetpoint = () => { setSpeed(setpt); fire(isValve ? "POSITION" : "SPEED", { value: Number(setpt) }); };

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:C.bg }}>
      <TopBar asset={asset} onBack={onBack} accent={accent} msg={msg} live={!!liveState}>
        <div style={{ color: shownRunning ? "#22c55e" : "#ef4444", fontFamily:C.mono, fontSize:10, fontWeight:700 }}>
          {shownRunning ? "▶ EN MARCHA" : "■ PARADO"}
        </div>
        <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>{mode}</div>
      </TopBar>

      <div style={{ flex:1, overflow:"auto", padding:16, display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ textAlign:"center", background:C.bg2, borderRadius:10, border:`1px solid ${C.border}`, padding:"20px 0" }}>
          <div style={{ fontSize:9, color:C.dim, fontFamily:C.mono, letterSpacing:".15em", marginBottom:4 }}>{isValve ? "APERTURA" : "VELOCIDAD"}</div>
          <div style={{ fontSize:52, fontWeight:900, fontFamily:C.mono, color: shownRunning ? accent : C.dim, lineHeight:1 }}>{shownSpeed}</div>
          <div style={{ fontSize:14, color:C.dim, fontFamily:C.mono }}>{label}</div>
          <div style={{ margin:"12px 24px 0", height:10, background:C.bg3, borderRadius:5 }}>
            <div style={{ width:`${speedPct}%`, height:"100%", background:accent, borderRadius:5, transition:"width .4s" }}/>
          </div>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={start} disabled={shownRunning}
            style={{ flex:1, background: shownRunning ? `rgba(34,197,94,.05)` : `rgba(34,197,94,.15)`, border:`1px solid ${shownRunning?"#1e293b":"#22c55e"}`, color: shownRunning?C.dim:"#22c55e", padding:"10px", borderRadius:6, cursor: shownRunning?"not-allowed":"pointer", fontFamily:C.mono, fontSize:11, fontWeight:700 }}>
            {isValve ? "▲ ABRIR" : "▶ MARCHA"}
          </button>
          <button onClick={stop} disabled={!shownRunning}
            style={{ flex:1, background: !shownRunning ? `rgba(239,68,68,.05)` : `rgba(239,68,68,.15)`, border:`1px solid ${!shownRunning?"#1e293b":"#ef4444"}`, color: !shownRunning?C.dim:"#ef4444", padding:"10px", borderRadius:6, cursor: !shownRunning?"not-allowed":"pointer", fontFamily:C.mono, fontSize:11, fontWeight:700 }}>
            {isValve ? "▼ CERRAR" : "■ PARO"}
          </button>
        </div>

        <div style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:6, padding:"12px 14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>SETPOINT</span>
            <span style={{ color:accent, fontSize:12, fontFamily:C.mono, fontWeight:700 }}>{setpt} {label}</span>
          </div>
          <input type="range" min={0} max={maxVal} step={isValve?1:50} value={setpt}
            onChange={e => setSetpt(Number(e.target.value))} style={{ width:"100%", accentColor:accent }}/>
          <button onClick={applySetpoint}
            style={{ marginTop:10, width:"100%", background:`${accent}18`, border:`1px solid ${accent}`, color:accent, padding:"8px", borderRadius:5, cursor:"pointer", fontFamily:C.mono, fontSize:10, fontWeight:700 }}>
            APLICAR SETPOINT
          </button>
        </div>

        {(current != null) && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            <InfoCard label="Corriente"   value={`${current.toFixed(1)} A`} color="#f59e0b"/>
            <InfoCard label="Torque"      value={`${(torque??0).toFixed(0)} %`} color="#818cf8"/>
            <InfoCard label="Temperatura" value={`${(temp??0).toFixed(1)} °C`} color={(temp??0)>75?"#ef4444":"#22c55e"}/>
          </div>
        )}

        <div style={{ display:"flex", gap:8 }}>
          {["AUTO","MANUAL","LOCAL"].map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex:1, background: mode===m ? `${accent}18` : "transparent", border:`1px solid ${mode===m?accent:C.border}`, color:mode===m?accent:C.dim, padding:"6px", borderRadius:5, cursor:"pointer", fontFamily:C.mono, fontSize:9, fontWeight:700, letterSpacing:".06em" }}>
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   NETWORK — Switch / Firewall / eWON / mGuard
═══════════════════════════════════════════════════════════════════ */
export function NetworkInterface({ asset, labData, onBack }) {
  const { fire, msg } = useAction(asset);
  const { data } = useAssetState(asset);
  const liveState = ["switch","firewall","gateway"].includes(data?.category) ? data.state : null;

  const isFirewall = (asset.type||"").toLowerCase().includes("firewall") || (asset.type||"").toLowerCase().includes("mguard") || data?.category === "firewall";
  const isEWON = (asset.type||"").toLowerCase().includes("ewon") || (asset.type||"").toLowerCase().includes("gateway") || data?.category === "gateway";
  const accent = isFirewall ? "#ef4444" : isEWON ? "#f59e0b" : "#3b82f6";

  const [tab, setTab] = useState(isEWON ? "remote" : "ports");
  const [traffic, setTraffic] = useState([]);
  const [rules, setRules] = useState([
    { id:1, src:"OT-FIELD", dst:"OT-HMI",   proto:"S7comm", port:"102",  action:"PERMIT", enabled:true  },
    { id:2, src:"OT-HMI",   dst:"OT-SCADA", proto:"OPC-UA", port:"4840", action:"PERMIT", enabled:true  },
    { id:3, src:"ENG",      dst:"OT-FIELD", proto:"S7comm", port:"102",  action:"PERMIT", enabled:true  },
    { id:4, src:"EXTERNAL", dst:"OT-FIELD", proto:"ANY",    port:"ANY",  action:"DENY",   enabled:true  },
    { id:5, src:"ANY",      dst:"ANY",      proto:"ICMP",   port:"—",    action:"PERMIT", enabled:false },
  ]);
  const [ports] = useState(() =>
    Array.from({length:8}, (_,i) => ({ id:i+1, status: Math.random()>0.3?"UP":"DOWN",
      speed:["100M","1G","1G","100M","1G","100M","1G","1G"][i], vlan:[440,440,902,904,441,905,442,901][i],
      rx:Math.floor(Math.random()*1000), tx:Math.floor(Math.random()*800) })));

  useEffect(() => {
    const iv = setInterval(() => {
      setTraffic(prev => [...prev.slice(-19), { ts:new Date().toLocaleTimeString(),
        src:["172.16.100.10","172.16.102.10","172.16.104.10"][Math.floor(Math.random()*3)],
        dst:["172.16.102.10","172.16.104.10","172.16.100.20"][Math.floor(Math.random()*3)],
        proto:["S7comm","OPC-UA","PROFINET","HTTP"][Math.floor(Math.random()*4)],
        bytes:Math.floor(Math.random()*2048), action:"PERMIT" }]);
    }, 1200);
    return () => clearInterval(iv);
  }, []);

  const toggleRule = (r) => {
    setRules(prev => prev.map(x => x.id===r.id ? {...x, enabled:!x.enabled} : x));
    const nowEnabled = !r.enabled;
    const act = (r.action === "DENY") ? (nowEnabled ? "DENY" : "PERMIT") : (nowEnabled ? "PERMIT" : "DENY");
    fire(act, { protocol: r.proto, targetId: r.dst });
  };

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:C.bg }}>
      <TopBar asset={asset} onBack={onBack} accent={accent} msg={msg} live={!!liveState}/>
      <div style={{ display:"flex", background:C.bg2, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        {(isEWON ? ["remote","rules","traffic","info"] : isFirewall ? ["ports","rules","traffic","info"] : ["ports","vlans","traffic","info"]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background:tab===t?C.bg3:"transparent", border:"none", borderBottom:tab===t?`2px solid ${accent}`:"2px solid transparent", color:tab===t?accent:C.dim, padding:"8px 14px", cursor:"pointer", fontFamily:C.mono, fontSize:9, fontWeight:700, letterSpacing:".08em" }}>{t.toUpperCase()}</button>
        ))}
      </div>

      <div style={{ flex:1, overflow:"auto", padding:14 }}>
        {tab === "remote" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em" }}>ACCESO REMOTO — eWON / Gateway</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <InfoCard label="Túnel VPN" value={liveState ? (liveState.tunnel ? "ARRIBA" : "ABAJO") : "—"} color={liveState?.tunnel ? "#f59e0b" : "#22c55e"}/>
              <InfoCard label="Sesiones remotas" value={liveState ? String(liveState.remote_sessions) : "—"} color={(liveState?.remote_sessions||0) > 0 ? "#f59e0b" : "#22c55e"}/>
              <InfoCard label="Exposición Internet" value={liveState ? (liveState.internet_exposed ? "EXPUESTO" : "AISLADO") : "—"} color={liveState?.internet_exposed ? "#ef4444" : "#22c55e"}/>
              <InfoCard label="Nube del fabricante" value={liveState?.vendor_cloud || "—"} color="#818cf8"/>
            </div>
            {liveState?.compromised && (
              <div style={{ background:"rgba(239,68,68,.1)", border:"1px solid #ef4444", borderRadius:6, padding:"8px 12px", color:"#ef4444", fontFamily:C.mono, fontSize:10, fontWeight:700 }}>
                ⚠ ACCESO REMOTO COMPROMETIDO
              </div>
            )}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button onClick={() => fire(liveState?.tunnel ? "DISCONNECT" : "CONNECT")}
                style={{ background:`${accent}18`, border:`1px solid ${accent}`, color:accent, padding:"8px 14px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono, fontWeight:700 }}>
                {liveState?.tunnel ? "CERRAR TÚNEL" : "ESTABLECER TÚNEL"}
              </button>
              <button onClick={() => fire("REMOTE_START")}
                style={{ background:"rgba(245,158,11,.14)", border:"1px solid #f59e0b", color:"#f59e0b", padding:"8px 14px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono, fontWeight:700 }}>
                INICIAR SESIÓN REMOTA
              </button>
              <button onClick={() => fire("REMOTE_END")}
                style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"8px 14px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono, fontWeight:700 }}>
                CERRAR SESIÓN
              </button>
              <button onClick={() => fire(liveState?.internet_exposed ? "ISOLATE" : "EXPOSE")}
                style={{ background: liveState?.internet_exposed ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)", border:`1px solid ${liveState?.internet_exposed ? "#22c55e" : "#ef4444"}`, color: liveState?.internet_exposed ? "#22c55e" : "#ef4444", padding:"8px 14px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono, fontWeight:700 }}>
                {liveState?.internet_exposed ? "AISLAR DE INTERNET" : "EXPONER A INTERNET"}
              </button>
            </div>
            <div style={{ color:C.dim, fontSize:8, fontFamily:C.mono }}>
              Un túnel activo con exposición a Internet y sesión remota marca el equipo en naranja (superficie de ataque); el compromiso lo marca en rojo.
            </div>
          </div>
        )}

        {tab === "ports" && (
          <div>
            <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em", marginBottom:10 }}>
              PUERTOS — {ports.filter(p=>p.status==="UP").length}/{ports.length} activos
              {liveState && <span style={{ color:"#f97316", marginLeft:10 }}>· reglas DENY: {liveState.rules_denied}</span>}
            </div>
            {ports.map(p => (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, background:C.bg3, border:`1px solid ${C.border}`, borderRadius:5, padding:"8px 12px", marginBottom:6 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:p.status==="UP"?"#22c55e":"#4b5563", boxShadow:p.status==="UP"?"0 0 5px #22c55e":"none" }}/>
                <span style={{ color:C.text, fontFamily:C.mono, fontSize:10, fontWeight:700, minWidth:24 }}>P{p.id}</span>
                <span style={{ color:p.status==="UP"?"#22c55e":"#4b5563", fontFamily:C.mono, fontSize:9, minWidth:32 }}>{p.status}</span>
                <span style={{ color:C.dim, fontFamily:C.mono, fontSize:9, minWidth:36 }}>{p.speed}</span>
                <span style={{ color:"#818cf8", fontFamily:C.mono, fontSize:9, minWidth:54 }}>VLAN {p.vlan}</span>
                <div style={{ flex:1 }}/>
                <span style={{ color:"#22c55e", fontSize:8, fontFamily:C.mono }}>↓ {p.rx} KB</span>
                <span style={{ color:"#f59e0b", fontSize:8, fontFamily:C.mono }}>↑ {p.tx} KB</span>
              </div>
            ))}
          </div>
        )}

        {tab === "rules" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", marginBottom:10 }}>
              <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em" }}>
                REGLAS DE SEGURIDAD — {rules.filter(r=>r.enabled).length} activas
              </span>
              <div style={{ flex:1 }}/>
              {isFirewall && (
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ color: liveState?.mode==="BYPASS" ? "#f59e0b" : "#22c55e", fontFamily:C.mono, fontSize:9, fontWeight:700 }}>
                    MODO: {liveState?.mode || "ENFORCING"}
                  </span>
                  <button onClick={() => fire(liveState?.mode==="BYPASS" ? "ENFORCE" : "BYPASS")}
                    style={{ background:"none", border:`1px solid ${liveState?.mode==="BYPASS" ? "#22c55e" : "#f59e0b"}`, color: liveState?.mode==="BYPASS" ? "#22c55e" : "#f59e0b", padding:"3px 10px", borderRadius:4, cursor:"pointer", fontSize:9, fontFamily:C.mono, fontWeight:700 }}>
                    {liveState?.mode==="BYPASS" ? "ACTIVAR INSPECCIÓN" : "PONER EN BYPASS"}
                  </button>
                </div>
              )}
            </div>
            {rules.map(r => (
              <div key={r.id} style={{ display:"flex", alignItems:"center", gap:8, background:C.bg3, border:`1px solid ${C.border}`, borderRadius:5, padding:"8px 10px", marginBottom:5, opacity:r.enabled?1:0.4 }}>
                <span style={{ color:C.dim, fontFamily:C.mono, fontSize:9, minWidth:18 }}>#{r.id}</span>
                <span style={{ color:"#22d3ee", fontFamily:C.mono, fontSize:9, minWidth:80 }}>{r.src}</span>
                <span style={{ color:C.dim, fontSize:9 }}>→</span>
                <span style={{ color:"#818cf8", fontFamily:C.mono, fontSize:9, minWidth:80 }}>{r.dst}</span>
                <span style={{ color:"#f59e0b", fontFamily:C.mono, fontSize:9, minWidth:60 }}>{r.proto}</span>
                <span style={{ color:C.dim, fontFamily:C.mono, fontSize:9, minWidth:40 }}>{r.port}</span>
                <div style={{ flex:1 }}/>
                <span style={{ color:r.action==="PERMIT"?"#22c55e":"#ef4444", fontFamily:C.mono, fontSize:9, fontWeight:700, minWidth:50 }}>{r.action}</span>
                <button onClick={() => toggleRule(r)}
                  style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"2px 6px", borderRadius:3, cursor:"pointer", fontSize:8, fontFamily:C.mono }}>
                  {r.enabled?"DESACTIVAR":"ACTIVAR"}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "vlans" && (
          <div>
            <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em", marginBottom:10 }}>VLANS CONFIGURADAS</div>
            {[440,902,904,441,905,442,901].map(v => (
              <div key={v} style={{ display:"flex", alignItems:"center", gap:12, background:C.bg3, border:`1px solid ${C.border}`, borderRadius:5, padding:"8px 12px", marginBottom:5 }}>
                <div style={{ background:`${accent}18`, border:`1px solid ${accent}44`, color:accent, padding:"2px 8px", borderRadius:3, fontFamily:C.mono, fontSize:9, fontWeight:700 }}>VLAN {v}</div>
                <span style={{ color:C.text, fontFamily:C.mono, fontSize:9 }}>
                  {({440:"OT-FIELD-L01",902:"OT-HMI-L01",904:"OT-SCADA-L01",441:"OT-FIELD-L02",905:"OT-SCADA-L02",442:"OT-FIELD-L03",901:"ENG"})[v]}
                </span>
                <div style={{ flex:1 }}/>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#22c55e" }}/>
                <span style={{ color:"#22c55e", fontSize:8, fontFamily:C.mono }}>ACTIVA</span>
              </div>
            ))}
          </div>
        )}

        {tab === "traffic" && (
          <div>
            <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em", marginBottom:10 }}>TRÁFICO EN TIEMPO REAL</div>
            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
              {traffic.slice().reverse().map((t,i) => (
                <div key={i} style={{ display:"flex", gap:8, alignItems:"center", background:C.bg3, border:`1px solid ${C.border}22`, borderRadius:4, padding:"5px 10px", fontSize:8, fontFamily:C.mono }}>
                  <span style={{ color:C.dim, minWidth:68 }}>{t.ts}</span>
                  <span style={{ color:"#22d3ee", minWidth:100 }}>{t.src}</span>
                  <span style={{ color:C.dim }}>→</span>
                  <span style={{ color:"#818cf8", minWidth:100 }}>{t.dst}</span>
                  <span style={{ color:"#f59e0b", minWidth:60 }}>{t.proto}</span>
                  <span style={{ color:C.dim, minWidth:54 }}>{t.bytes} B</span>
                  <span style={{ color:"#22c55e" }}>✓ {t.action}</span>
                </div>
              ))}
              {traffic.length === 0 && <div style={{ color:C.dim, fontSize:10, fontFamily:C.mono }}>Esperando tráfico...</div>}
            </div>
          </div>
        )}

        {tab === "info" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[["ID",asset.id],["Tipo",asset.type],["Vendor",asset.vendor],["Modelo",asset.model||"—"],["IP",asset.ip||"—"],["MAC",asset.mac||"—"],["VLAN",asset.vlan||"—"],["Protocolos",(asset.protocols||[]).join(", ")||"—"],["Firmware",asset.firmware||"—"],["Estado",asset.status||"—"]].map(([l,v]) => <InfoCard key={l} label={l} value={v}/>)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SCADA / MES / HISTORIAN
═══════════════════════════════════════════════════════════════════ */
export function ServerInterface({ asset, labData, onBack }) {
  const { fire, msg } = useAction(asset);
  const { data } = useAssetState(asset);
  const liveState = ["scada","historian","mes","server"].includes(data?.category) ? data.state : null;

  const [tab, setTab] = useState("overview");
  const [cpuL, setCpuL] = useState(18);
  const [memL, setMemL] = useState(42);
  const isMES = (asset.type||"").toLowerCase().includes("mes");
  const isHist = (asset.type||"").toLowerCase().includes("hist");
  const accent = isMES ? "#f59e0b" : isHist ? "#818cf8" : "#3b82f6";

  useEffect(() => {
    if (liveState) return;
    const iv = setInterval(() => {
      setCpuL(p => Math.max(5, Math.min(90, p + (Math.random()-.5)*5)));
      setMemL(p => Math.max(20, Math.min(90, p + (Math.random()-.5)*2)));
    }, 2000);
    return () => clearInterval(iv);
  }, [liveState]);

  const cpu = liveState ? liveState.cpu : cpuL;
  const mem = liveState ? liveState.mem : memL;

  const services = isMES
    ? [["MES Core","ONLINE"],["OEE Engine","ONLINE"],["Scheduler","ONLINE"],["DB Service","ONLINE"],["API Server","ONLINE"]]
    : isHist
    ? [["HistSrv","ONLINE"],["CompressDB","ONLINE"],["Retrieval","ONLINE"],["Export","ONLINE"],["Backup","WARNING"]]
    : [["WinCC Runtime","ONLINE"],["OPC-UA Server","ONLINE"],["Alarm Srv","ONLINE"],["Trend Srv","ONLINE"],["Web Client","OFFLINE"]];

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:C.bg }}>
      <TopBar asset={asset} onBack={onBack} accent={accent} msg={msg} live={!!liveState}/>
      <div style={{ display:"flex", background:C.bg2, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        {["overview","services","connections","info"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background:tab===t?C.bg3:"transparent", border:"none", borderBottom:tab===t?`2px solid ${accent}`:"2px solid transparent", color:tab===t?accent:C.dim, padding:"8px 14px", cursor:"pointer", fontFamily:C.mono, fontSize:9, fontWeight:700, letterSpacing:".08em" }}>{t.toUpperCase()}</button>
        ))}
      </div>

      <div style={{ flex:1, overflow:"auto", padding:14 }}>
        {tab === "overview" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              <InfoCard label="CPU" value={`${cpu.toFixed(0)}%`} color={cpu>80?"#ef4444":cpu>60?"#f59e0b":"#22c55e"}/>
              <InfoCard label="RAM" value={`${mem.toFixed(0)}%`} color={mem>80?"#ef4444":"#22c55e"}/>
              <InfoCard label="Estado" value={liveState ? (liveState.online?"ONLINE":"OFFLINE") : (asset.status||"ONLINE")} color={liveState && !liveState.online ? "#ef4444" : "#22c55e"}/>
            </div>
            {[{ l:"CPU", v:cpu, c:"#22d3ee" },{ l:"RAM", v:mem, c:"#818cf8" }].map(({ l, v, c }) => (
              <div key={l} style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:6, padding:"8px 12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>{l}</span>
                  <span style={{ color:c, fontFamily:C.mono, fontSize:9 }}>{v.toFixed(0)}%</span>
                </div>
                <div style={{ height:6, background:C.bg2, borderRadius:3 }}>
                  <div style={{ width:`${v}%`, height:"100%", background:c, borderRadius:3, transition:"width .5s" }}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "services" && (
          <div>
            {services.map(([name, st]) => (
              <div key={name} style={{ display:"flex", alignItems:"center", gap:10, background:C.bg3, border:`1px solid ${C.border}`, borderRadius:5, padding:"10px 12px", marginBottom:6 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background: st==="ONLINE"?"#22c55e":st==="WARNING"?"#f59e0b":"#ef4444" }}/>
                <span style={{ color:C.text, fontFamily:C.mono, fontSize:10, flex:1 }}>{name}</span>
                <span style={{ color: st==="ONLINE"?"#22c55e":st==="WARNING"?"#f59e0b":"#ef4444", fontFamily:C.mono, fontSize:9, fontWeight:700 }}>{st}</span>
                <button onClick={() => fire("RESTART", { value: name })}
                  style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"2px 8px", borderRadius:3, cursor:"pointer", fontSize:8, fontFamily:C.mono }}>REINICIAR</button>
              </div>
            ))}
          </div>
        )}

        {tab === "connections" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[["OPC-UA Clients","3/10"],["DB Connections","12/50"],["Activos monit.","30"],["Tags activos","180"],["Alarmas activas","2"],["Uptime","18d 4h"]].map(([l,v]) => (
              <InfoCard key={l} label={l} value={v} color={accent}/>
            ))}
          </div>
        )}

        {tab === "info" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[["ID",asset.id],["Tipo",asset.type],["Vendor",asset.vendor],["Modelo",asset.model||"—"],["IP",asset.ip||"—"],["OS",asset.firmware||"—"],["Aplicación",asset.application||"—"],["Protocolos",(asset.protocols||[]).join(",")||"—"]].map(([l,v]) => (
              <InfoCard key={l} label={l} value={v}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   WORKSTATION / ENGINEERING
═══════════════════════════════════════════════════════════════════ */
export function WorkstationInterface({ asset, labData, onBack }) {
  const { fire, msg } = useAction(asset);
  const [openApp, setOpenApp] = useState(null);   // null | { name, kind }

  const apps = [
    { name:"TIA Portal V19", status:"INSTALLED", icon:"🔧", action:"Abrir proyecto", kind:"program" },
    { name:"STEP 7 V5.7",    status:"INSTALLED", icon:"⚙", action:"Abrir proyecto", kind:"program" },
    { name:"WinCC Explorer", status:"INSTALLED", icon:"🖥", action:"Abrir",          kind:"scada"   },
    { name:"Studio 5000",    status:"INSTALLED", icon:"🏭", action:"Abrir",          kind:"program" },
    { name:"Wireshark 4.x",  status:"INSTALLED", icon:"📡", action:"Capturar",       kind:"capture" },
    { name:"Nmap 7.94",      status:"INSTALLED", icon:"🔍", action:"Escanear",       kind:"scan"    },
    { name:"STEP 7 Safety",  status:"NOT_INSTALLED", icon:"🛡", action:"Instalar",   kind:null      },
  ];

  const openTool = (app) => {
    setOpenApp({ name: app.name, kind: app.kind });
    // registra el lanzamiento en el SIEM (recon marca "scan")
    fire("LAUNCH", { value: app.name });
  };

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:C.bg }}>
      <TopBar asset={asset} onBack={onBack} accent="#f59e0b" msg={msg}>
        {openApp && (
          <button onClick={() => setOpenApp(null)} style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"3px 10px", borderRadius:4, cursor:"pointer", fontSize:9, fontFamily:C.mono }}>
            ✕ CERRAR {openApp.name}
          </button>
        )}
      </TopBar>

      <div style={{ flex:1, overflow:"auto", padding:14 }}>
        {!openApp && (
          <>
            <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em", marginBottom:12 }}>SOFTWARE INSTALADO — {asset.id}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {apps.map(app => (
                <div key={app.name} style={{ display:"flex", alignItems:"center", gap:12, background:C.bg3, border:`1px solid ${C.border}`, borderRadius:6, padding:"10px 14px" }}>
                  <span style={{ fontSize:18 }}>{app.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ color:C.text, fontFamily:C.mono, fontSize:11, fontWeight:600 }}>{app.name}</div>
                    <div style={{ color: app.status==="INSTALLED" ? "#22c55e" : C.dim, fontSize:8, fontFamily:C.mono }}>{app.status}</div>
                  </div>
                  {app.status === "INSTALLED" && (
                    <button onClick={() => openTool(app)}
                      style={{ background:`rgba(245,158,11,.1)`, border:`1px solid rgba(245,158,11,.3)`, color:"#f59e0b", padding:"4px 12px", borderRadius:4, cursor:"pointer", fontSize:9, fontFamily:C.mono }}>
                      {app.action}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop:14, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[["IP",asset.ip||"—"],["OS",asset.firmware||"Windows 11 Pro"],["RAM","32 GB"],["CPU","Intel Xeon"],["Protocolos",(asset.protocols||[]).join(",")||"—"],["VLAN",asset.vlan||"901"]].map(([l,v]) => (
                <InfoCard key={l} label={l} value={v} color="#f59e0b"/>
              ))}
            </div>
          </>
        )}

        {openApp?.kind === "program" && <ProgrammingApp appName={openApp.name} labData={labData}/>}
        {openApp?.kind === "scan"    && <NmapApp appName={openApp.name} asset={asset} labData={labData}/>}
        {openApp?.kind === "capture" && <WiresharkApp labData={labData}/>}
        {openApp?.kind === "scada"   && <WinccApp/>}
      </div>
    </div>
  );
}

/* ── App: Programación de PLC (TIA / STEP 7 / Studio 5000) ── */
function ProgrammingApp({ appName, labData }) {
  const plcs = (labData?.assets || []).filter(a => /plc|controller|rtu|dcs/i.test(a.type || ""));
  const [sel, setSel]   = useState(plcs[0]?.id || "");
  const [online, setOnline] = useState(false);
  const [log, setLog]   = useState([]);
  const [busy, setBusy] = useState(false);
  const selAsset = plcs.find(p => p.id === sel);
  const add = (t) => setLog(l => [...l.slice(-40), `${new Date().toLocaleTimeString()}  ${t}`]);

  const act = async (fn, label) => {
    setBusy(true);
    try { await fn(); add(label); }
    catch (e) { add("⚠ " + (e.message || "error")); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ color:"#f59e0b", fontFamily:C.mono, fontSize:12, fontWeight:700 }}>{appName} — Proyecto OT</div>
      {plcs.length === 0 ? (
        <div style={{ color:C.dim, fontSize:10, fontFamily:C.mono }}>No hay PLCs en la topología importada. Importa el Excel para ver dispositivos.</div>
      ) : (
        <>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>DISPOSITIVO:</span>
            <select value={sel} onChange={e => { setSel(e.target.value); setOnline(false); }}
              style={{ background:C.bg2, border:`1px solid ${C.border}`, color:C.text, padding:"5px 8px", borderRadius:4, fontSize:10, fontFamily:C.mono }}>
              {plcs.map(p => <option key={p.id} value={p.id}>{p.id} — {p.type}</option>)}
            </select>
            <span style={{ color: online ? "#22c55e" : C.dim, fontSize:9, fontFamily:C.mono, border:`1px solid ${online?"#22c55e":C.border}`, borderRadius:4, padding:"2px 8px" }}>
              {online ? "● ONLINE" : "○ OFFLINE"}
            </span>
          </div>

          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button disabled={busy} onClick={() => act(async () => { await equipmentAction({ assetId: sel, assetType: selAsset?.type, action: "RUN" }); setOnline(true); }, `Conectado ONLINE a ${sel}`)}
              style={btn("#22d3ee", busy)}>IR ONLINE</button>
            <button disabled={busy || !online} onClick={() => act(() => equipmentAction({ assetId: sel, assetType: selAsset?.type, action: "STOP" }), `⏹ CPU STOP enviado a ${sel} (cascada a equipos conectados)`)}
              style={btn("#ef4444", busy || !online)}>STOP CPU</button>
            <button disabled={busy || !online} onClick={() => act(() => equipmentAction({ assetId: sel, assetType: selAsset?.type, action: "RUN" }), `▶ CPU RUN enviado a ${sel}`)}
              style={btn("#22c55e", busy || !online)}>RUN CPU</button>
            <button disabled={busy || !online} onClick={() => act(async () => {
                await equipmentAction({ assetId: sel, assetType: selAsset?.type, action: "PROGRAM" });
                const r = await plcDownloadProgram(SAFE_PLC_PROGRAM);
                await plcRunProgram();
                await equipmentAction({ assetId: sel, assetType: selAsset?.type, action: "REMOTE" });
                return r;
              }, `⬇ Programa seguro descargado y en ejecución en ${sel}`)}
              style={btn("#818cf8", busy || !online)}>DESCARGAR PROGRAMA</button>
          </div>
          <div style={{ color:C.dim, fontSize:8, fontFamily:C.mono }}>
            STOP detiene realmente el PLC y los equipos que controla (se pintan rojo/naranja). DESCARGAR carga un programa ST válido que mueve el proceso real.
          </div>

          <div style={{ background:"#02060c", border:`1px solid ${C.border}`, borderRadius:6, padding:"10px 12px", height:150, overflow:"auto", fontFamily:C.mono, fontSize:10 }}>
            {log.length === 0 ? <span style={{ color:C.dim }}>Consola del proyecto…</span> :
              log.map((l,i) => <div key={i} style={{ color:"#9fb4c9" }}>{l}</div>)}
          </div>
        </>
      )}
    </div>
  );
}

/* ── App: Nmap (escaneo sobre la topología real) ── */
function NmapApp({ appName, asset, labData }) {
  const [out, setOut] = useState([]);
  const [scanning, setScanning] = useState(false);

  const scan = () => {
    setScanning(true); setOut([`Starting Nmap 7.94 ( desde ${asset.ip || asset.id} )`]);
    const hosts = (labData?.assets || []).filter(a => a.ip);
    let i = 0;
    const lines = [];
    hosts.forEach(h => {
      const protos = Array.isArray(h.protocols) ? h.protocols : String(h.protocols || "").split(/[;,]/).map(x=>x.trim()).filter(Boolean);
      const ports = protos.map(p => ({ p, port: protoPort(p) })).filter(x => x.port);
      lines.push(`\nNmap scan report for ${h.id} (${h.ip})`);
      lines.push(`Host is up.  ${h.type || ""}`);
      if (ports.length === 0) lines.push(`  (sin puertos OT conocidos)`);
      ports.forEach(({ p, port }) => lines.push(`  ${String(port).padEnd(7)} open   ${p}`));
    });
    lines.push(`\nNmap done: ${hosts.length} IP addresses scanned`);
    // stream con efecto máquina de escribir
    const iv = setInterval(() => {
      if (i >= lines.length) { clearInterval(iv); setScanning(false); return; }
      setOut(o => [...o, lines[i]]); i++;
    }, 90);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ color:"#f59e0b", fontFamily:C.mono, fontSize:12, fontWeight:700 }}>{appName}</div>
        <div style={{ flex:1 }}/>
        <button onClick={scan} disabled={scanning} style={btn("#22c55e", scanning)}>
          {scanning ? "ESCANEANDO…" : "nmap -sV <red OT>"}
        </button>
      </div>
      <div style={{ background:"#02060c", border:`1px solid ${C.border}`, borderRadius:6, padding:"10px 12px", height:300, overflow:"auto", fontFamily:C.mono, fontSize:10, whiteSpace:"pre-wrap", color:"#9fe6b0" }}>
        {out.length === 0 ? <span style={{ color:C.dim }}>Pulsa escanear para enumerar la planta importada…</span> : out.join("\n")}
      </div>
    </div>
  );
}

/* ── App: Wireshark (captura sobre las conexiones reales) ── */
function WiresharkApp({ labData }) {
  const [pkts, setPkts] = useState([]);
  const [running, setRunning] = useState(false);
  const ivRef = useRef(null);
  const conns = labData?.connections || [];
  const ipOf = (id) => (labData?.assets || []).find(a => a.id === id)?.ip || id;

  useEffect(() => {
    if (!running) { clearInterval(ivRef.current); return; }
    ivRef.current = setInterval(() => {
      if (conns.length === 0) return;
      const c = conns[Math.floor(Math.random() * conns.length)];
      const proto = (c.protocol || "TCP").split(/[;,]/)[0].trim();
      setPkts(p => [...p.slice(-120), {
        t: (performance.now()/1000).toFixed(3),
        src: ipOf(c.sourceId), dst: ipOf(c.targetId),
        proto, port: protoPort(proto) || "—", len: 60 + Math.floor(Math.random()*200),
      }]);
    }, 350);
    return () => clearInterval(ivRef.current);
  }, [running]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ color:"#f59e0b", fontFamily:C.mono, fontSize:12, fontWeight:700 }}>Wireshark 4.x</div>
        <div style={{ flex:1 }}/>
        <button onClick={() => setRunning(r => !r)} style={btn(running ? "#ef4444" : "#22c55e", false)}>
          {running ? "■ DETENER" : "● CAPTURAR"}
        </button>
        <button onClick={() => setPkts([])} style={btn("#4b5563", false)}>LIMPIAR</button>
      </div>
      <div style={{ background:"#02060c", border:`1px solid ${C.border}`, borderRadius:6, padding:"6px 8px", height:300, overflow:"auto", fontFamily:C.mono, fontSize:9 }}>
        <div style={{ display:"flex", gap:8, color:C.dim, borderBottom:`1px solid ${C.border}`, paddingBottom:3, marginBottom:3 }}>
          <span style={{ minWidth:70 }}>Time</span><span style={{ minWidth:110 }}>Source</span><span style={{ minWidth:110 }}>Destination</span><span style={{ minWidth:60 }}>Proto</span><span style={{ minWidth:46 }}>Port</span><span>Len</span>
        </div>
        {pkts.length === 0 ? <span style={{ color:C.dim }}>Sin paquetes. Pulsa CAPTURAR.</span> :
          pkts.slice().reverse().map((p,i) => (
            <div key={i} style={{ display:"flex", gap:8 }}>
              <span style={{ color:C.dim, minWidth:70 }}>{p.t}</span>
              <span style={{ color:"#22d3ee", minWidth:110 }}>{p.src}</span>
              <span style={{ color:"#818cf8", minWidth:110 }}>{p.dst}</span>
              <span style={{ color:"#f59e0b", minWidth:60 }}>{p.proto}</span>
              <span style={{ color:C.dim, minWidth:46 }}>{p.port}</span>
              <span style={{ color:"#9fb4c9" }}>{p.len}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ── App: WinCC (tags en vivo del proceso) ── */
function WinccApp() {
  const [proc, setProc] = useState(null);
  useEffect(() => {
    let t, cancel=false;
    const poll = async () => {
      try { const d = await fetchPlant(); if(!cancel) setProc(d.process); } catch {}
      t = setTimeout(poll, 1000);
    };
    poll();
    return () => { cancel=true; clearTimeout(t); };
  }, []);
  const tags = [
    ["TEMPERATURE", proc?.temperature, "°C"], ["PRESSURE", proc?.pressure, "bar"],
    ["MOTOR_SPEED", proc?.motor_speed, "RPM"], ["VALVE_POSITION", proc?.valve_position, "%"],
    ["PRODUCTION_RATE", proc?.production_rate, "%"],
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ color:"#f59e0b", fontFamily:C.mono, fontSize:12, fontWeight:700 }}>WinCC Explorer — Tag Browser</div>
      <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:C.mono, fontSize:11 }}>
        <thead><tr style={{ color:C.dim }}>{["Tag","Valor","Unidad","Calidad"].map(h => <th key={h} style={{ textAlign:"left", padding:"6px 10px", borderBottom:`1px solid ${C.border}`, fontSize:9 }}>{h}</th>)}</tr></thead>
        <tbody>
          {tags.map(([t,v,u]) => (
            <tr key={t} style={{ borderBottom:`1px solid ${C.border}22` }}>
              <td style={{ padding:"6px 10px", color:"#818cf8" }}>{t}</td>
              <td style={{ padding:"6px 10px", color:"#22c55e", fontWeight:700 }}>{v==null?"—":Number(v).toFixed(2)}</td>
              <td style={{ padding:"6px 10px", color:C.dim }}>{u}</td>
              <td style={{ padding:"6px 10px", color: proc ? "#22c55e" : C.dim }}>{proc ? "GOOD" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ color:C.dim, fontSize:8, fontFamily:C.mono }}>Valores leídos en vivo del proceso del backend.</div>
    </div>
  );
}

/* helper de estilo de botón */
function btn(color, disabled) {
  return { background: disabled ? "transparent" : `${color}18`, border:`1px solid ${disabled ? "#1e293b" : color}`, color: disabled ? "#4b5563" : color, padding:"7px 14px", borderRadius:5, cursor: disabled ? "not-allowed" : "pointer", fontFamily:"'Consolas','Courier New',monospace", fontSize:10, fontWeight:700 };
}

/* ═══════════════════════════════════════════════════════════════════
   GENERIC — fallback
═══════════════════════════════════════════════════════════════════ */
export function GenericInterface({ asset, labData, onBack }) {
  const { fire, msg } = useAction(asset);
  const { data } = useAssetState(asset);
  const liveState = data?.state || null;
  const [vars, setVars] = useState([]);

  useEffect(() => {
    const assetVars = labData?.variables?.filter(v => v.assetId === asset.id) ?? [];
    setVars(assetVars);
  }, [asset.id, labData]);

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:C.bg }}>
      <TopBar asset={asset} onBack={onBack} msg={msg} live={!!liveState}>
        <button onClick={() => fire("PING")}
          style={{ background:"rgba(34,211,238,.12)", border:"1px solid #22d3ee", color:"#22d3ee", padding:"4px 12px", borderRadius:4, cursor:"pointer", fontSize:9, fontFamily:C.mono, fontWeight:700 }}>
          REGISTRAR ACTIVIDAD
        </button>
      </TopBar>
      <div style={{ flex:1, overflow:"auto", padding:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
          {[["ID",asset.id],["Nombre",asset.name],["Tipo",asset.type],["Vendor",asset.vendor||"—"],["Modelo",asset.model||"—"],["IP",asset.ip||"—"],["VLAN",asset.vlan||"—"],["Purdue",`L${asset.purdueLevel}`],["Protocolos",(asset.protocols||[]).join(",")||"—"],["Estado",data?.status||asset.status||"—"],["Firmware",asset.firmware||"—"],["Categoría",data?.category||"—"]].map(([l,v]) => (
            <InfoCard key={l} label={l} value={String(v)}/>
          ))}
        </div>

        {vars.length > 0 && (
          <>
            <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em", marginBottom:8 }}>VARIABLES ({vars.length})</div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, fontFamily:C.mono }}>
              <thead>
                <tr>{["Variable","Valor","Unidad","Min","Max"].map(h=><th key={h} style={{ padding:"6px 8px", textAlign:"left", color:C.dim, borderBottom:`1px solid ${C.border}`, fontSize:8 }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {vars.map(v => (
                  <tr key={v.variable} style={{ borderBottom:`1px solid ${C.border}22` }}>
                    <td style={{ padding:"5px 8px", color:"#818cf8" }}>{v.variable}</td>
                    <td style={{ padding:"5px 8px", color:"#22c55e", fontWeight:700 }}>{v.initialValue}</td>
                    <td style={{ padding:"5px 8px", color:C.dim }}>{v.unit||"—"}</td>
                    <td style={{ padding:"5px 8px", color:C.dim }}>{v.min??'—'}</td>
                    <td style={{ padding:"5px 8px", color:C.dim }}>{v.max??'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}