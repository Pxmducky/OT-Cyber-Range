/**
 * HMIInterface.jsx
 * Interfaz HMI industrial — simula un panel Siemens KTP/TP Comfort.
 * Muestra proceso en tiempo real, alarmas, setpoints y tendencias.
 */

import { useState, useEffect, useRef } from "react";

const C = {
  bg:     "#1a1a2e", panel: "#16213e", screen: "#0f0f23",
  accent: "#00d2ff", green: "#00ff88", red: "#ff3366",
  amber:  "#ffaa00", text:  "#e0e0e0", dim:   "#4a5568",
  border: "#2d3748", mono:  "'Courier New', monospace",
};

/* ── Gauge SVG ── */
function Gauge({ value, min=0, max=100, unit="", label="", alarm=false, hihi=false }) {
  const pct   = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -135 + pct * 270;
  const color = hihi ? C.red : alarm ? C.amber : C.green;
  const r = 44;
  const cx = 55, cy = 55;
  // Arc path
  const toRad = d => d * Math.PI / 180;
  const arcX  = (deg) => cx + r * Math.cos(toRad(deg - 90));
  const arcY  = (deg) => cy + r * Math.sin(toRad(deg - 90));
  const startDeg = -135, endDeg = startDeg + pct * 270;
  const largeArc = pct * 270 > 180 ? 1 : 0;

  return (
    <svg viewBox="0 0 110 90" style={{ width:"100%", maxWidth:120 }}>
      {/* Background arc */}
      <path d={`M${arcX(-135)} ${arcY(-135)} A${r} ${r} 0 1 1 ${arcX(135)} ${arcY(135)}`}
        fill="none" stroke="#1e293b" strokeWidth={6} strokeLinecap="round"/>
      {/* Value arc */}
      {pct > 0 && (
        <path d={`M${arcX(-135)} ${arcY(-135)} A${r} ${r} 0 ${largeArc} 1 ${arcX(endDeg)} ${arcY(endDeg)}`}
          fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"/>
      )}
      {/* Needle */}
      <line
        x1={cx} y1={cy}
        x2={cx + (r-8) * Math.cos(toRad(angle - 90))}
        y2={cy + (r-8) * Math.sin(toRad(angle - 90))}
        stroke={color} strokeWidth={2} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={4} fill={color}/>
      {/* Value text */}
      <text x={cx} y={cy+18} textAnchor="middle" fill={color} fontSize={12} fontFamily={C.mono} fontWeight="bold">
        {typeof value === 'number' ? value.toFixed(1) : value}
      </text>
      <text x={cx} y={cy+28} textAnchor="middle" fill={C.dim} fontSize={7} fontFamily={C.mono}>{unit}</text>
      {/* Label */}
      <text x={cx} y={84} textAnchor="middle" fill={C.text} fontSize={8} fontFamily={C.mono}>{label}</text>
    </svg>
  );
}

/* ── LED indicator ── */
function LED({ on, color, label, size=10 }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <div style={{ width:size, height:size, borderRadius:"50%", background: on ? color : "#1e293b", boxShadow: on ? `0 0 8px ${color}` : "none", flexShrink:0, transition:"all .3s" }}/>
      {label && <span style={{ color: on ? C.text : C.dim, fontSize:10, fontFamily:C.mono }}>{label}</span>}
    </div>
  );
}

/* ── Trend mini chart ── */
function TrendChart({ data, color, label, unit, height=60 }) {
  const vals = data.slice(-40);
  if (vals.length < 2) return <div style={{ height, background:"#0a0f1a", borderRadius:4 }}/>;
  const mn = Math.min(...vals);
  const mx = Math.max(...vals) || mn + 1;
  const w = 240, h = height;
  const pts = vals.map((v, i) => `${(i/(vals.length-1))*w},${h - ((v-mn)/(mx-mn)) * (h-8) - 4}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width:"100%", height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#grad-${label})`}/>
        <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}/>
        {/* Last value */}
        {vals.length > 0 && (
          <text x={w-2} y={h-6} textAnchor="end" fill={color} fontSize={8} fontFamily={C.mono}>
            {vals[vals.length-1].toFixed(1)} {unit}
          </text>
        )}
      </svg>
    </div>
  );
}

export default function HMIInterface({ asset, labData, plant, onBack }) {
  const [screen,      setScreen]      = useState("main");      // main | alarms | setpoints | trends | manual
  const [processVals, setProcessVals] = useState({ Temperature: 68.4, Pressure: 3.82, Motor_Speed: 1450, Valve_Pos: 50.0, Production_Rate: 95 });
  const [alarms,      setAlarms]      = useState([]);
  const [ackAlarms,   setAckAlarms]   = useState(new Set());
  const [setpoints,   setSetpoints]   = useState({ T_Setpoint: 70, P_Setpoint: 4.0, Speed_Setpoint: 1450 });
  const [editSP,      setEditSP]      = useState(null);
  const [trendData,   setTrendData]   = useState({ Temperature: [], Pressure: [], Motor_Speed: [] });
  const [manualMode,  setManualMode]  = useState(false);
  const [manualMotor, setManualMotor] = useState(1450);
  const [manualValve, setManualValve] = useState(50);
  const [runState,    setRunState]    = useState(true);
  const tickRef = useRef(null);

  /* ── Variables del Excel ── */
  useEffect(() => {
    const assetVars = labData?.variables?.filter(v => v.assetId === asset.id) ?? [];
    if (assetVars.length > 0) {
      const vals = {};
      assetVars.forEach(v => { vals[v.variable] = parseFloat(v.initialValue) || 0; });
      setProcessVals(prev => ({ ...prev, ...vals }));
    }
  }, [asset.id]);

  /* ── Simulación de proceso ── */
  useEffect(() => {
    if (!runState) return;
    tickRef.current = setInterval(() => {
      setProcessVals(prev => {
        const drift = () => (Math.random() - 0.5) * 0.3;
        const T  = Math.max(20, Math.min(120, prev.Temperature  + drift()));
        const P  = Math.max(0,  Math.min(8,   prev.Pressure     + drift() * 0.05));
        const MS = Math.max(0,  Math.min(2000,prev.Motor_Speed  + (Math.random()-0.5)*20));
        const VP = Math.max(0,  Math.min(100, prev.Valve_Pos    + (Math.random()-0.5)*2));
        const PR = Math.max(0,  Math.min(100, prev.Production_Rate + (Math.random()-0.5)*1));
        return { Temperature: T, Pressure: P, Motor_Speed: Math.round(MS), Valve_Pos: Math.round(VP), Production_Rate: Math.round(PR) };
      });

      // Trends
      setTrendData(prev => ({
        Temperature: [...prev.Temperature.slice(-39), processVals.Temperature],
        Pressure:    [...prev.Pressure.slice(-39),    processVals.Pressure],
        Motor_Speed: [...prev.Motor_Speed.slice(-39), processVals.Motor_Speed],
      }));

      // Generate/clear alarms
      setAlarms(prev => {
        const active = [];
        if (processVals.Temperature > 85)   active.push({ id:"T_HH", lvl:"CRITICAL",  msg:"TEMPERATURA MUY ALTA",       val:`${processVals.Temperature.toFixed(1)}°C > 85°C`  });
        if (processVals.Temperature > 80)   active.push({ id:"T_H",  lvl:"WARNING",   msg:"Temperatura alta",           val:`${processVals.Temperature.toFixed(1)}°C > 80°C`  });
        if (processVals.Pressure > 5.0)     active.push({ id:"P_HH", lvl:"CRITICAL",  msg:"PRESIÓN MUY ALTA",           val:`${processVals.Pressure.toFixed(2)} bar > 5.0`    });
        if (processVals.Motor_Speed < 400)  active.push({ id:"M_LL", lvl:"WARNING",   msg:"Velocidad motor muy baja",   val:`${processVals.Motor_Speed} RPM < 400`            });
        return active;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [runState, processVals]);

  const unAcked = alarms.filter(a => !ackAlarms.has(a.id)).length;
  const T  = processVals.Temperature;
  const P  = processVals.Pressure;
  const MS = processVals.Motor_Speed;
  const VP = processVals.Valve_Pos;

  /* ── Frame del panel HMI ── */
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:C.bg, fontFamily:"'Segoe UI', sans-serif" }}>

      {/* Bezel top */}
      <div style={{ background:"linear-gradient(180deg,#2a2a4a,#1a1a2e)", padding:"8px 16px", display:"flex", alignItems:"center", gap:12, flexShrink:0, borderBottom:"1px solid #3d3d6b" }}>
        <button onClick={onBack} style={{ background:"none", border:"1px solid #3d3d6b", color:C.dim, padding:"3px 10px", borderRadius:4, cursor:"pointer", fontSize:9, fontFamily:C.mono }}>← VOLVER</button>

        {/* SIEMENS brand */}
        <div style={{ color:"#009999", fontWeight:900, fontSize:13, letterSpacing:".15em" }}>SIEMENS</div>
        <div style={{ color:C.dim, fontSize:9, letterSpacing:".1em" }}>SIMATIC HMI</div>

        {/* Panel ID */}
        <div style={{ color:C.text, fontSize:10, marginLeft:"auto" }}>{asset.id} — {asset.name}</div>

        {/* Alarm indicator */}
        {unAcked > 0 && (
          <div style={{ background:"rgba(255,51,102,.2)", border:"1px solid rgba(255,51,102,.5)", color:C.red, fontSize:10, padding:"3px 8px", borderRadius:4, fontFamily:C.mono, animation:"blink 1s infinite" }}>
            ⚠ {unAcked} ALARMA{unAcked>1?"S":""}
          </div>
        )}

        {/* Status */}
        <LED on={runState} color={C.green} label={runState ? "RUN" : "STOP"} size={8}/>
        <div style={{ fontSize:9, fontFamily:C.mono, color:C.dim }}>
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Screen area */}
      <div style={{ flex:1, background:C.screen, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* ── MAIN SCREEN ── */}
        {screen === "main" && (
          <div style={{ flex:1, padding:16, display:"flex", flexDirection:"column", gap:12 }}>
            {/* Title */}
            <div style={{ textAlign:"center", color:C.accent, fontFamily:C.mono, fontSize:12, fontWeight:700, letterSpacing:".1em", borderBottom:"1px solid #1e293b", paddingBottom:8 }}>
              {asset.name?.toUpperCase() || "MANUFACTURING CELL"}
            </div>

            {/* Gauges row */}
            <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
              <Gauge value={T}  min={0} max={120} unit="°C"  label="TEMPERATURA" alarm={T>80} hihi={T>90}/>
              <Gauge value={P}  min={0} max={8}   unit="bar" label="PRESIÓN"     alarm={P>4.5} hihi={P>5.5}/>
              <Gauge value={MS} min={0} max={2000} unit="RPM" label="VEL. MOTOR"  alarm={MS<400}/>
            </div>

            {/* Process values bar */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              {[
                { l:"VÁLVULA",    v:`${VP}%`,    col: VP>80 ? C.amber : C.text },
                { l:"PRODUCCIÓN", v:`${processVals.Production_Rate}%`, col: C.green },
                { l:"MODO",       v: manualMode ? "MANUAL" : "AUTO",   col: manualMode ? C.amber : C.accent },
              ].map(({ l, v, col }) => (
                <div key={l} style={{ background:"#0d1520", border:"1px solid #1e293b", borderRadius:6, padding:"8px 10px", textAlign:"center" }}>
                  <div style={{ color:C.dim, fontSize:8, fontFamily:C.mono, marginBottom:2 }}>{l}</div>
                  <div style={{ color:col, fontSize:13, fontFamily:C.mono, fontWeight:700 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Valve bar */}
            <div style={{ background:"#0d1520", border:"1px solid #1e293b", borderRadius:6, padding:"8px 12px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ color:C.dim, fontSize:8, fontFamily:C.mono }}>APERTURA VÁLVULA</span>
                <span style={{ color:C.accent, fontSize:10, fontFamily:C.mono, fontWeight:700 }}>{VP}%</span>
              </div>
              <div style={{ height:8, background:"#1e293b", borderRadius:4 }}>
                <div style={{ width:`${VP}%`, height:"100%", background: VP>85 ? C.red : VP>70 ? C.amber : C.accent, borderRadius:4, transition:"width .5s" }}/>
              </div>
            </div>

            {/* Quick alarms */}
            {alarms.filter(a => !ackAlarms.has(a.id)).slice(0,2).map(a => (
              <div key={a.id} style={{ background:"rgba(255,51,102,.08)", border:"1px solid rgba(255,51,102,.3)", borderRadius:5, padding:"6px 10px", display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ color:C.red, fontSize:10, fontFamily:C.mono, fontWeight:700 }}>⚠ {a.msg}</div>
                <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, flex:1 }}>{a.val}</div>
                <button onClick={() => setAckAlarms(prev => new Set([...prev, a.id]))}
                  style={{ background:"none", border:"1px solid rgba(255,51,102,.3)", color:C.red, padding:"2px 8px", borderRadius:3, cursor:"pointer", fontSize:9, fontFamily:C.mono }}>
                  ACK
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── ALARMS SCREEN ── */}
        {screen === "alarms" && (
          <div style={{ flex:1, padding:12 }}>
            <div style={{ color:C.accent, fontFamily:C.mono, fontSize:10, fontWeight:700, letterSpacing:".1em", marginBottom:10 }}>LISTA DE ALARMAS</div>
            {alarms.length === 0 ? (
              <div style={{ color:C.green, fontFamily:C.mono, fontSize:11, padding:12 }}>✓ Sin alarmas activas</div>
            ) : alarms.map(a => (
              <div key={a.id} style={{
                background: a.lvl === "CRITICAL" ? "rgba(255,51,102,.1)" : "rgba(255,170,0,.1)",
                border:     `1px solid ${a.lvl==="CRITICAL" ? "rgba(255,51,102,.4)" : "rgba(255,170,0,.4)"}`,
                borderRadius:6, padding:"8px 12px", marginBottom:6,
                display:"flex", alignItems:"center", gap:10,
                opacity: ackAlarms.has(a.id) ? 0.4 : 1,
              }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background: a.lvl==="CRITICAL" ? C.red : C.amber, flexShrink:0, animation: !ackAlarms.has(a.id) ? "blink 1s infinite" : "none" }}/>
                <div style={{ flex:1 }}>
                  <div style={{ color: a.lvl==="CRITICAL" ? C.red : C.amber, fontFamily:C.mono, fontSize:10, fontWeight:700 }}>{a.lvl} — {a.msg}</div>
                  <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>{a.val}</div>
                </div>
                {!ackAlarms.has(a.id) && (
                  <button onClick={() => setAckAlarms(prev => new Set([...prev, a.id]))}
                    style={{ background:"none", border:`1px solid ${a.lvl==="CRITICAL"?C.red:C.amber}`, color: a.lvl==="CRITICAL"?C.red:C.amber, padding:"3px 10px", borderRadius:4, cursor:"pointer", fontSize:9, fontFamily:C.mono }}>
                    RECONOCER
                  </button>
                )}
              </div>
            ))}
            <div style={{ marginTop:10 }}>
              <button onClick={() => setAckAlarms(new Set(alarms.map(a => a.id)))}
                style={{ background:"none", border:"1px solid #1e293b", color:C.dim, padding:"6px 14px", borderRadius:5, cursor:"pointer", fontSize:9, fontFamily:C.mono }}>
                RECONOCER TODAS
              </button>
            </div>
          </div>
        )}

        {/* ── SETPOINTS SCREEN ── */}
        {screen === "setpoints" && (
          <div style={{ flex:1, padding:12 }}>
            <div style={{ color:C.accent, fontFamily:C.mono, fontSize:10, fontWeight:700, letterSpacing:".1em", marginBottom:10 }}>CONFIGURACIÓN DE SETPOINTS</div>
            {Object.entries(setpoints).map(([key, val]) => (
              <div key={key} style={{ background:"#0d1520", border:"1px solid #1e293b", borderRadius:6, padding:"10px 14px", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ color:C.dim, fontSize:8, fontFamily:C.mono, letterSpacing:".1em" }}>{key.replace(/_/g," ")}</div>
                    {editSP === key ? (
                      <input
                        autoFocus
                        type="number"
                        defaultValue={val}
                        onBlur={e => { setSetpoints(p => ({...p, [key]: parseFloat(e.target.value)||0})); setEditSP(null); }}
                        onKeyDown={e => { if(e.key==='Enter'){setSetpoints(p=>({...p,[key]:parseFloat(e.target.value)||0}));setEditSP(null);} if(e.key==='Escape')setEditSP(null); }}
                        style={{ background:"#1e293b", border:`1px solid ${C.accent}`, color:C.text, padding:"3px 8px", borderRadius:4, fontSize:13, fontFamily:C.mono, width:100, outline:"none" }}
                      />
                    ) : (
                      <div style={{ color:C.accent, fontSize:15, fontFamily:C.mono, fontWeight:700 }}>{val}</div>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={() => setSetpoints(p => ({...p, [key]: p[key]-1}))}
                      style={{ background:"#1e293b", border:"1px solid #2d3748", color:C.text, width:28, height:28, borderRadius:4, cursor:"pointer", fontSize:14, fontFamily:C.mono }}>−</button>
                    <button onClick={() => setSetpoints(p => ({...p, [key]: p[key]+1}))}
                      style={{ background:"#1e293b", border:"1px solid #2d3748", color:C.text, width:28, height:28, borderRadius:4, cursor:"pointer", fontSize:14, fontFamily:C.mono }}>+</button>
                    <button onClick={() => setEditSP(key)}
                      style={{ background:`${C.accent}18`, border:`1px solid ${C.accent}44`, color:C.accent, padding:"3px 10px", borderRadius:4, cursor:"pointer", fontSize:9, fontFamily:C.mono }}>EDITAR</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TRENDS SCREEN ── */}
        {screen === "trends" && (
          <div style={{ flex:1, padding:12, display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ color:C.accent, fontFamily:C.mono, fontSize:10, fontWeight:700, letterSpacing:".1em" }}>TENDENCIAS</div>
            {[
              { key:"Temperature", label:"Temperatura", unit:"°C", color:"#ff6b6b" },
              { key:"Pressure",    label:"Presión",     unit:"bar",color:"#4ecdc4" },
              { key:"Motor_Speed", label:"Vel. Motor",  unit:"RPM",color:"#95e1d3" },
            ].map(({ key, label, unit, color }) => (
              <div key={key} style={{ background:"#0a0f1a", border:"1px solid #1e293b", borderRadius:6, padding:"8px 10px" }}>
                <div style={{ color:C.dim, fontSize:8, fontFamily:C.mono, marginBottom:4 }}>{label} ({unit})</div>
                <TrendChart data={trendData[key] || []} color={color} label={key} unit={unit}/>
              </div>
            ))}
          </div>
        )}

        {/* ── MANUAL SCREEN ── */}
        {screen === "manual" && (
          <div style={{ flex:1, padding:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <div style={{ color:C.accent, fontFamily:C.mono, fontSize:10, fontWeight:700, letterSpacing:".1em" }}>CONTROL MANUAL</div>
              <button onClick={() => setManualMode(p => !p)}
                style={{ background: manualMode ? `${C.amber}18` : `${C.green}18`, border:`1px solid ${manualMode?C.amber:C.green}`, color:manualMode?C.amber:C.green, padding:"4px 12px", borderRadius:4, cursor:"pointer", fontSize:9, fontFamily:C.mono }}>
                {manualMode ? "⚠ MODO MANUAL ACTIVO" : "Activar modo manual"}
              </button>
            </div>

            {manualMode && (
              <>
                {/* Motor speed slider */}
                <div style={{ background:"#0d1520", border:"1px solid #1e293b", borderRadius:6, padding:"12px 14px", marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>VELOCIDAD MOTOR</span>
                    <span style={{ color:C.accent, fontFamily:C.mono, fontSize:12, fontWeight:700 }}>{manualMotor} RPM</span>
                  </div>
                  <input type="range" min={0} max={2000} step={50} value={manualMotor}
                    onChange={e => { setManualMotor(Number(e.target.value)); setProcessVals(p => ({...p, Motor_Speed: Number(e.target.value)})); }}
                    style={{ width:"100%", accentColor:C.accent }}/>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:8, color:C.dim, fontFamily:C.mono, marginTop:2 }}>
                    <span>0</span><span>2000 RPM</span>
                  </div>
                </div>

                {/* Valve slider */}
                <div style={{ background:"#0d1520", border:"1px solid #1e293b", borderRadius:6, padding:"12px 14px", marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>APERTURA VÁLVULA</span>
                    <span style={{ color:C.accent, fontFamily:C.mono, fontSize:12, fontWeight:700 }}>{manualValve}%</span>
                  </div>
                  <input type="range" min={0} max={100} step={1} value={manualValve}
                    onChange={e => { setManualValve(Number(e.target.value)); setProcessVals(p => ({...p, Valve_Pos: Number(e.target.value)})); }}
                    style={{ width:"100%", accentColor:C.accent }}/>
                </div>

                {/* Start / Stop */}
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={() => setRunState(true)}
                    style={{ flex:1, background:`${C.green}18`, border:`1px solid ${C.green}`, color:C.green, padding:"10px", borderRadius:6, cursor:"pointer", fontFamily:C.mono, fontSize:12, fontWeight:700 }}>
                    ▶ MARCHA
                  </button>
                  <button onClick={() => setRunState(false)}
                    style={{ flex:1, background:`${C.red}18`, border:`1px solid ${C.red}`, color:C.red, padding:"10px", borderRadius:6, cursor:"pointer", fontFamily:C.mono, fontSize:12, fontWeight:700 }}>
                    ■ PARO
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── FUNCTION KEYS (bottom) ── */}
      <div style={{ display:"flex", background:"#0d0d1f", borderTop:"1px solid #2d2d5b", flexShrink:0 }}>
        {[
          { id:"main",      label:"F1\nINICIO",    icon:"🏠" },
          { id:"alarms",    label:`F2\nALARMAS`,   icon: unAcked > 0 ? "⚠" : "🔔" },
          { id:"setpoints", label:"F3\nSETPOINTS", icon:"⚙" },
          { id:"trends",    label:"F4\nTENDENCIAS",icon:"📈" },
          { id:"manual",    label:"F5\nMANUAL",    icon:"🕹" },
        ].map(({ id, label, icon }) => (
          <button key={id} onClick={() => setScreen(id)}
            style={{
              flex:1, background: screen===id ? "#1e1e4a" : "transparent",
              border:"none", borderTop: screen===id ? `2px solid ${C.accent}` : "2px solid transparent",
              color: screen===id ? C.accent : C.dim, padding:"6px 4px", cursor:"pointer",
              fontFamily:C.mono, fontSize:8, lineHeight:1.4, letterSpacing:".04em",
              display:"flex", flexDirection:"column", alignItems:"center", gap:2,
              transition:"all .15s",
            }}>
            <span style={{ fontSize:14 }}>{icon}</span>
            <span style={{ whiteSpace:"pre" }}>{label}</span>
          </button>
        ))}
      </div>

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}