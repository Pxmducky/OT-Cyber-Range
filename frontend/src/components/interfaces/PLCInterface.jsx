/**
 * PLCInterface.jsx
 * Interfaz completa de PLC conectada al MOTOR DE SIMULACIÓN del backend.
 *
 * Diferencia clave con la versión anterior:
 *   - El código ST ya NO se ejecuta en el navegador. Se envía al backend
 *     (/api/plc/program/*) donde el PLCRuntime lo ejecuta dentro del sandbox
 *     y sus salidas (MOTOR_SPEED, VALVE_POSITION, TEMPERATURE, PRESSURE, ALARM)
 *     cambian la PRODUCCIÓN REAL de la planta.
 *   - El alumno puede cargar CUALQUIER programa ST válido (VAR, aritmética,
 *     IF/ELSIF/ELSE, funciones LIMIT/MIN/MAX/ABS, etc.).
 *
 * Nota de arquitectura: el backend modela un único proceso físico (PLC-001).
 * Cualquier PLC abierto desde la planta controla ese proceso de laboratorio.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { equipmentAction } from "../../utils/otActions";

const API_URL = "http://127.0.0.1:8000";

/* ── Paleta ── */
const C = {
  bg:     "#05080f", bg2: "#080e18", bg3: "#0d1520",
  border: "#1e293b", accent: "#22d3ee", green: "#22c55e",
  red:    "#ef4444", amber: "#f59e0b", purple: "#818cf8",
  text:   "#e2e8f0", dim: "#4b5563",
  mono:   "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
};

/* ── Plantillas de código (todas válidas para el validador del backend) ── */
const CODE_TEMPLATES = {
  blank: `(* Escribe tu programa ST aquí *)
PROGRAM MAIN
VAR
  (* Declara tus variables internas aquí *)
END_VAR

NETWORK 1
(* Las salidas al proceso real son:
   MOTOR_SPEED, VALVE_POSITION, TEMPERATURE, PRESSURE, ALARM *)
IF TEMPERATURE > 75.0 THEN
  MOTOR_SPEED := 1200;
END_IF

END_PROGRAM`,

  temperature_control: `(* Control de temperatura con válvula y motor *)
PROGRAM MAIN
VAR
  Setpoint   : REAL := 70.0;
  Deadband   : REAL := 2.0;
  ValvePos   : REAL := 50.0;
END_VAR

NETWORK 1
IF TEMPERATURE > Setpoint + Deadband THEN
  ValvePos       := LIMIT(0.0, ValvePos + 5.0, 100.0);
  VALVE_POSITION := ValvePos;
  MOTOR_SPEED    := MAX(1300, 1600 - ABS(TEMPERATURE - Setpoint) * 10);
ELSIF TEMPERATURE < Setpoint - Deadband THEN
  ValvePos       := LIMIT(0.0, ValvePos - 5.0, 100.0);
  VALVE_POSITION := ValvePos;
  MOTOR_SPEED    := 1450;
END_IF

NETWORK 2
IF TEMPERATURE >= 80.0 THEN
  ALARM := TRUE;
ELSE
  ALARM := FALSE;
END_IF

END_PROGRAM`,

  pressure_relief: `(* Alivio de presión automático *)
PROGRAM MAIN
VAR
  MaxPressure : REAL := 4.2;
  MinPressure : REAL := 3.2;
END_VAR

NETWORK 1
IF PRESSURE > MaxPressure THEN
  VALVE_POSITION := 70;
ELSIF PRESSURE < MinPressure THEN
  VALVE_POSITION := 35;
END_IF

END_PROGRAM`,

  safe_default: `(* Programa seguro de referencia de la planta *)
PROGRAM MAIN
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
NETWORK 4
IF PRESSURE < 3.2 THEN
  VALVE_POSITION := 35;
END_IF
NETWORK 5
IF TEMPERATURE >= 78 THEN
  ALARM := TRUE;
END_IF
NETWORK 6
IF TEMPERATURE < 75 THEN
  ALARM := FALSE;
END_IF
END_PROGRAM`,
};

/* ── Helpers de API ── */
async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.detail;
    const errs = detail?.errors || (Array.isArray(detail) ? detail : null);
    throw { message: detail?.message || data?.message || `HTTP ${res.status}`, errors: errs };
  }
  return data;
}
async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── Documentación descargable del equipo ── */
function buildDocText(asset) {
  return `OT CYBER RANGE — DOCUMENTACIÓN DE EQUIPO
=========================================
Equipo:    ${asset.name || asset.id}
ID:         ${asset.id}
Tipo:       ${asset.type || "PLC"}
Fabricante: ${asset.vendor || "—"}
Modelo:     ${asset.model || "—"}
IP:         ${asset.ip || "—"}
VLAN:       ${asset.vlan || "—"}
Protocolos: ${(asset.protocols || []).join(", ") || "—"}

1. ¿QUÉ ES UN PLC?
Un Controlador Lógico Programable ejecuta un programa de forma cíclica
(scan cycle): lee entradas -> ejecuta la lógica -> escribe salidas. En este
laboratorio el programa se escribe en Structured Text (IEC 61131-3) y se
ejecuta en el motor de simulación del backend dentro de un sandbox.

2. CICLO DE SCAN
Cada ciclo (1 s en el laboratorio):
  a) Lee las variables del proceso (entradas).
  b) Ejecuta el programa MAIN.
  c) Escribe las salidas al proceso real.

3. VARIABLES DE PROCESO
Lectura (entradas):  START, STOP, TEMPERATURE, PRESSURE, MOTOR_SPEED,
                     VALVE_POSITION, PRODUCTION_RATE, ALARM
Escritura (salidas que IMPACTAN LA PRODUCCIÓN REAL):
  MOTOR_SPEED     RPM del motor (0-2000)
  VALVE_POSITION  % de apertura de válvula (0-100)
  TEMPERATURE     setpoint de temperatura (°C)
  PRESSURE        setpoint de presión (bar)
  ALARM           dispara/limpia la alarma del PLC
Cualquier otra variable que declares en VAR...END_VAR es memoria interna
del PLC y NO afecta la planta.

4. INSTRUCCIONES SOPORTADAS
  - PROGRAM <nombre> ... END_PROGRAM
  - VAR ... END_VAR  (BOOL/INT/REAL, con valor inicial opcional)
  - NETWORK <n>  (separador opcional)
  - IF / ELSIF / ELSE / END_IF  (anidables)
  - Asignación:  NOMBRE := expresión;
  - Aritmética:  + - * / MOD  y paréntesis
  - Lógica:      AND OR NOT, comparaciones = <> < <= > >=
  - Funciones:   LIMIT(min,x,max), MIN(a,b), MAX(a,b), ABS(x)

5. SEGURIDAD
El código se valida antes de descargarse al PLC y se ejecuta en un intérprete
aislado: nunca se ejecuta sobre el sistema host. Un programa mal diseñado SÍ
puede degradar el proceso simulado (ese es el objetivo didáctico).
`;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* ── Componente principal ── */
export default function PLCInterface({ asset, labData, plant, onBack }) {
  const [tab, setTab]           = useState("control");   // control | variables | diagnostics | docs | info
  const [code, setCode]         = useState(CODE_TEMPLATES.safe_default);
  const [live, setLive]         = useState(null);        // estado vivo del backend
  const [program, setProgram]   = useState(null);        // estado del programa PLC
  const [backendUp, setBackendUp] = useState(true);
  const [busy, setBusy]         = useState(false);
  const [errors, setErrors]     = useState([]);
  const [msg, setMsg]           = useState(null);        // { type, text }
  const [showTemplates, setShowTemplates] = useState(false);
  const [editVar, setEditVar]   = useState(null);        // { name, value }
  const editorRef = useRef(null);
  const STORAGE_KEY = `plc_code_${asset?.id || "default"}`;

  const flash = useCallback((type, text, ms = 3500) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), ms);
  }, []);

  /* ── Cargar programa actual del backend al montar ── */
  useEffect(() => {
    let cancelled = false;
    apiGet("/api/plc/program")
      .then(p => { if (!cancelled) { setProgram(p); if (p?.source) setCode(p.source); } })
      .catch(() => { if (!cancelled) setBackendUp(false); });
    return () => { cancelled = true; };
  }, [asset?.id]);

  /* ── Polling de estado vivo (proceso + programa) ── */
  useEffect(() => {
    let timer;
    const poll = async () => {
      try {
        const data = await apiGet("/api/plant");
        setLive(data);
        setProgram(data.plc_program);
        setBackendUp(true);
      } catch {
        setBackendUp(false);
      }
      timer = setTimeout(poll, 1000);
    };
    poll();
    return () => clearTimeout(timer);
  }, []);

  const proc    = live?.process || {};
  const cpuState = live?.plc?.cpu_state || "—";
  const progStatus = program?.status || "NOT_LOADED";
  const progRunning = !!program?.running;
  const scanCount = program?.execution_count ?? 0;

  /* ── Acciones de CONTROL DE CPU ── */
  async function cpu(action) {
    setBusy(true);
    try {
      await apiPost(`/api/plc/${action}`);
      // Cadena OT: replica la orden sobre el activo PLC para que se propague
      // a los equipos conectados (p.ej. STOP detiene los motores aguas abajo).
      try { await equipmentAction({ assetId: asset.id, assetType: asset.type, action: action.toUpperCase() }); } catch { /* backend sin topología */ }
      flash("ok", `CPU ${action.toUpperCase()} ejecutado`);
    } catch (e) { flash("error", e.message || "Error de CPU"); }
    finally { setBusy(false); }
  }

  /* ── Acciones del EDITOR / PROGRAMA ── */
  async function doValidate() {
    setBusy(true); setErrors([]);
    try {
      const r = await apiPost("/api/plc/program/validate", { source: code });
      if (r.valid) flash("ok", "Programa válido ✓");
      else { setErrors((r.errors || []).map(m => ({ message: m }))); flash("error", `${r.errors.length} error(es) de validación`); }
    } catch (e) { flash("error", e.message || "Error al validar"); }
    finally { setBusy(false); }
  }

  async function doDownload() {
    setBusy(true); setErrors([]);
    try {
      const p = await apiPost("/api/plc/program/download", { source: code });
      setProgram(p);
      flash("ok", `Descargado a PLC — v${p.version} (${p.status})`);
    } catch (e) {
      if (e.errors) setErrors(e.errors.map(m => ({ message: m })));
      flash("error", e.message || "Descarga rechazada");
    } finally { setBusy(false); }
  }

  async function runProgram() {
    setBusy(true);
    try { setProgram(await apiPost("/api/plc/program/run")); flash("ok", "Programa en ejecución ▶"); }
    catch (e) { flash("error", e.message || "No se pudo iniciar (¿descargaste el programa?)"); }
    finally { setBusy(false); }
  }
  async function stopProgram() {
    setBusy(true);
    try { setProgram(await apiPost("/api/plc/program/stop")); flash("ok", "Programa detenido ■"); }
    catch (e) { flash("error", e.message); } finally { setBusy(false); }
  }
  async function resetProgram() {
    setBusy(true); setErrors([]);
    try { setProgram(await apiPost("/api/plc/program/reset")); flash("ok", "Runtime reiniciado ↺"); }
    catch (e) { flash("error", e.message); } finally { setBusy(false); }
  }

  /* ── SAVE / LOAD LOCAL (navegador) ── */
  function saveLocal() {
    try { localStorage.setItem(STORAGE_KEY, code); flash("ok", "Código guardado en el navegador"); }
    catch { flash("error", "No se pudo guardar localmente"); }
  }
  function loadLocal() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) { setCode(saved); flash("ok", "Código cargado desde el navegador"); }
      else flash("error", "No hay código guardado para este PLC");
    } catch { flash("error", "No se pudo cargar"); }
  }

  function applyTemplate(key) {
    setCode(CODE_TEMPLATES[key]);
    setShowTemplates(false);
    setErrors([]);
  }

  /* ── Forzar variable de proceso (impacto real vía /api/process/set) ── */
  async function forceVar(name, raw) {
    setEditVar(null);
    const num = Number(raw);
    if (Number.isNaN(num)) { flash("error", "Valor numérico requerido"); return; }
    const map = { TEMPERATURE: "temperature", PRESSURE: "pressure", MOTOR_SPEED: "motor_speed", VALVE_POSITION: "valve_position" };
    const field = map[name];
    if (!field) { flash("error", "Variable no forzable"); return; }
    try { await apiPost("/api/process/set", { [field]: num }); flash("ok", `${name} forzada a ${num}`); }
    catch (e) { flash("error", e.message || "Error al forzar variable"); }
  }

  const stateColor = { RUN: C.green, STOP: C.amber, FAULT: C.red, ERROR: C.red }[cpuState] || C.dim;

  /* ── Variables de proceso en vivo para la tabla ── */
  const liveVars = [
    { name: "TEMPERATURE",    value: proc.temperature,    unit: "°C",  editable: true },
    { name: "PRESSURE",       value: proc.pressure,       unit: "bar", editable: true },
    { name: "MOTOR_SPEED",    value: proc.motor_speed,    unit: "RPM", editable: true },
    { name: "VALVE_POSITION", value: proc.valve_position, unit: "%",   editable: true },
    { name: "PRODUCTION_RATE",value: proc.production_rate,unit: "%",   editable: false },
    { name: "ALARM",          value: proc.process_alarm,  unit: "",    editable: false },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg, fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", background: C.bg2, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: `1px solid ${C.border}`, color: C.dim, padding: "4px 12px", borderRadius: 5, cursor: "pointer", fontSize: 10, fontFamily: C.mono }}>← VOLVER</button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.bg3, border: `1px solid ${C.accent}33`, borderRadius: 6, padding: "5px 12px" }}>
          <div style={{ fontSize: 14 }}>🖥</div>
          <div>
            <div style={{ color: C.accent, fontSize: 11, fontFamily: C.mono, fontWeight: 700, letterSpacing: ".05em" }}>{asset.id}</div>
            <div style={{ color: C.dim, fontSize: 9 }}>{asset.model || asset.vendor || "PLC"}</div>
          </div>
        </div>

        {/* CPU state (backend) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${stateColor}10`, border: `1px solid ${stateColor}44`, borderRadius: 5, padding: "5px 10px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: stateColor, boxShadow: `0 0 6px ${stateColor}`, animation: cpuState === "RUN" ? "blink 1s infinite" : "none" }} />
          <span style={{ color: stateColor, fontFamily: C.mono, fontSize: 11, fontWeight: 700 }}>CPU {cpuState}</span>
        </div>

        {/* Program status */}
        <div style={{ color: progRunning ? C.green : C.dim, fontFamily: C.mono, fontSize: 10 }}>
          PROG: {progStatus}{progRunning ? ` · scan #${scanCount}` : ""}
        </div>

        {msg && (
          <div style={{ color: msg.type === "ok" ? C.green : C.red, fontSize: 10, fontFamily: C.mono, background: `${msg.type === "ok" ? C.green : C.red}10`, padding: "3px 10px", borderRadius: 4, border: `1px solid ${msg.type === "ok" ? C.green : C.red}44` }}>
            {msg.text}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {!backendUp && (
          <div style={{ color: C.red, fontSize: 10, fontFamily: C.mono, border: `1px solid ${C.red}44`, borderRadius: 4, padding: "3px 10px" }}>
            ⚠ Backend sin conexión (inicia uvicorn)
          </div>
        )}
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, background: C.bg2, flexShrink: 0 }}>
        {[
          { id: "control",     label: "  CONTROL  " },
          { id: "variables",   label: "  VARIABLES  " },
          { id: "diagnostics", label: "  DIAGNÓSTICO  " },
          { id: "docs",        label: "  DOCUMENTACIÓN  " },
          { id: "info",        label: "  CPU INFO  " },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background: tab === id ? C.bg3 : "transparent", border: "none",
            borderBottom: tab === id ? `2px solid ${C.accent}` : "2px solid transparent",
            color: tab === id ? C.accent : C.dim, padding: "10px 16px", cursor: "pointer",
            fontFamily: C.mono, fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
          }}>{label}</button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* ═══════════ CONTROL TAB (operador + editor) ═══════════ */}
        {tab === "control" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* ── IZQUIERDA: PLC OPERATOR CONTROL ── */}
            <div style={{ width: 320, flexShrink: 0, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "auto" }}>
              <div style={{ padding: "10px 16px", background: C.bg2, borderBottom: `1px solid ${C.border}`, color: C.dim, fontSize: 10, fontFamily: C.mono, letterSpacing: ".1em", fontWeight: 700 }}>
                PLC OPERATOR CONTROL
              </div>

              <div style={{ padding: 16, display: "flex", gap: 8 }}>
                {[
                  { label: "RUN",   fn: () => cpu("run"),   col: C.green, dis: cpuState === "RUN" },
                  { label: "STOP",  fn: () => cpu("stop"),  col: C.red,   dis: cpuState === "STOP" },
                  { label: "RESET", fn: () => cpu("reset"), col: C.amber, dis: false },
                ].map(({ label, fn, col, dis }) => (
                  <button key={label} onClick={fn} disabled={dis || busy}
                    style={{ flex: 1, background: dis ? "transparent" : `${col}18`, border: `1px solid ${dis ? C.border : col}`, color: dis ? C.dim : col, padding: "10px 0", borderRadius: 5, cursor: dis || busy ? "not-allowed" : "pointer", fontFamily: C.mono, fontSize: 11, fontWeight: 700 }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* KPIs del proceso real */}
              <div style={{ padding: "0 16px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { k: "TEMPERATURA", v: proc.temperature,     u: "°C",  c: C.amber },
                  { k: "PRESIÓN",     v: proc.pressure,        u: "bar", c: C.accent },
                  { k: "MOTOR",       v: proc.motor_speed,     u: "RPM", c: C.green },
                  { k: "VÁLVULA",     v: proc.valve_position,  u: "%",   c: C.purple },
                  { k: "PRODUCCIÓN",  v: proc.production_rate, u: "%",   c: C.green },
                  { k: "ESTADO",      v: live?.plant?.status,  u: "",    c: live?.plant?.status === "RUNNING" ? C.green : C.red, text: true },
                ].map(({ k, v, u, c, text }) => (
                  <div key={k} style={{ background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 12px" }}>
                    <div style={{ color: C.dim, fontSize: 8, fontFamily: C.mono, letterSpacing: ".1em", marginBottom: 4 }}>{k}</div>
                    <div style={{ color: c, fontSize: 16, fontFamily: C.mono, fontWeight: 700 }}>
                      {v == null ? "—" : text ? v : Number(v).toFixed(u === "°C" || u === "bar" ? 1 : 0)}
                      <span style={{ fontSize: 9, color: C.dim, marginLeft: 3 }}>{u}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: "0 16px 16px", color: C.dim, fontSize: 9, fontFamily: C.mono, lineHeight: 1.6 }}>
                Los valores se leen en vivo del motor de simulación. Cuando el programa
                escribe una salida, estos KPIs cambian igual que la producción real.
              </div>
            </div>

            {/* ── DERECHA: PLC PROGRAM EDITOR ── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", background: C.bg2, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center" }}>
                <span style={{ color: C.dim, fontSize: 10, fontFamily: C.mono, letterSpacing: ".1em", fontWeight: 700 }}>PLC PROGRAM EDITOR</span>
                <div style={{ flex: 1 }} />
                <span style={{ color: C.dim, fontSize: 9, fontFamily: C.mono }}>
                  PROGRAM: {program?.name || "MAIN"} · MEM: {progStatus}
                </span>
              </div>

              {/* Toolbar plantillas */}
              <div style={{ display: "flex", gap: 8, padding: "8px 16px", background: C.bg3, borderBottom: `1px solid ${C.border}`, alignItems: "center", flexShrink: 0 }}>
                <span style={{ color: C.dim, fontSize: 9, fontFamily: C.mono, letterSpacing: ".1em" }}>PLANTILLAS:</span>
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowTemplates(p => !p)} style={{ background: C.bg2, border: `1px solid ${C.border}`, color: C.text, padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 9, fontFamily: C.mono }}>
                    Cargar plantilla ▾
                  </button>
                  {showTemplates && (
                    <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 100, background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 6, marginTop: 2, minWidth: 220, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
                      {Object.entries({ blank: "Plantilla vacía", safe_default: "Programa seguro (ref.)", temperature_control: "Control de temperatura", pressure_relief: "Alivio de presión" }).map(([k, v]) => (
                        <button key={k} onClick={() => applyTemplate(k)} style={{ display: "block", width: "100%", background: "none", border: "none", color: C.text, padding: "8px 14px", cursor: "pointer", textAlign: "left", fontSize: 10, fontFamily: C.mono, borderBottom: `1px solid ${C.border}44` }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ color: C.dim, fontSize: 9, fontFamily: C.mono }}>IEC 61131-3 Structured Text</span>
              </div>

              {/* Errores */}
              {errors.length > 0 && (
                <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", padding: "8px 16px", flexShrink: 0, maxHeight: 120, overflow: "auto" }}>
                  {errors.map((e, i) => (
                    <div key={i} style={{ color: C.red, fontSize: 10, fontFamily: C.mono }}>⚠ {e.message}</div>
                  ))}
                </div>
              )}

              {/* Editor */}
              <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 42, background: C.bg3, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", paddingTop: 16, overflowY: "hidden", pointerEvents: "none", zIndex: 2 }}>
                  {code.split("\n").map((_, i) => (
                    <div key={i} style={{ fontSize: 11, fontFamily: C.mono, color: "#1e3a5f", lineHeight: "1.6", height: 20, textAlign: "right", paddingRight: 8 }}>{i + 1}</div>
                  ))}
                </div>
                <textarea
                  ref={editorRef}
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  spellCheck={false}
                  style={{ position: "absolute", inset: 0, resize: "none", paddingLeft: 54, paddingTop: 16, paddingRight: 16, paddingBottom: 16, background: "transparent", border: "none", color: C.text, fontSize: 13, fontFamily: C.mono, lineHeight: "1.6", outline: "none", width: "100%", height: "100%", boxSizing: "border-box", caretColor: C.accent, zIndex: 1, whiteSpace: "pre", overflowX: "auto", tabSize: 2 }}
                  onKeyDown={e => {
                    if (e.key === "Tab") {
                      e.preventDefault();
                      const s = e.target.selectionStart; const v = code;
                      setCode(v.slice(0, s) + "  " + v.slice(s));
                      requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = s + 2; });
                    }
                  }}
                />
              </div>

              {/* Botonera del editor */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 16px", background: C.bg3, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                {[
                  { label: "VALIDATE",      fn: doValidate,  col: C.accent },
                  { label: "SAVE",          fn: saveLocal,   col: C.dim },
                  { label: "LOAD LOCAL",    fn: loadLocal,   col: C.dim },
                  { label: "DOWNLOAD TO PLC", fn: doDownload, col: C.purple },
                  { label: "RUN PROGRAM",   fn: runProgram,  col: C.green,  dis: progRunning },
                  { label: "STOP PROGRAM",  fn: stopProgram, col: C.red,    dis: !progRunning },
                  { label: "RESET PROGRAM", fn: resetProgram,col: C.amber },
                ].map(({ label, fn, col, dis }) => (
                  <button key={label} onClick={fn} disabled={busy || dis}
                    style={{ background: busy || dis ? "transparent" : `${col}18`, border: `1px solid ${busy || dis ? C.border : col}`, color: busy || dis ? C.dim : col, padding: "7px 14px", borderRadius: 5, cursor: busy || dis ? "not-allowed" : "pointer", fontFamily: C.mono, fontSize: 10, fontWeight: 700, letterSpacing: ".03em" }}>
                    {label}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <span style={{ color: C.dim, fontSize: 9, fontFamily: C.mono, alignSelf: "center" }}>
                  {code.split("\n").length} líneas · {code.length} chars
                </span>
              </div>

              <div style={{ padding: "6px 16px", background: C.bg2, borderTop: `1px solid ${C.border}`, color: C.dim, fontSize: 9, fontFamily: C.mono, flexShrink: 0 }}>
                Flujo: VALIDATE → DOWNLOAD TO PLC → RUN PROGRAM. El runtime del backend ejecuta el programa y cambia la producción real.
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ VARIABLES TAB ═══════════ */}
        {tab === "variables" && (
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            <div style={{ marginBottom: 12, color: C.dim, fontSize: 9, fontFamily: C.mono, letterSpacing: ".1em" }}>
              VARIABLES DE PROCESO EN VIVO — editar fuerza el valor en el proceso real (vía HMI/operador)
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: C.mono }}>
              <thead>
                <tr style={{ background: C.bg3 }}>
                  {["Variable", "Valor", "Unidad", "Acción"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: C.dim, fontSize: 9, letterSpacing: ".1em", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liveVars.map((v, i) => {
                  const isEditing = editVar?.name === v.name;
                  const isBool = typeof v.value === "boolean";
                  const col = isBool ? (v.value ? C.red : C.green) : C.accent;
                  return (
                    <tr key={v.name} style={{ background: i % 2 === 0 ? "transparent" : `${C.bg3}88`, borderBottom: `1px solid ${C.border}22` }}>
                      <td style={{ padding: "7px 12px", color: C.purple, fontWeight: 600 }}>{v.name}</td>
                      <td style={{ padding: "7px 12px", color: col, fontWeight: 700, minWidth: 120 }}>
                        {isEditing ? (
                          <input autoFocus defaultValue={v.value}
                            onBlur={e => forceVar(v.name, e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") forceVar(v.name, e.target.value); if (e.key === "Escape") setEditVar(null); }}
                            style={{ background: C.bg3, border: `1px solid ${C.accent}`, color: C.text, padding: "2px 6px", borderRadius: 4, fontSize: 11, fontFamily: C.mono, width: 100 }} />
                        ) : (
                          v.value == null ? "—" : isBool ? (v.value ? "TRUE" : "FALSE") : Number(v.value).toFixed(2)
                        )}
                      </td>
                      <td style={{ padding: "7px 12px", color: C.dim }}>{v.unit || "—"}</td>
                      <td style={{ padding: "7px 12px" }}>
                        {v.editable ? (
                          <button onClick={() => setEditVar({ name: v.name, value: v.value })}
                            style={{ background: "none", border: `1px solid ${C.border}`, color: C.dim, padding: "2px 8px", borderRadius: 3, cursor: "pointer", fontSize: 9, fontFamily: C.mono }}>
                            Forzar
                          </button>
                        ) : (
                          <span style={{ color: C.dim, fontSize: 9 }}>solo lectura</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══════════ DIAGNOSTICS TAB ═══════════ */}
        {tab === "diagnostics" && (
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            {program?.last_error ? (
              <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 6, padding: "10px 14px", marginBottom: 16, color: C.red, fontSize: 11, fontFamily: C.mono }}>
                ⚠ ÚLTIMO ERROR DEL RUNTIME: {program.last_error}
              </div>
            ) : null}

            <div style={{ color: C.dim, fontSize: 9, fontFamily: C.mono, letterSpacing: ".1em", marginBottom: 8 }}>EVENTOS DEL PLC (backend)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(live?.events || []).filter(e => (e.source || "").includes("PLC")).slice(-30).reverse().map((e, i) => {
                const sev = (e.severity || "INFO").toUpperCase();
                const c = sev === "CRITICAL" ? C.red : sev === "HIGH" ? C.amber : sev === "WARNING" ? C.amber : C.dim;
                return (
                  <div key={i} style={{ background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 10, fontFamily: C.mono }}>
                    <span style={{ color: c, fontWeight: 700 }}>[{sev}]</span>{" "}
                    <span style={{ color: C.accent }}>{e.event_type}</span>{" "}
                    <span style={{ color: C.text }}>{e.message}</span>
                  </div>
                );
              })}
              {(!live?.events || live.events.filter(e => (e.source || "").includes("PLC")).length === 0) && (
                <div style={{ color: C.dim, fontSize: 10, fontFamily: C.mono, padding: 12 }}>Sin eventos del PLC todavía.</div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════ DOCS TAB ═══════════ */}
        {tab === "docs" && (
          <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ color: C.accent, fontFamily: C.mono, fontSize: 14, margin: 0 }}>DOCUMENTACIÓN DEL EQUIPO</h3>
              <div style={{ flex: 1 }} />
              <button onClick={() => downloadText(`${asset.id}_doc.txt`, buildDocText(asset))}
                style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}`, color: C.accent, padding: "6px 14px", borderRadius: 5, cursor: "pointer", fontSize: 10, fontFamily: C.mono, fontWeight: 700 }}>
                ⬇ Descargar documentación
              </button>
            </div>
            <pre style={{ color: C.text, fontSize: 12, fontFamily: C.mono, lineHeight: 1.6, whiteSpace: "pre-wrap", background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
              {buildDocText(asset)}
            </pre>
          </div>
        )}

        {/* ═══════════ CPU INFO TAB ═══════════ */}
        {tab === "info" && (
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { label: "Device ID", value: asset.id },
                { label: "Nombre", value: asset.name },
                { label: "Tipo", value: asset.type },
                { label: "Vendor", value: asset.vendor },
                { label: "Modelo", value: asset.model || "—" },
                { label: "IP Address", value: asset.ip || "—" },
                { label: "VLAN", value: asset.vlan || "—" },
                { label: "Purdue Level", value: asset.purdueLevel != null ? `Nivel ${asset.purdueLevel}` : "—" },
                { label: "Protocolos", value: (asset.protocols || []).join(", ") || "—" },
                { label: "Firmware", value: asset.firmware || "—" },
                { label: "CPU State", value: cpuState },
                { label: "Programa", value: `${progStatus}${progRunning ? " (RUN)" : ""}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 14px" }}>
                  <div style={{ color: C.dim, fontSize: 9, fontFamily: C.mono, letterSpacing: ".1em", marginBottom: 4 }}>{label}</div>
                  <div style={{ color: C.text, fontSize: 12, fontFamily: C.mono }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:.3} }
        textarea::-webkit-scrollbar { width:8px; height:8px; }
        textarea::-webkit-scrollbar-track { background:${C.bg3}; }
        textarea::-webkit-scrollbar-thumb { background:${C.border}; border-radius:4px; }
      `}</style>
    </div>
  );
}