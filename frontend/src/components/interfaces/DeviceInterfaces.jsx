/**
 * DeviceInterfaces.jsx
 * Interfaces específicas para: Sensor, Motor/Drive/Valve, Switch/Firewall/eWON, SCADA/MES/Historian, Workstation/Genérico.
 */

import { useState, useEffect, useRef } from "react";

const C = { bg:"#05080f", bg2:"#08101a", bg3:"#0d1520", border:"#1e293b", text:"#e2e8f0", dim:"#4b5563", mono:"'Consolas','Courier New',monospace" };
const statusColor = s => ({ ONLINE:"#22c55e", OFFLINE:"#4b5563", WARNING:"#f59e0b", COMPROMISED:"#ef4444" })[s?.toUpperCase()] ?? "#22c55e";

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

function TopBar({ asset, onBack, accent="#22d3ee", children }) {
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
      {children}
    </div>
  );
}

function LiveBadge({ scanning }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5, color:"#22c55e", fontSize:9, fontFamily:C.mono }}>
      <div style={{ width:6, height:6, borderRadius:"50%", background:"#22c55e", animation: scanning ? "blink 1s infinite" : "none" }}/>
      {scanning ? "EN VIVO" : "ESTÁTICO"}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SENSOR INTERFACE — temperatura / presión / nivel / flujo
═══════════════════════════════════════════════════════════════════ */
export function SensorInterface({ asset, labData, onBack }) {
  const [live,     setLive]     = useState(true);
  const [value,    setValue]    = useState(null);
  const [trend,    setTrend]    = useState([]);
  const [unit,     setUnit]     = useState("°C");
  const [min,      setMin]      = useState(0);
  const [max,      setMax]      = useState(150);
  const [spHigh,   setSpHigh]   = useState(80);
  const [spLow,    setSpLow]    = useState(20);
  const [editParam,setEditParam]= useState(null);
  const tickRef = useRef(null);

  useEffect(() => {
    // Detect type from asset data
    const t = (asset.type||"").toLowerCase();
    const m = (asset.model||"").toLowerCase();
    if (t.includes("pres") || m.includes("pres")) { setUnit("bar"); setMax(10); setSpHigh(4.5); setSpLow(1.0); setValue(3.82); }
    else if (t.includes("flow") || m.includes("flow")) { setUnit("L/min"); setMax(500); setSpHigh(400); setValue(280); }
    else { setUnit("°C"); setValue(68.4); }

    // Load from labData variables
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
    if (!live) return;
    tickRef.current = setInterval(() => {
      setValue(prev => {
        const next = Math.max(min, Math.min(max, (prev ?? 68.4) + (Math.random()-0.5)*0.8));
        setTrend(t => [...t.slice(-59), next]);
        return next;
      });
    }, 800);
    return () => clearInterval(tickRef.current);
  }, [live, min, max]);

  const alarmHigh = value > spHigh;
  const alarmLow  = value < spLow;
  const alarm     = alarmHigh || alarmLow;
  const pct       = value != null ? Math.max(0, Math.min(100, ((value-min)/(max-min))*100)) : 50;
  const barColor  = alarmHigh ? "#ef4444" : alarmLow ? "#3b82f6" : "#22c55e";

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:C.bg }}>
      <TopBar asset={asset} onBack={onBack} accent="#22c55e">
        <LiveBadge scanning={live}/>
        <button onClick={() => setLive(p=>!p)} style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"4px 10px", borderRadius:4, cursor:"pointer", fontSize:9, fontFamily:C.mono }}>
          {live ? "⏸ PAUSAR" : "▶ REANUDAR"}
        </button>
      </TopBar>

      <div style={{ flex:1, overflow:"auto", padding:16, display:"flex", flexDirection:"column", gap:14 }}>
        {/* Big value display */}
        <div style={{ textAlign:"center", padding:"24px 0", background:C.bg2, borderRadius:10, border:`1px solid ${alarm ? "#ef4444" : C.border}`, position:"relative" }}>
          {alarm && <div style={{ position:"absolute", top:8, right:12, color:"#ef4444", fontSize:10, fontFamily:C.mono, fontWeight:700, animation:"blink 1s infinite" }}>⚠ ALARMA</div>}
          <div style={{ fontSize:9, color:C.dim, fontFamily:C.mono, letterSpacing:".15em", marginBottom:8 }}>VALOR ACTUAL</div>
          <div style={{ fontSize:52, fontWeight:900, fontFamily:C.mono, color:barColor, lineHeight:1 }}>
            {value?.toFixed(2) ?? "—"}
          </div>
          <div style={{ fontSize:16, color:C.dim, fontFamily:C.mono, marginTop:4 }}>{unit}</div>

          {/* Bar */}
          <div style={{ margin:"16px 24px 0", height:12, background:C.bg3, borderRadius:6, overflow:"hidden" }}>
            <div style={{ width:`${pct}%`, height:"100%", background:barColor, borderRadius:6, transition:"width .5s" }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", margin:"4px 24px", color:C.dim, fontSize:9, fontFamily:C.mono }}>
            <span>{min} {unit}</span>
            <span>{max} {unit}</span>
          </div>
        </div>

        {/* Setpoints */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[{ key:"spHigh", label:"SP Alto",  val:spHigh, set:setSpHigh, color:"#ef4444" }, { key:"spLow", label:"SP Bajo", val:spLow, set:setSpLow, color:"#3b82f6" }].map(({ key, label, val, set, color }) => (
            <div key={key} style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:6, padding:"10px 12px" }}>
              <div style={{ color:C.dim, fontSize:8, fontFamily:C.mono, marginBottom:4 }}>{label}</div>
              {editParam === key ? (
                <input autoFocus type="number" defaultValue={val}
                  onBlur={e => { set(parseFloat(e.target.value)||0); setEditParam(null); }}
                  onKeyDown={e => { if(e.key==='Enter'){set(parseFloat(e.target.value)||0);setEditParam(null);} }}
                  style={{ background:C.bg2, border:`1px solid ${color}`, color:C.text, padding:"2px 6px", borderRadius:4, width:80, fontFamily:C.mono, fontSize:12, outline:"none" }}/>
              ) : (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ color, fontSize:14, fontFamily:C.mono, fontWeight:700 }}>{val} {unit}</span>
                  <button onClick={() => setEditParam(key)} style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"1px 6px", borderRadius:3, cursor:"pointer", fontSize:8, fontFamily:C.mono }}>✎</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mini trend */}
        <div style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px" }}>
          <div style={{ color:C.dim, fontSize:8, fontFamily:C.mono, letterSpacing:".1em", marginBottom:6 }}>TENDENCIA (60 muestras)</div>
          {trend.length > 1 ? (() => {
            const mn = Math.min(...trend);
            const mx = Math.max(...trend) || mn+1;
            const w=320, h=50;
            const pts = trend.map((v,i) => `${(i/(trend.length-1))*w},${h-((v-mn)/(mx-mn))*(h-6)-3}`).join(' ');
            return (
              <svg viewBox={`0 0 ${w} ${h}`} style={{ width:"100%" }}>
                <polyline points={pts} fill="none" stroke={barColor} strokeWidth={1.5}/>
                <text x={w-2} y={h-2} textAnchor="end" fill={barColor} fontSize={8} fontFamily={C.mono}>{trend[trend.length-1].toFixed(2)} {unit}</text>
              </svg>
            );
          })() : <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>Esperando datos...</div>}
        </div>

        {/* Device info */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <InfoCard label="IP"        value={asset.ip || "—"}/>
          <InfoCard label="Protocolo" value={(asset.protocols||[]).join(", ") || "—"}/>
          <InfoCard label="Modelo"    value={asset.model || "—"}/>
          <InfoCard label="Firmware"  value={asset.firmware || "—"}/>
        </div>
      </div>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MOTOR / DRIVE / VALVE INTERFACE
═══════════════════════════════════════════════════════════════════ */
export function DriveInterface({ asset, labData, onBack }) {
  const isValve  = (asset.type||"").toLowerCase().includes("valve");
  const isMotor  = (asset.type||"").toLowerCase().includes("motor");
  const [running, setRunning]   = useState(true);
  const [speed,   setSpeed]     = useState(isValve ? 50 : 1450);
  const [setpt,   setSetpt]     = useState(isValve ? 50 : 1450);
  const [current, setCurrent]   = useState(8.4);
  const [torque,  setTorque]    = useState(42.0);
  const [temp,    setTemp]      = useState(45.0);
  const [fault,   setFault]     = useState(null);
  const [trend,   setTrend]     = useState([]);
  const [mode,    setMode]      = useState("AUTO");
  const label = isValve ? "%" : "RPM";
  const maxVal = isValve ? 100 : 1800;

  useEffect(() => {
    const iv = setInterval(() => {
      if (!running) return;
      setSpeed(p => {
        const drift = (Math.random()-0.5) * (isValve ? 0.5 : 15);
        const next = Math.max(0, Math.min(maxVal, p + drift));
        setTrend(t => [...t.slice(-39), next]);
        return Math.round(next);
      });
      setCurrent(p => Math.max(0, Math.min(20, p + (Math.random()-.5)*0.3)));
      setTorque(p => Math.max(0, Math.min(100, p + (Math.random()-.5)*1)));
      setTemp(p => Math.max(30, Math.min(90, p + (Math.random()-.5)*0.4)));
    }, 600);
    return () => clearInterval(iv);
  }, [running]);

  const speedPct = (speed / maxVal) * 100;
  const accent   = isValve ? "#22c55e" : "#22d3ee";

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:C.bg }}>
      <TopBar asset={asset} onBack={onBack} accent={accent}>
        <div style={{ color: running ? "#22c55e" : "#ef4444", fontFamily:C.mono, fontSize:10, fontWeight:700 }}>
          {running ? "▶ EN MARCHA" : "■ PARADO"}
        </div>
        <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>{mode}</div>
      </TopBar>

      <div style={{ flex:1, overflow:"auto", padding:16, display:"flex", flexDirection:"column", gap:12 }}>
        {/* Big display */}
        <div style={{ textAlign:"center", background:C.bg2, borderRadius:10, border:`1px solid ${C.border}`, padding:"20px 0" }}>
          <div style={{ fontSize:9, color:C.dim, fontFamily:C.mono, letterSpacing:".15em", marginBottom:4 }}>{isValve ? "APERTURA" : "VELOCIDAD"}</div>
          <div style={{ fontSize:52, fontWeight:900, fontFamily:C.mono, color: running ? accent : C.dim, lineHeight:1 }}>{speed}</div>
          <div style={{ fontSize:14, color:C.dim, fontFamily:C.mono }}>{label}</div>
          {/* Bar */}
          <div style={{ margin:"12px 24px 0", height:10, background:C.bg3, borderRadius:5 }}>
            <div style={{ width:`${speedPct}%`, height:"100%", background:accent, borderRadius:5, transition:"width .4s" }}/>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => setRunning(true)} disabled={running}
            style={{ flex:1, background: running ? `rgba(34,197,94,.05)` : `rgba(34,197,94,.15)`, border:`1px solid ${running?"#1e293b":"#22c55e"}`, color: running?C.dim:"#22c55e", padding:"10px", borderRadius:6, cursor: running?"not-allowed":"pointer", fontFamily:C.mono, fontSize:11, fontWeight:700 }}>
            ▶ MARCHA
          </button>
          <button onClick={() => setRunning(false)} disabled={!running}
            style={{ flex:1, background: !running ? `rgba(239,68,68,.05)` : `rgba(239,68,68,.15)`, border:`1px solid ${!running?"#1e293b":"#ef4444"}`, color: !running?C.dim:"#ef4444", padding:"10px", borderRadius:6, cursor: !running?"not-allowed":"pointer", fontFamily:C.mono, fontSize:11, fontWeight:700 }}>
            ■ PARO
          </button>
        </div>

        {/* Setpoint slider */}
        <div style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:6, padding:"12px 14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>SETPOINT</span>
            <span style={{ color:accent, fontSize:12, fontFamily:C.mono, fontWeight:700 }}>{setpt} {label}</span>
          </div>
          <input type="range" min={0} max={maxVal} step={isValve?1:50} value={setpt}
            onChange={e => setSetpt(Number(e.target.value))}
            style={{ width:"100%", accentColor:accent }}/>
        </div>

        {/* Metrics */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
          <InfoCard label="Corriente"    value={`${current.toFixed(1)} A`}     color="#f59e0b"/>
          <InfoCard label="Torque"       value={`${torque.toFixed(0)} %`}      color="#818cf8"/>
          <InfoCard label="Temperatura"  value={`${temp.toFixed(1)} °C`}       color={temp>75?"#ef4444":"#22c55e"}/>
        </div>

        {/* Trend */}
        {trend.length > 2 && (() => {
          const mn = Math.min(...trend), mx = Math.max(...trend)||mn+1;
          const pts = trend.map((v,i)=>`${(i/(trend.length-1))*300},${44-((v-mn)/(mx-mn))*40}`).join(' ');
          return (
            <div style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:6, padding:"8px 10px" }}>
              <div style={{ color:C.dim, fontSize:8, fontFamily:C.mono, marginBottom:4 }}>TENDENCIA</div>
              <svg viewBox="0 0 300 48" style={{ width:"100%" }}>
                <polyline points={pts} fill="none" stroke={accent} strokeWidth={1.5}/>
              </svg>
            </div>
          );
        })()}

        {/* Mode selector */}
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
   NETWORK DEVICE INTERFACE — Switch / Firewall / eWON / mGuard
═══════════════════════════════════════════════════════════════════ */
export function NetworkInterface({ asset, labData, onBack }) {
  const [tab,     setTab]     = useState("ports");
  const [traffic, setTraffic] = useState([]);
  const [rules,   setRules]   = useState([
    { id:1, src:"OT-FIELD",    dst:"OT-HMI",    proto:"S7comm",     port:"102",   action:"PERMIT", enabled:true  },
    { id:2, src:"OT-HMI",      dst:"OT-SCADA",  proto:"OPC-UA",     port:"4840",  action:"PERMIT", enabled:true  },
    { id:3, src:"ENG",          dst:"OT-FIELD",  proto:"S7comm",     port:"102",   action:"PERMIT", enabled:true  },
    { id:4, src:"EXTERNAL",     dst:"OT-FIELD",  proto:"ANY",        port:"ANY",   action:"DENY",   enabled:true  },
    { id:5, src:"ANY",          dst:"ANY",       proto:"ICMP",       port:"—",     action:"PERMIT", enabled:false },
  ]);
  const [ports] = useState(() =>
    Array.from({length:8}, (_,i) => ({
      id: i+1,
      status: Math.random() > 0.3 ? "UP" : "DOWN",
      speed:  ["100M","1G","1G","100M","1G","100M","1G","1G"][i],
      vlan:   [440,440,902,904,441,905,442,901][i],
      rx:     Math.floor(Math.random()*1000),
      tx:     Math.floor(Math.random()*800),
    }))
  );
  const isFirewall = (asset.type||"").toLowerCase().includes("firewall") || (asset.type||"").toLowerCase().includes("mguard");
  const isEWON     = (asset.type||"").toLowerCase().includes("ewon")     || (asset.type||"").toLowerCase().includes("gateway");
  const accent     = isFirewall ? "#ef4444" : isEWON ? "#005B8E" : "#3b82f6";

  useEffect(() => {
    const iv = setInterval(() => {
      setTraffic(prev => [...prev.slice(-19), {
        ts:    new Date().toLocaleTimeString(),
        src:   ["172.16.100.10","172.16.102.10","172.16.104.10"][Math.floor(Math.random()*3)],
        dst:   ["172.16.102.10","172.16.104.10","172.16.100.20"][Math.floor(Math.random()*3)],
        proto: ["S7comm","OPC-UA","PROFINET","HTTP"][Math.floor(Math.random()*4)],
        bytes: Math.floor(Math.random()*2048),
        action: "PERMIT",
      }]);
    }, 1200);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:C.bg }}>
      <TopBar asset={asset} onBack={onBack} accent={accent}/>

      {/* Tabs */}
      <div style={{ display:"flex", background:C.bg2, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        {(isFirewall || isEWON
          ? ["ports","rules","traffic","info"]
          : ["ports","vlans","traffic","info"]
        ).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background:tab===t?C.bg3:"transparent", border:"none", borderBottom:tab===t?`2px solid ${accent}`:"2px solid transparent", color:tab===t?accent:C.dim, padding:"8px 14px", cursor:"pointer", fontFamily:C.mono, fontSize:9, fontWeight:700, letterSpacing:".08em", transition:"all .15s" }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflow:"auto", padding:14 }}>

        {/* PORTS */}
        {tab === "ports" && (
          <div>
            <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em", marginBottom:10 }}>
              PUERTOS — {ports.filter(p=>p.status==="UP").length}/{ports.length} activos
            </div>
            {ports.map(p => (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, background:C.bg3, border:`1px solid ${C.border}`, borderRadius:5, padding:"8px 12px", marginBottom:6 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:p.status==="UP"?"#22c55e":"#4b5563", boxShadow:p.status==="UP"?"0 0 5px #22c55e":"none", flexShrink:0 }}/>
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

        {/* RULES (Firewall) */}
        {(tab === "rules") && (
          <div>
            <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em", marginBottom:10 }}>
              REGLAS DE SEGURIDAD — {rules.filter(r=>r.enabled).length} activas
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
                <button onClick={() => setRules(prev => prev.map(x => x.id===r.id ? {...x,enabled:!x.enabled} : x))}
                  style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"2px 6px", borderRadius:3, cursor:"pointer", fontSize:8, fontFamily:C.mono }}>
                  {r.enabled?"DESACTIVAR":"ACTIVAR"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* VLANS */}
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

        {/* TRAFFIC */}
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

        {/* INFO */}
        {tab === "info" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[
              ["ID", asset.id], ["Tipo", asset.type], ["Vendor", asset.vendor], ["Modelo", asset.model||"—"],
              ["IP", asset.ip||"—"], ["MAC", asset.mac||"—"], ["VLAN", asset.vlan||"—"], ["Protocolos", (asset.protocols||[]).join(", ")||"—"],
              ["Firmware", asset.firmware||"—"], ["Estado", asset.status||"—"],
            ].map(([l,v]) => <InfoCard key={l} label={l} value={v}/>)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SCADA / MES / HISTORIAN INTERFACE
═══════════════════════════════════════════════════════════════════ */
export function ServerInterface({ asset, labData, onBack }) {
  const [tab, setTab] = useState("overview");
  const [cpu, setCpu] = useState(18);
  const [mem, setMem] = useState(42);
  const isMES  = (asset.type||"").toLowerCase().includes("mes");
  const isHist = (asset.type||"").toLowerCase().includes("hist");
  const accent = isMES ? "#f59e0b" : isHist ? "#818cf8" : "#3b82f6";

  useEffect(() => {
    const iv = setInterval(() => {
      setCpu(p => Math.max(5, Math.min(90, p + (Math.random()-.5)*5)));
      setMem(p => Math.max(20, Math.min(90, p + (Math.random()-.5)*2)));
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  const services = isMES
    ? [["MES Core","ONLINE"],["OEE Engine","ONLINE"],["Scheduler","ONLINE"],["DB Service","ONLINE"],["API Server","ONLINE"]]
    : isHist
    ? [["HistSrv","ONLINE"],["CompressDB","ONLINE"],["Retrieval","ONLINE"],["Export","ONLINE"],["Backup","WARNING"]]
    : [["WinCC Runtime","ONLINE"],["OPC-UA Server","ONLINE"],["Alarm Srv","ONLINE"],["Trend Srv","ONLINE"],["Web Client","OFFLINE"]];

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:C.bg }}>
      <TopBar asset={asset} onBack={onBack} accent={accent}/>

      <div style={{ display:"flex", background:C.bg2, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        {["overview","services","connections","info"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background:tab===t?C.bg3:"transparent", border:"none", borderBottom:tab===t?`2px solid ${accent}`:"2px solid transparent", color:tab===t?accent:C.dim, padding:"8px 14px", cursor:"pointer", fontFamily:C.mono, fontSize:9, fontWeight:700, letterSpacing:".08em" }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflow:"auto", padding:14 }}>
        {tab === "overview" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              <InfoCard label="CPU" value={`${cpu.toFixed(0)}%`} color={cpu>80?"#ef4444":cpu>60?"#f59e0b":"#22c55e"}/>
              <InfoCard label="RAM" value={`${mem.toFixed(0)}%`} color={mem>80?"#ef4444":"#22c55e"}/>
              <InfoCard label="Estado" value={asset.status||"ONLINE"} color="#22c55e"/>
            </div>
            {/* CPU bar */}
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
                <button style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"2px 8px", borderRadius:3, cursor:"pointer", fontSize:8, fontFamily:C.mono }}>REINICIAR</button>
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
   WORKSTATION / ENGINEERING STATION
═══════════════════════════════════════════════════════════════════ */
export function WorkstationInterface({ asset, labData, onBack }) {
  const [apps] = useState([
    { name:"TIA Portal V19",   status:"INSTALLED", icon:"🔧", action:"Abrir proyecto" },
    { name:"STEP 7 V5.7",      status:"INSTALLED", icon:"⚙", action:"Abrir proyecto" },
    { name:"WinCC Explorer",   status:"INSTALLED", icon:"🖥", action:"Abrir" },
    { name:"Studio 5000",      status:"INSTALLED", icon:"🏭", action:"Abrir" },
    { name:"Wireshark 4.x",    status:"INSTALLED", icon:"📡", action:"Capturar" },
    { name:"Nmap 7.94",        status:"INSTALLED", icon:"🔍", action:"Escanear" },
    { name:"STEP 7 Safety",    status:"NOT_INSTALLED", icon:"🛡", action:"Instalar" },
  ]);

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:C.bg }}>
      <TopBar asset={asset} onBack={onBack} accent="#f59e0b"/>
      <div style={{ flex:1, overflow:"auto", padding:14 }}>
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
                <button style={{ background:`rgba(245,158,11,.1)`, border:`1px solid rgba(245,158,11,.3)`, color:"#f59e0b", padding:"4px 12px", borderRadius:4, cursor:"pointer", fontSize:9, fontFamily:C.mono }}>
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
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   GENERIC INTERFACE — fallback
═══════════════════════════════════════════════════════════════════ */
export function GenericInterface({ asset, labData, onBack }) {
  const [vars, setVars] = useState([]);

  useEffect(() => {
    const assetVars = labData?.variables?.filter(v => v.assetId === asset.id) ?? [];
    setVars(assetVars);
  }, [asset.id, labData]);

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:C.bg }}>
      <TopBar asset={asset} onBack={onBack}/>
      <div style={{ flex:1, overflow:"auto", padding:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
          {[["ID",asset.id],["Nombre",asset.name],["Tipo",asset.type],["Vendor",asset.vendor||"—"],["Modelo",asset.model||"—"],["IP",asset.ip||"—"],["VLAN",asset.vlan||"—"],["Purdue",`L${asset.purdueLevel}`],["Protocolos",(asset.protocols||[]).join(",")||"—"],["Estado",asset.status||"—"],["Firmware",asset.firmware||"—"],["Aplicación",asset.application||"—"]].map(([l,v]) => (
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