/**
 * PLCInterface.jsx
 * Interfaz completa de PLC — editor ST real, tabla de variables, diagnóstico.
 * El usuario puede cargar CUALQUIER código ST y se ejecuta dentro del sandbox.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { executeSTCode, compileSTCode, extractVarDeclarations, formatVarValue } from "../../utils/stInterpreter";

/* ── Paleta ── */
const C = {
  bg:       "#05080f",
  bg2:      "#080e18",
  bg3:      "#0d1520",
  border:   "#1e293b",
  accent:   "#22d3ee",   // Siemens teal
  green:    "#22c55e",
  red:      "#ef4444",
  amber:    "#f59e0b",
  purple:   "#818cf8",
  text:     "#e2e8f0",
  dim:      "#4b5563",
  mono:     "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
};

/* ── Syntax highlighter simple (regex-based) ── */
function highlightST(code) {
  const escape = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return escape(code)
    .replace(/\(\*[\s\S]*?\*\)/g, m => `<span style="color:#4b5563;font-style:italic">${m}</span>`)
    .replace(/(\/\/[^\n]*)/g, `<span style="color:#4b5563;font-style:italic">$1</span>`)
    .replace(/\b(PROGRAM|END_PROGRAM|VAR|END_VAR|VAR_INPUT|VAR_OUTPUT|IF|THEN|ELSIF|ELSE|END_IF|FOR|TO|BY|DO|END_FOR|WHILE|END_WHILE|REPEAT|UNTIL|CASE|OF|END_CASE|RETURN|EXIT|NETWORK|AND|OR|NOT|XOR|MOD|DIV)\b/gi,
      `<span style="color:#818cf8;font-weight:700">$1</span>`)
    .replace(/\b(BOOL|INT|UINT|DINT|REAL|LREAL|STRING|BYTE|WORD|TIME)\b/gi,
      `<span style="color:#06b6d4">$1</span>`)
    .replace(/\b(TRUE|FALSE)\b/gi,
      `<span style="color:#f97316;font-weight:700">$1</span>`)
    .replace(/(:=|&lt;&gt;|&lt;=|&gt;=|[=&lt;&gt;+\-*/])/g,
      `<span style="color:#f59e0b">$1</span>`)
    .replace(/\b(\d+\.?\d*)\b/g,
      `<span style="color:#22c55e">$1</span>`);
}

/* ── Plantillas de código ── */
const CODE_TEMPLATES = {
  blank: `(* Escribe tu código ST aquí *)
PROGRAM MAIN
VAR
  (* Declara tus variables aquí *)
END_VAR

NETWORK 1
  (* Lógica de control *)

END_PROGRAM`,

  temperature_control: `(* Control de temperatura con válvula y alarma *)
PROGRAM MAIN
VAR
  Temperature  : REAL := 68.4;
  Setpoint     : REAL := 70.0;
  Deadband     : REAL := 2.0;
  Valve_Pos    : REAL := 50.0;
  Motor_Speed  : INT  := 1450;
  Alarm_High   : BOOL := FALSE;
  Alarm_HiHi   : BOOL := FALSE;
END_VAR

NETWORK 1
(* Control PI simplificado *)
IF Temperature > Setpoint + Deadband THEN
  Valve_Pos   := LIMIT(0.0, Valve_Pos + 5.0, 100.0);
  Motor_Speed := 1600;
ELSIF Temperature < Setpoint - Deadband THEN
  Valve_Pos   := LIMIT(0.0, Valve_Pos - 5.0, 100.0);
  Motor_Speed := 1300;
END_IF

NETWORK 2
(* Alarmas ISA-18.2 *)
Alarm_High  := Temperature >= 80.0;
Alarm_HiHi  := Temperature >= 90.0;

END_PROGRAM`,

  production_counter: `(* Contador de piezas con reset *)
PROGRAM MAIN
VAR
  Sensor_Signal  : BOOL := FALSE;
  Piece_Count    : INT  := 0;
  Batch_Target   : INT  := 100;
  Batch_Complete : BOOL := FALSE;
  Reset_Button   : BOOL := FALSE;
  Conveyor_Run   : BOOL := TRUE;
END_VAR

NETWORK 1
(* Reset del contador *)
IF Reset_Button THEN
  Piece_Count    := 0;
  Batch_Complete := FALSE;
END_IF

NETWORK 2
(* Contar flanco positivo del sensor *)
IF Sensor_Signal AND Conveyor_Run THEN
  Piece_Count := Piece_Count + 1;
END_IF

NETWORK 3
(* Detectar lote completo *)
IF Piece_Count >= Batch_Target THEN
  Batch_Complete := TRUE;
  Conveyor_Run   := FALSE;
END_IF

END_PROGRAM`,

  safety_interlock: `(* Enclavamiento de seguridad multi-condición *)
PROGRAM MAIN
VAR
  Door_Closed      : BOOL := TRUE;
  Guard_OK         : BOOL := TRUE;
  EStop_OK         : BOOL := TRUE;
  Pressure_OK      : BOOL := TRUE;
  Temp_OK          : BOOL := TRUE;
  Motor_Enable     : BOOL := FALSE;
  Safety_Fault     : BOOL := FALSE;
  Fault_Code       : INT  := 0;
END_VAR

NETWORK 1
(* Calcular código de fallo *)
Fault_Code := 0;
IF NOT Door_Closed  THEN Fault_Code := 1; END_IF
IF NOT Guard_OK     THEN Fault_Code := 2; END_IF
IF NOT EStop_OK     THEN Fault_Code := 3; END_IF
IF NOT Pressure_OK  THEN Fault_Code := 4; END_IF
IF NOT Temp_OK      THEN Fault_Code := 5; END_IF

NETWORK 2
(* Habilitar motor solo si todo OK *)
Safety_Fault := Fault_Code > 0;
Motor_Enable := Door_Closed AND Guard_OK AND EStop_OK
                AND Pressure_OK AND Temp_OK;

END_PROGRAM`,
};

/* ── Componente principal ── */
export default function PLCInterface({ asset, labData, plant, onBack }) {
  const [tab,         setTab]         = useState("editor");    // editor | variables | diagnostics | info
  const [code,        setCode]        = useState("");
  const [plcState,    setPlcState]    = useState("STOP");      // STOP | RUN | ERROR
  const [variables,   setVariables]   = useState({});          // var dict
  const [execResult,  setExecResult]  = useState(null);
  const [scanLog,     setScanLog]     = useState([]);
  const [scanCount,   setScanCount]   = useState(0);
  const [scanTime,    setScanTime]    = useState(0);
  const [editingVar,  setEditingVar]  = useState(null);        // { name, value }
  const [newVarName,  setNewVarName]  = useState("");
  const [newVarVal,   setNewVarVal]   = useState("");
  const [errors,      setErrors]      = useState([]);
  const [uploadMsg,   setUploadMsg]   = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const scanRef     = useRef(null);
  const editorRef   = useRef(null);
  const scanCountRef = useRef(0);

  /* ── Cargar variables del Excel si están disponibles ── */
  useEffect(() => {
    const assetVars = labData?.variables?.filter(v => v.assetId === asset.id) ?? [];
    if (assetVars.length > 0) {
      const dict = {};
      assetVars.forEach(v => {
        const val = v.type?.toUpperCase() === 'BOOL'
          ? Boolean(v.initialValue)
          : parseFloat(v.initialValue) || 0;
        dict[v.variable] = val;
      });
      setVariables(dict);
    } else {
      // Variables por defecto para el PLC
      setVariables({ Temperature: 68.4, Pressure: 3.82, Motor_Speed: 1450, Valve_Pos: 50, Alarm: false });
    }
    setCode(CODE_TEMPLATES.blank);
  }, [asset.id]);

  /* ── Ciclo de scan (se ejecuta mientras RUN) ── */
  useEffect(() => {
    if (plcState !== "RUN") {
      clearInterval(scanRef.current);
      return;
    }
    scanRef.current = setInterval(() => {
      const t0 = performance.now();
      const result = executeSTCode(code, { ...variables });
      const dt = performance.now() - t0;

      if (result.success) {
        setVariables(result.vars);
        setExecResult(result);
        setPlcState("RUN");
        setErrors([]);
        setScanTime(dt.toFixed(2));
        scanCountRef.current++;
        setScanCount(scanCountRef.current);

        // Registrar cambios en log
        if (Object.keys(result.changedVars).length > 0) {
          const entry = {
            ts: new Date().toLocaleTimeString(),
            scan: scanCountRef.current,
            changes: result.changedVars,
          };
          setScanLog(prev => [entry, ...prev].slice(0, 50));
        }
      } else {
        setErrors(result.errors);
        setPlcState("ERROR");
        clearInterval(scanRef.current);
      }
    }, 500); // scan cada 500ms

    return () => clearInterval(scanRef.current);
  }, [plcState, code, variables]);

  /* ── Acciones ── */
  function handleLoad() {
    const { errors: syntaxErrors } = compileSTCode(code);
    if (syntaxErrors.length > 0) {
      setErrors(syntaxErrors);
      setPlcState("ERROR");
      setUploadMsg({ type: "error", text: `Error de sintaxis: ${syntaxErrors[0].message}` });
      setTimeout(() => setUploadMsg(null), 4000);
      return;
    }
    // Merge any VAR declarations into variables dict
    const declaredVars = extractVarDeclarations(code);
    setVariables(prev => ({ ...prev, ...declaredVars }));
    setErrors([]);
    setUploadMsg({ type: "ok", text: "Código cargado correctamente ✓" });
    setTimeout(() => setUploadMsg(null), 3000);
    // Execute one scan immediately
    const result = executeSTCode(code, { ...variables, ...declaredVars });
    if (result.success) setExecResult(result);
  }

  function handleRun() {
    const { errors: syntaxErrors } = compileSTCode(code);
    if (syntaxErrors.length > 0) { handleLoad(); return; }
    setPlcState("RUN");
    setScanLog([]);
    scanCountRef.current = 0;
    setScanCount(0);
  }

  function handleStop()  { setPlcState("STOP"); }
  function handleReset() { setPlcState("STOP"); setScanCount(0); setScanLog([]); setExecResult(null); setErrors([]); scanCountRef.current = 0; }

  function applyTemplate(key) {
    setCode(CODE_TEMPLATES[key]);
    const decls = extractVarDeclarations(CODE_TEMPLATES[key]);
    setVariables(prev => ({ ...prev, ...decls }));
    setShowTemplates(false);
    setPlcState("STOP");
    setErrors([]);
  }

  function addVariable() {
    if (!newVarName.trim()) return;
    const val = newVarVal.toUpperCase() === 'TRUE' ? true
              : newVarVal.toUpperCase() === 'FALSE' ? false
              : isNaN(Number(newVarVal)) ? newVarVal
              : Number(newVarVal);
    setVariables(prev => ({ ...prev, [newVarName.trim()]: val }));
    setNewVarName(""); setNewVarVal("");
  }

  function modifyVarValue(name, raw) {
    const val = raw.toUpperCase() === 'TRUE' ? true
              : raw.toUpperCase() === 'FALSE' ? false
              : isNaN(Number(raw)) ? raw : Number(raw);
    setVariables(prev => ({ ...prev, [name]: val }));
    setEditingVar(null);
  }

  /* ── Status bar ── */
  const stateColor = { STOP: C.amber, RUN: C.green, ERROR: C.red }[plcState];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg, fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 20px", background:C.bg2, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"4px 12px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono }}>
          ← VOLVER
        </button>

        {/* CPU badge */}
        <div style={{ display:"flex", alignItems:"center", gap:8, background:C.bg3, border:`1px solid ${C.accent}33`, borderRadius:6, padding:"5px 12px" }}>
          <div style={{ fontSize:14 }}>🖥</div>
          <div>
            <div style={{ color:C.accent, fontSize:11, fontFamily:C.mono, fontWeight:700, letterSpacing:".05em" }}>{asset.id}</div>
            <div style={{ color:C.dim, fontSize:9 }}>{asset.model || asset.vendor}</div>
          </div>
        </div>

        {/* Estado */}
        <div style={{ display:"flex", alignItems:"center", gap:6, background:`${stateColor}10`, border:`1px solid ${stateColor}44`, borderRadius:5, padding:"5px 10px" }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:stateColor, boxShadow:`0 0 6px ${stateColor}`, animation: plcState==="RUN" ? "blink 1s infinite" : "none" }}/>
          <span style={{ color:stateColor, fontFamily:C.mono, fontSize:11, fontWeight:700 }}>{plcState}</span>
        </div>

        {/* Upload message */}
        {uploadMsg && (
          <div style={{ color: uploadMsg.type === "ok" ? C.green : C.red, fontSize:10, fontFamily:C.mono, background:`${uploadMsg.type==="ok"?C.green:C.red}10`, padding:"3px 10px", borderRadius:4, border:`1px solid ${uploadMsg.type==="ok"?C.green:C.red}44` }}>
            {uploadMsg.text}
          </div>
        )}

        <div style={{ flex:1 }}/>

        {/* Controls */}
        {[
          { label:"▶ RUN",    fn: handleRun,   col: C.green,  dis: plcState === "RUN"   },
          { label:"■ STOP",   fn: handleStop,  col: C.red,    dis: plcState === "STOP"  },
          { label:"↺ RESET",  fn: handleReset, col: C.amber,  dis: false                },
          { label:"↑ CARGAR", fn: handleLoad,  col: C.accent, dis: false                },
        ].map(({ label, fn, col, dis }) => (
          <button key={label} onClick={fn} disabled={dis}
            style={{ background: dis ? "transparent" : `${col}18`, border:`1px solid ${dis ? C.border : col}`, color: dis ? C.dim : col, padding:"6px 14px", borderRadius:5, cursor: dis ? "not-allowed" : "pointer", fontFamily:C.mono, fontSize:10, fontWeight:700, letterSpacing:".04em", transition:"all .15s" }}>
            {label}
          </button>
        ))}

        {/* Scan info */}
        {plcState === "RUN" && (
          <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, textAlign:"right" }}>
            <div>SCAN #{scanCount}</div>
            <div>{scanTime} ms</div>
          </div>
        )}
      </div>

      {/* ── TABS ── */}
      <div style={{ display:"flex", gap:0, borderBottom:`1px solid ${C.border}`, background:C.bg2, flexShrink:0 }}>
        {[
          { id:"editor",      label:"  EDITOR  " },
          { id:"variables",   label:"  VARIABLES  " },
          { id:"diagnostics", label:"  DIAGNÓSTICO  " },
          { id:"info",        label:"  CPU INFO  " },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background:  tab === id ? C.bg3 : "transparent",
            border:      "none",
            borderBottom: tab === id ? `2px solid ${C.accent}` : "2px solid transparent",
            color:       tab === id ? C.accent : C.dim,
            padding:     "10px 16px", cursor:"pointer", fontFamily:C.mono, fontSize:10, fontWeight:700, letterSpacing:".08em", transition:"all .15s",
          }}>{label}</button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>

        {/* ─── EDITOR TAB ─── */}
        {tab === "editor" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Toolbar */}
            <div style={{ display:"flex", gap:8, padding:"8px 16px", background:C.bg3, borderBottom:`1px solid ${C.border}`, flexShrink:0, alignItems:"center" }}>
              <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em" }}>PLANTILLAS:</span>
              <div style={{ position:"relative" }}>
                <button onClick={() => setShowTemplates(p => !p)} style={{ background:C.bg2, border:`1px solid ${C.border}`, color:C.text, padding:"4px 10px", borderRadius:4, cursor:"pointer", fontSize:9, fontFamily:C.mono }}>
                  Cargar plantilla ▾
                </button>
                {showTemplates && (
                  <div style={{ position:"absolute", top:"100%", left:0, zIndex:100, background:C.bg2, border:`1px solid ${C.border}`, borderRadius:6, marginTop:2, minWidth:220, boxShadow:"0 8px 24px rgba(0,0,0,.5)" }}>
                    {Object.entries({ blank:"Plantilla vacía", temperature_control:"Control de temperatura", production_counter:"Contador de producción", safety_interlock:"Enclavamiento de seguridad" }).map(([k,v]) => (
                      <button key={k} onClick={() => applyTemplate(k)} style={{ display:"block", width:"100%", background:"none", border:"none", color:C.text, padding:"8px 14px", cursor:"pointer", textAlign:"left", fontSize:10, fontFamily:C.mono, borderBottom:`1px solid ${C.border}44` }}
                        onMouseEnter={e => e.target.style.background = C.bg3}
                        onMouseLeave={e => e.target.style.background = "none"}>
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ flex:1 }}/>
              <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>IEC 61131-3 Structured Text</span>
            </div>

            {/* Error banner */}
            {errors.length > 0 && (
              <div style={{ background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.3)", padding:"8px 16px", flexShrink:0 }}>
                {errors.map((e, i) => (
                  <div key={i} style={{ color:C.red, fontSize:10, fontFamily:C.mono }}>⚠ {e.message}</div>
                ))}
              </div>
            )}

            {/* Code editor — textarea + highlight overlay */}
            <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
              {/* Line numbers */}
              <div style={{
                position:"absolute", left:0, top:0, bottom:0, width:42,
                background:C.bg3, borderRight:`1px solid ${C.border}`,
                display:"flex", flexDirection:"column", paddingTop:16,
                overflowY:"hidden", pointerEvents:"none", zIndex:2,
              }}>
                {code.split('\n').map((_, i) => (
                  <div key={i} style={{ fontSize:11, fontFamily:C.mono, color:"#1e3a5f", lineHeight:"1.6", height:20, textAlign:"right", paddingRight:8 }}>
                    {i+1}
                  </div>
                ))}
              </div>

              {/* Actual textarea */}
              <textarea
                ref={editorRef}
                value={code}
                onChange={e => setCode(e.target.value)}
                spellCheck={false}
                style={{
                  position:"absolute", inset:0, resize:"none",
                  paddingLeft:54, paddingTop:16, paddingRight:16, paddingBottom:16,
                  background:"transparent", border:"none",
                  color:C.text, fontSize:13, fontFamily:C.mono, lineHeight:"1.6",
                  outline:"none", width:"100%", height:"100%", boxSizing:"border-box",
                  caretColor: C.accent, zIndex:1,
                  whiteSpace:"pre", overflowX:"auto",
                  tabSize:2,
                }}
                onKeyDown={e => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const s = e.target.selectionStart;
                    const v = code;
                    setCode(v.slice(0, s) + '  ' + v.slice(s));
                    requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = s + 2; });
                  }
                }}
              />
            </div>

            {/* Status bar bottom */}
            <div style={{ display:"flex", gap:16, padding:"4px 16px", background:C.bg3, borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
              <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>{code.split('\n').length} líneas</span>
              <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>{code.length} chars</span>
              <span style={{ color: plcState === "RUN" ? C.green : C.dim, fontSize:9, fontFamily:C.mono }}>
                {plcState === "RUN" ? `● Ejecutando (scan #${scanCount})` : "○ Detenido"}
              </span>
              <div style={{ flex:1 }}/>
              <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>Tab=2esp · ↑CARGAR para validar · ▶RUN para ejecutar</span>
            </div>
          </div>
        )}

        {/* ─── VARIABLES TAB ─── */}
        {tab === "variables" && (
          <div style={{ flex:1, overflow:"auto", padding:16 }}>
            <div style={{ marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em" }}>
                TABLA DE VARIABLES — {Object.keys(variables).length} variables
              </span>
              <div style={{ flex:1 }}/>
              {plcState === "RUN" && (
                <div style={{ color:C.green, fontSize:9, fontFamily:C.mono, display:"flex", gap:4, alignItems:"center" }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:C.green, animation:"blink 1s infinite" }}/>
                  ONLINE — scan #{scanCount}
                </div>
              )}
            </div>

            {/* Variable table */}
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, fontFamily:C.mono }}>
              <thead>
                <tr style={{ background:C.bg3 }}>
                  {["Variable","Valor","Tipo","Acción"].map(h => (
                    <th key={h} style={{ padding:"8px 12px", textAlign:"left", color:C.dim, fontSize:9, letterSpacing:".1em", borderBottom:`1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(variables).map(([name, val], i) => {
                  const isEditing = editingVar?.name === name;
                  const typeLabel = typeof val === 'boolean' ? 'BOOL' : Number.isInteger(val) ? 'INT' : 'REAL';
                  const valColor  = typeof val === 'boolean' ? (val ? C.green : C.red) : typeof val === 'number' ? C.accent : C.text;
                  return (
                    <tr key={name} style={{ background: i%2===0 ? "transparent" : `${C.bg3}88`, borderBottom:`1px solid ${C.border}22` }}>
                      <td style={{ padding:"7px 12px", color:C.purple, fontWeight:600 }}>{name}</td>
                      <td style={{ padding:"7px 12px", color:valColor, fontWeight:700, minWidth:120 }}>
                        {isEditing ? (
                          <input
                            autoFocus
                            defaultValue={formatVarValue(val)}
                            onBlur={e => modifyVarValue(name, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') modifyVarValue(name, e.target.value); if (e.key === 'Escape') setEditingVar(null); }}
                            style={{ background:C.bg3, border:`1px solid ${C.accent}`, color:C.text, padding:"2px 6px", borderRadius:4, fontSize:11, fontFamily:C.mono, width:100 }}
                          />
                        ) : (
                          formatVarValue(val)
                        )}
                      </td>
                      <td style={{ padding:"7px 12px", color:C.dim }}>{typeLabel}</td>
                      <td style={{ padding:"7px 12px" }}>
                        <button onClick={() => setEditingVar({ name, value: val })}
                          style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"2px 8px", borderRadius:3, cursor:"pointer", fontSize:9, fontFamily:C.mono }}
                          onMouseEnter={e => e.target.style.borderColor=C.accent}
                          onMouseLeave={e => e.target.style.borderColor=C.border}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Add variable */}
            <div style={{ marginTop:16, padding:12, background:C.bg3, borderRadius:8, border:`1px solid ${C.border}` }}>
              <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em", marginBottom:8 }}>AGREGAR VARIABLE</div>
              <div style={{ display:"flex", gap:8 }}>
                <input value={newVarName} onChange={e => setNewVarName(e.target.value)} placeholder="Nombre"
                  style={{ background:C.bg2, border:`1px solid ${C.border}`, color:C.text, padding:"6px 10px", borderRadius:5, fontSize:11, fontFamily:C.mono, width:160, outline:"none" }}/>
                <input value={newVarVal} onChange={e => setNewVarVal(e.target.value)} placeholder="Valor inicial"
                  style={{ background:C.bg2, border:`1px solid ${C.border}`, color:C.text, padding:"6px 10px", borderRadius:5, fontSize:11, fontFamily:C.mono, width:120, outline:"none" }}/>
                <button onClick={addVariable}
                  style={{ background:`${C.accent}18`, border:`1px solid ${C.accent}44`, color:C.accent, padding:"6px 14px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono }}>
                  + Agregar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── DIAGNOSTICS TAB ─── */}
        {tab === "diagnostics" && (
          <div style={{ flex:1, overflow:"auto", padding:16 }}>
            {/* Error list */}
            {errors.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em", marginBottom:8 }}>ERRORES</div>
                {errors.map((e, i) => (
                  <div key={i} style={{ background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.2)", borderRadius:6, padding:"8px 12px", marginBottom:6, color:C.red, fontSize:11, fontFamily:C.mono }}>
                    ⚠ {e.message}
                  </div>
                ))}
              </div>
            )}

            {/* Scan log */}
            <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em", marginBottom:8 }}>
              LOG DE CAMBIOS — últimas {scanLog.length} entradas
            </div>
            {scanLog.length === 0 ? (
              <div style={{ color:C.dim, fontSize:10, fontFamily:C.mono, padding:12 }}>
                {plcState === "RUN" ? "Esperando cambios de variables..." : "Ejecuta el programa en modo RUN para ver cambios."}
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {scanLog.map((entry, i) => (
                  <div key={i} style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:6, padding:"8px 12px", fontSize:10, fontFamily:C.mono }}>
                    <div style={{ color:C.dim, marginBottom:4 }}>[{entry.ts}] Scan #{entry.scan}</div>
                    {Object.entries(entry.changes).map(([k, { from, to }]) => (
                      <div key={k} style={{ color:C.text }}>
                        <span style={{ color:C.purple }}>{k}</span>
                        <span style={{ color:C.dim }}> : </span>
                        <span style={{ color:C.red }}>{formatVarValue(from)}</span>
                        <span style={{ color:C.dim }}> → </span>
                        <span style={{ color:C.green }}>{formatVarValue(to)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── CPU INFO TAB ─── */}
        {tab === "info" && (
          <div style={{ flex:1, overflow:"auto", padding:16 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              {[
                { label:"Device ID",     value: asset.id },
                { label:"Nombre",        value: asset.name },
                { label:"Tipo",          value: asset.type },
                { label:"Vendor",        value: asset.vendor },
                { label:"Modelo",        value: asset.model || "—" },
                { label:"IP Address",    value: asset.ip || "—" },
                { label:"VLAN",          value: asset.vlan || "—" },
                { label:"Purdue Level",  value: `Nivel ${asset.purdueLevel}` },
                { label:"Protocolos",    value: (asset.protocols||[]).join(", ") || "—" },
                { label:"Firmware",      value: asset.firmware || "—" },
                { label:"Estado",        value: asset.status || "—" },
                { label:"CPU State",     value: plcState },
              ].map(({ label, value }) => (
                <div key={label} style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:6, padding:"10px 14px" }}>
                  <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em", marginBottom:4 }}>{label}</div>
                  <div style={{ color:C.text, fontSize:12, fontFamily:C.mono }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Memory bar */}
            <div style={{ marginTop:16, background:C.bg3, border:`1px solid ${C.border}`, borderRadius:6, padding:"12px 14px" }}>
              <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em", marginBottom:8 }}>VARIABLES EN MEMORIA</div>
              <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                <div style={{ flex:1, height:8, background:C.bg2, borderRadius:4, overflow:"hidden" }}>
                  <div style={{ width:`${Math.min(100, Object.keys(variables).length * 5)}%`, height:"100%", background:C.accent, borderRadius:4 }}/>
                </div>
                <span style={{ color:C.accent, fontSize:10, fontFamily:C.mono, minWidth:60 }}>{Object.keys(variables).length} vars</span>
              </div>
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