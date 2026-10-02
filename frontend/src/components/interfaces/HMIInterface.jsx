/**
 * HMIInterface.jsx
 * Panel HMI industrial conectado al MOTOR DE SIMULACIÓN del backend.
 *
 * - El proceso se muestra de forma GENÉRICA (Entrada → Proceso → Máquina →
 *   Salida) para que aplique a cualquier tipo de empresa.
 * - Todos los botones tienen impacto real sobre la planta del backend:
 *     START/STOP/RESET  → /api/hmi/{start,stop,reset}
 *     SET (setpoints)   → /api/hmi/setpoint
 *     MANUAL (sliders)  → /api/process/set
 *     ACK/RESET alarma  → /api/alarms/{acknowledge,reset}
 * - Los valores (TEMP/PRESS/SPEED/VALVE), el estado y las alarmas se leen en
 *   vivo desde /api/plant.
 *
 * Nota: el backend modela un único proceso físico; cualquier HMI abierto lo
 * controla. Dar a cada activo su propio proceso es un paso posterior.
 */

import { useState, useEffect, useRef, useCallback } from "react";

const API_URL = "http://127.0.0.1:8000";

/* ── Paleta (estilo SIMATIC oscuro) ── */
const C = {
  bg:     "#0b1220", panel: "#111c2e", screen: "#0a1322",
  accent: "#22d3ee", green: "#22c55e", red: "#ef4444",
  amber:  "#f59e0b", text:  "#dbe4f0", dim:   "#5b6b82",
  border: "#1e2d44", mono:  "'Consolas','Courier New',monospace",
};

/* ── Setpoints: variable backend, etiqueta, unidad y rango operativo ── */
const SETPOINTS = [
  { var: "TEMPERATURE",    label: "TEMPERATURE", unit: "°C",  key: "temperature",    min: 60,  max: 78,   step: 1 },
  { var: "PRESSURE",       label: "PRESSURE",    unit: "bar", key: "pressure",       min: 3.0, max: 4.3,  step: 0.1 },
  { var: "MOTOR_SPEED",    label: "MOTOR SPEED", unit: "RPM", key: "motor_speed",    min: 800, max: 1500, step: 50 },
  { var: "VALVE_POSITION", label: "VALVE POS",   unit: "%",   key: "valve_position", min: 10,  max: 90,   step: 1 },
];

/* ── API helpers ── */
async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : `HTTP ${res.status}`);
  return data;
}

/* ── Mini trend chart ── */
function Trend({ data, color, unit, height = 54 }) {
  const vals = data.slice(-40);
  if (vals.length < 2) return <div style={{ height, background: C.screen, borderRadius: 4 }} />;
  const mn = Math.min(...vals), mx = Math.max(...vals) || mn + 1;
  const w = 240, h = height;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - mn) / (mx - mn)) * (h - 8) - 4}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
      <text x={w - 2} y={12} textAnchor="end" fill={color} fontSize={9} fontFamily={C.mono}>
        {vals[vals.length - 1].toFixed(1)} {unit}
      </text>
    </svg>
  );
}

export default function HMIInterface({ asset, labData, plant, onBack }) {
  const [live, setLive]           = useState(null);
  const [backendUp, setBackendUp] = useState(true);
  const [now, setNow]             = useState(new Date());
  const [view, setView]           = useState("process");      // process | trends
  const [showSP, setShowSP]       = useState(true);
  const [spInput, setSpInput]     = useState({});             // valores editados de setpoint
  const [manual, setManual]       = useState(false);
  const [manualVals, setManualVals] = useState({ motor_speed: 1450, valve_position: 50 });
  const [busy, setBusy]           = useState(false);
  const [msg, setMsg]             = useState(null);
  const [trend, setTrend]         = useState({ temperature: [], pressure: [], motor_speed: [] });
  const manualTimer = useRef(null);

  const flash = useCallback((type, text, ms = 3000) => {
    setMsg({ type, text }); setTimeout(() => setMsg(null), ms);
  }, []);

  /* ── Polling del estado real ── */
  useEffect(() => {
    let timer;
    const poll = async () => {
      try {
        const data = await apiGet("/api/plant");
        setLive(data); setBackendUp(true); setNow(new Date());
        const p = data.process || {};
        setTrend(prev => ({
          temperature: [...prev.temperature.slice(-39), p.temperature ?? 0],
          pressure:    [...prev.pressure.slice(-39),    p.pressure ?? 0],
          motor_speed: [...prev.motor_speed.slice(-39), p.motor_speed ?? 0],
        }));
      } catch { setBackendUp(false); }
      timer = setTimeout(poll, 1000);
    };
    poll();
    return () => clearTimeout(timer);
  }, []);

  const proc    = live?.process || {};
  const status  = live?.plant?.status || "—";
  const running = status === "RUNNING";
  const line    = live?.plant?.line || "PRODUCTION LINE 01";
  const activeAlarms = live?.alarms?.active || [];

  /* ── Botones de producción ── */
  async function hmi(action) {
    setBusy(true);
    try { const d = await apiPost(`/api/hmi/${action}`); setLive(d); flash("ok", `${action.toUpperCase()} OK`); }
    catch (e) { flash("error", e.message || "Error"); }
    finally { setBusy(false); }
  }

  /* ── Aplicar setpoint (impacto real) ── */
  async function applySetpoint(sp) {
    const raw = spInput[sp.var];
    const value = Number(raw);
    if (raw == null || Number.isNaN(value)) { flash("error", `Valor inválido para ${sp.label}`); return; }
    setBusy(true);
    try { const d = await apiPost("/api/hmi/setpoint", { variable: sp.var, value }); setLive(d); flash("ok", `${sp.label} = ${value}${sp.unit}`); }
    catch (e) { flash("error", e.message || "Error al aplicar setpoint"); }
    finally { setBusy(false); }
  }

  /* ── Control manual directo (slider → /api/process/set) ── */
  function manualChange(key, value) {
    setManualVals(v => ({ ...v, [key]: value }));
    clearTimeout(manualTimer.current);
    manualTimer.current = setTimeout(async () => {
      try { const d = await apiPost("/api/process/set", { [key]: value }); setLive(d); }
      catch (e) { flash("error", e.message); }
    }, 180);
  }

  /* ── Alarmas ── */
  async function alarmAction(path, alarm_id) {
    try { await apiPost(`/api/alarms/${path}`, { alarm_id }); const d = await apiGet("/api/plant"); setLive(d); }
    catch (e) { flash("error", e.message); }
  }

  const bigBtn = (label, color, fn, active = false, dis = false) => (
    <button onClick={fn} disabled={busy || dis}
      style={{ flex: 1, background: active ? color : `${color}14`, border: `1px solid ${color}`,
        color: active ? "#06121f" : color, padding: "16px 0", cursor: busy || dis ? "not-allowed" : "pointer",
        fontFamily: C.mono, fontSize: 13, fontWeight: 700, letterSpacing: ".08em",
        borderRadius: 0, opacity: dis ? 0.4 : 1 }}>
      {label}
    </button>
  );

  const kpis = [
    { l: "TEMP",  v: proc.temperature,    u: "°C",  d: 1 },
    { l: "PRESS", v: proc.pressure,       u: "bar", d: 2 },
    { l: "SPEED", v: proc.motor_speed,    u: "RPM", d: 0 },
    { l: "VALVE", v: proc.valve_position, u: "%",   d: 0 },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg, fontFamily: "'Segoe UI',sans-serif" }}>

      {/* ── Marca / cabecera del panel ── */}
      <div style={{ background: "linear-gradient(180deg,#19293f,#101a2b)", padding: "8px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onBack} style={{ background: "none", border: `1px solid ${C.border}`, color: C.dim, padding: "3px 10px", borderRadius: 4, cursor: "pointer", fontSize: 9, fontFamily: C.mono }}>← VOLVER</button>
        <div>
          <div style={{ color: "#e2e8f0", fontWeight: 900, fontSize: 13, letterSpacing: ".15em" }}>{(asset.vendor || "SIEMENS").toUpperCase()}</div>
          <div style={{ color: C.dim, fontSize: 8, letterSpacing: ".1em" }}>{(asset.model || "SIMATIC HMI").toUpperCase()}</div>
        </div>
        <div style={{ color: C.text, fontSize: 10, marginLeft: "auto", fontFamily: C.mono }}>{asset.id} — {asset.name}</div>
        {msg && (
          <div style={{ color: msg.type === "ok" ? C.green : C.red, fontSize: 10, fontFamily: C.mono, border: `1px solid ${(msg.type === "ok" ? C.green : C.red)}44`, padding: "2px 8px", borderRadius: 4 }}>{msg.text}</div>
        )}
        {!backendUp && <div style={{ color: C.red, fontSize: 9, fontFamily: C.mono }}>⚠ sin backend</div>}
      </div>

      {/* ── Pantalla ── */}
      <div style={{ flex: 1, background: C.screen, display: "flex", flexDirection: "column", overflow: "auto", padding: 14 }}>

        {/* Barra de título */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 16px", display: "flex", alignItems: "center", marginBottom: 12, background: C.panel }}>
          <span style={{ color: C.text, fontFamily: C.mono, fontSize: 13, fontWeight: 700, letterSpacing: ".08em" }}>{line.toUpperCase()}</span>
          <div style={{ flex: 1 }} />
          <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 12 }}>{now.toLocaleTimeString("en-GB")}</span>
        </div>

        {/* Sub-cabecera: MAIN SCREEN / estado */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {["process", "trends"].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ background: "none", border: "none", color: view === v ? C.text : C.dim, fontFamily: C.mono, fontSize: 11, letterSpacing: ".1em", cursor: "pointer", padding: 0, textDecoration: view === v ? "underline" : "none" }}>
                {v === "process" ? "MAIN SCREEN" : "TRENDS"}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ color: running ? C.green : C.red, fontFamily: C.mono, fontSize: 12, fontWeight: 700, letterSpacing: ".1em" }}>{running ? "RUNNING" : "STOPPED"}</span>
        </div>

        {/* ── Mímico genérico / Manual / Trends ── */}
        {view === "process" && !manual && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "24px 0", minHeight: 150 }}>
            {/* Entrada / Proceso */}
            <div style={{ width: 86, height: 100, borderRadius: 8, border: `1px solid ${C.accent}55`, background: `linear-gradient(180deg,${C.accent}22,${C.accent}08)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ color: C.dim, fontSize: 9, fontFamily: C.mono }}>PROCESS</div>
              <div style={{ color: C.text, fontSize: 20, fontWeight: 700, fontFamily: C.mono }}>{Math.round(proc.production_rate ?? 0)}<span style={{ fontSize: 11 }}>%</span></div>
            </div>
            <div style={{ width: 36, height: 2, background: C.border }} />
            {/* Bomba P-01 */}
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: running ? C.accent : C.dim, fontSize: 22, animation: running ? "spin 2.5s linear infinite" : "none" }}>↻</div>
              <div style={{ color: C.dim, fontSize: 9, fontFamily: C.mono, marginTop: 4 }}>P-01</div>
            </div>
            <div style={{ width: 36, height: 2, background: C.border }} />
            {/* Máquina */}
            <div style={{ width: 150, height: 100, borderRadius: 8, border: `1px solid ${C.border}`, background: C.panel, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <div style={{ fontSize: 26 }}>🏭</div>
              <div style={{ color: C.accent, fontSize: 10, fontFamily: C.mono, letterSpacing: ".1em" }}>MACHINE</div>
            </div>
            {/* Válvula de salida V-01 */}
            <div style={{ textAlign: "center", marginLeft: 8 }}>
              <div style={{ color: C.dim, fontSize: 9, fontFamily: C.mono }}>V-01</div>
              <div style={{ width: 22, height: 22, margin: "6px auto", transform: "rotate(45deg)", background: (proc.valve_position ?? 0) > 85 ? C.red : C.accent }} />
              <div style={{ color: C.green, fontSize: 14, fontWeight: 700, fontFamily: C.mono }}>{Math.round(proc.valve_position ?? 0)}%</div>
            </div>
          </div>
        )}

        {view === "process" && manual && (
          <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ color: C.amber, fontFamily: C.mono, fontSize: 11, fontWeight: 700, letterSpacing: ".1em" }}>⚠ CONTROL MANUAL — las palancas escriben directo al proceso real</div>
            {[
              { key: "motor_speed",    label: "MOTOR SPEED", unit: "RPM", min: 0, max: 2000, step: 50 },
              { key: "valve_position", label: "VALVE POS",   unit: "%",   min: 0, max: 100,  step: 1 },
            ].map(s => (
              <div key={s.key} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: C.dim, fontSize: 10, fontFamily: C.mono }}>{s.label}</span>
                  <span style={{ color: C.accent, fontFamily: C.mono, fontSize: 13, fontWeight: 700 }}>{manualVals[s.key]} {s.unit}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={manualVals[s.key]}
                  onChange={e => manualChange(s.key, Number(e.target.value))}
                  style={{ width: "100%", accentColor: C.accent }} />
              </div>
            ))}
          </div>
        )}

        {view === "trends" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "6px 0" }}>
            {[
              { k: "temperature", label: "TEMPERATURE", unit: "°C",  color: "#f59e0b" },
              { k: "pressure",    label: "PRESSURE",    unit: "bar", color: "#22d3ee" },
              { k: "motor_speed", label: "MOTOR SPEED", unit: "RPM", color: "#22c55e" },
            ].map(t => (
              <div key={t.k} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px" }}>
                <div style={{ color: C.dim, fontSize: 9, fontFamily: C.mono, marginBottom: 4 }}>{t.label} ({t.unit})</div>
                <Trend data={trend[t.k] || []} color={t.color} unit={t.unit} />
              </div>
            ))}
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, margin: "4px 0 12px" }}>
          {kpis.map(({ l, v, u, d }) => (
            <div key={l} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ color: C.dim, fontSize: 9, fontFamily: C.mono, marginBottom: 4 }}>{l}</div>
              <div style={{ color: C.text, fontSize: 20, fontFamily: C.mono, fontWeight: 700 }}>{v == null ? "—" : Number(v).toFixed(d)}</div>
              <div style={{ color: C.dim, fontSize: 9, fontFamily: C.mono }}>{u}</div>
            </div>
          ))}
        </div>

        {/* PROCESS SETPOINTS */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 12 }}>
          <button onClick={() => setShowSP(s => !s)} style={{ width: "100%", background: C.panel, border: "none", borderBottom: showSP ? `1px solid ${C.border}` : "none", color: C.accent, fontFamily: C.mono, fontSize: 10, fontWeight: 700, letterSpacing: ".1em", padding: "10px 14px", cursor: "pointer", textAlign: "left" }}>
            {showSP ? "▼" : "▶"} PROCESS SETPOINTS
          </button>
          {showSP && (
            <div style={{ padding: "6px 14px 12px" }}>
              {SETPOINTS.map(sp => {
                const cur = proc[sp.key];
                const ok = cur != null && cur >= sp.min && cur <= sp.max;
                return (
                  <div key={sp.var} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}44` }}>
                    <div style={{ minWidth: 150 }}>
                      <div style={{ color: C.dim, fontSize: 9, fontFamily: C.mono }}>{sp.label}</div>
                      <div style={{ color: ok ? C.green : C.amber, fontSize: 14, fontFamily: C.mono, fontWeight: 700 }}>
                        {cur == null ? "—" : Number(cur).toFixed(sp.step < 1 ? 1 : 0)} <span style={{ fontSize: 9, color: C.dim }}>{sp.unit}</span>
                      </div>
                    </div>
                    <div style={{ flex: 1 }} />
                    <div style={{ color: ok ? C.green : C.amber, fontFamily: C.mono, fontSize: 9, border: `1px solid ${(ok ? C.green : C.amber)}55`, borderRadius: 4, padding: "2px 8px" }}>{ok ? "OK" : "OUT"}</div>
                    <input
                      type="number" step={sp.step}
                      placeholder={`${sp.min} → ${sp.max}`}
                      value={spInput[sp.var] ?? ""}
                      onChange={e => setSpInput(v => ({ ...v, [sp.var]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") applySetpoint(sp); }}
                      style={{ width: 96, background: C.screen, border: `1px solid ${C.border}`, color: C.text, padding: "5px 8px", borderRadius: 4, fontSize: 11, fontFamily: C.mono, outline: "none" }} />
                    <button onClick={() => applySetpoint(sp)} disabled={busy}
                      style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}`, color: C.accent, padding: "5px 12px", borderRadius: 4, cursor: busy ? "not-allowed" : "pointer", fontSize: 10, fontFamily: C.mono, fontWeight: 700 }}>SET</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ALARM STATUS */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, background: C.panel }}>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: activeAlarms.length ? `1px solid ${C.border}` : "none" }}>
            <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 10, letterSpacing: ".1em" }}>⚠ ALARM STATUS</span>
            <div style={{ flex: 1 }} />
            <span style={{ color: activeAlarms.length ? C.red : C.green, fontFamily: C.mono, fontSize: 10, fontWeight: 700 }}>
              {activeAlarms.length ? `${activeAlarms.length} ACTIVE ALARM(S)` : "NO ACTIVE ALARMS"}
            </span>
          </div>
          {activeAlarms.map(a => {
            const crit = (a.severity || "").toUpperCase() === "CRITICAL";
            const col = crit ? C.red : C.amber;
            return (
              <div key={a.alarm_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: `1px solid ${C.border}44` }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: col, animation: a.acknowledged ? "none" : "blink 1s infinite", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: col, fontFamily: C.mono, fontSize: 10, fontWeight: 700 }}>{a.severity} — {a.message}</div>
                  <div style={{ color: C.dim, fontSize: 9, fontFamily: C.mono }}>{a.alarm_id} · {a.source}{a.acknowledged ? " · ACK" : ""}</div>
                </div>
                {!a.acknowledged && (
                  <button onClick={() => alarmAction("acknowledge", a.alarm_id)}
                    style={{ background: "none", border: `1px solid ${col}`, color: col, padding: "3px 10px", borderRadius: 4, cursor: "pointer", fontSize: 9, fontFamily: C.mono }}>ACK</button>
                )}
                <button onClick={() => alarmAction("reset", a.alarm_id)}
                  style={{ background: "none", border: `1px solid ${C.border}`, color: C.dim, padding: "3px 10px", borderRadius: 4, cursor: "pointer", fontSize: 9, fontFamily: C.mono }}>RESET</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Botones grandes ── */}
      <div style={{ display: "flex", background: "#070d18", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        {bigBtn("START", C.green, () => hmi("start"), false, running)}
        {bigBtn("STOP", C.red, () => hmi("stop"), false, !running)}
        {bigBtn("RESET", C.accent, () => hmi("reset"))}
        {bigBtn(manual ? "MANUAL ●" : "MANUAL", C.amber, () => setManual(m => !m), manual)}
      </div>

      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}