/**
 * RecoveryConsole.jsx
 * Guía paso a paso de respuesta a incidentes OT para el operador/defensor.
 *
 * El operador puede recuperar la planta de forma independiente al atacante,
 * ejecutando cada paso del procedimiento ICS-CERT:
 *   Confirmar → Aislar → Limpiar → Cargar código limpio → Reiniciar → Verificar
 */

import { useState, useRef, useEffect } from "react";
import {
  AlertTriangle, CheckCircle2, Circle, Loader2,
  XCircle, ShieldCheck, Cpu, RotateCcw, Play,
  Download, FileCode, RefreshCw, ChevronRight,
  ClipboardList, Wrench, Search,
} from "lucide-react";

const API = "http://127.0.0.1:8000";

/* ── Código legítimo de referencia ─────────────────────────────────────────── */
const CLEAN_PROGRAM = `PROGRAM MAIN
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
END_IF`;

/* ── Definición de pasos del procedimiento ──────────────────────────────────── */
const STEPS = [
  {
    id: 1,
    icon: <ClipboardList size={16} />,
    title: "Confirmar Incidente",
    short: "Evaluar daño",
    description:
      "Revisa las alarmas activas y los activos comprometidos. " +
      "Confirma que se trata de un ataque real (no una falsa alarma) " +
      "antes de iniciar el procedimiento de respuesta.",
    action: "Confirmar — Iniciar Respuesta al Incidente",
    note: "ICS-CERT IR Step 1 — Preparación y detección",
  },
  {
    id: 2,
    icon: <ShieldCheck size={16} />,
    title: "Aislar — Detener PLC",
    short: "Detener PLC",
    description:
      "Pone el CPU del PLC en modo STOP. Esto detiene inmediatamente " +
      "la ejecución del programa malicioso inyectado (OB1 comprometido), " +
      "interrumpiendo el control de actuadores. La planta queda en estado seguro manual.",
    action: "Detener CPU PLC (STOP mode)",
    note: "ICS-CERT IR Step 2 — Contención. COTP: enviar PDU tipo 0x29 (Stop CPU).",
  },
  {
    id: 3,
    icon: <RotateCcw size={16} />,
    title: "Limpiar Código Malicioso",
    short: "Borrar OB1",
    description:
      "Elimina el bloque OB1 malicioso de la memoria del PLC. " +
      "Mientras el CPU esté en STOP, se puede hacer un DELETE del bloque " +
      "sin que el programa continúe ejecutándose. El PLC queda sin programa activo.",
    action: "Borrar programa comprometido del PLC",
    note: "ICS-CERT IR Step 3 — Erradicación. Función S7comm: DELETE BLOCK (OB1).",
  },
  {
    id: 4,
    icon: <FileCode size={16} />,
    title: "Cargar Código Limpio",
    short: "Cargar programa",
    description:
      "Revisa el código legítimo de control pre-cargado y descárgalo al PLC. " +
      "Verifica que la lógica sea correcta antes de descargarlo: " +
      "protección térmica, control de presión y alarmas de seguridad.",
    action: "Validar y Descargar al PLC",
    note: "ICS-CERT IR Step 4 — Recuperación. S7comm función: PUT (descarga OB1).",
  },
  {
    id: 5,
    icon: <Play size={16} />,
    title: "Reiniciar PLC",
    short: "CPU a RUN",
    description:
      "Cambia el CPU de STOP a RUN y activa el programa de control. " +
      "El PLC retoma el control de los actuadores con el código legítimo.",
    action: "Iniciar CPU y ejecutar programa",
    note: "ICS-CERT IR Step 4 cont. — COTP: PDU tipo 0x28 (Start CPU).",
  },
  {
    id: 6,
    icon: <Wrench size={16} />,
    title: "Normalizar Proceso y Equipos",
    short: "Restaurar valores",
    description:
      "Restablece los valores de proceso (temperatura, presión) a rango operativo " +
      "normal, restaura el estado de los equipos comprometidos a ONLINE " +
      "y limpia todas las alarmas activas del sistema.",
    action: "Normalizar proceso · Restaurar equipos · Limpiar alarmas",
    note: "ICS-CERT IR Step 4 — Post-recuperación. Verificar que el proceso es controlable.",
  },
  {
    id: 7,
    icon: <Search size={16} />,
    title: "Verificar y Documentar",
    short: "Verificar",
    description:
      "Comprueba que todos los parámetros del proceso están dentro del rango " +
      "operativo, que no quedan alarmas activas y que todos los activos están ONLINE. " +
      "El incidente queda registrado en el SIEM para análisis forense.",
    action: "Confirmar Recuperación Completada",
    note: "ICS-CERT IR Step 5 — Lecciones aprendidas y documentación.",
  },
];

/* ── Utilidades ─────────────────────────────────────────────────────────────── */
async function apiPost(path, body = null) {
  const opts = { method: "POST", headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${API}${path}`, opts);
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || `HTTP ${r.status}`);
  }
  return r.json();
}

async function apiGet(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── Componente de estado de paso ───────────────────────────────────────────── */
function StepBadge({ status, id }) {
  const map = {
    pending:     { bg: "#1e293b", border: "#374151",  text: "#6b7280"  },
    active:      { bg: "#0d2237", border: "#38bdf8",  text: "#38bdf8"  },
    running:     { bg: "#0d2237", border: "#f59e0b",  text: "#f59e0b"  },
    done:        { bg: "#071a0d", border: "#22c55e",  text: "#22c55e"  },
    failed:      { bg: "#1a0505", border: "#ef4444",  text: "#ef4444"  },
  };
  const s = map[status] || map.pending;
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%",
      background: s.bg, border: `1.5px solid ${s.border}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      boxShadow: status === "active" || status === "running" ? `0 0 8px ${s.border}50` : "none",
    }}>
      {status === "done"    && <CheckCircle2 size={14} color={s.text} />}
      {status === "failed"  && <XCircle      size={14} color={s.text} />}
      {status === "running" && <Loader2      size={14} color={s.text} style={{ animation: "spin 1s linear infinite" }} />}
      {(status === "pending" || status === "active") &&
        <span style={{ fontSize: 11, fontWeight: 700, color: s.text, fontFamily: "monospace" }}>{id}</span>}
    </div>
  );
}

/* ── Log de actividad mini-terminal ─────────────────────────────────────────── */
function ActivityLog({ lines }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  if (!lines.length) return null;

  return (
    <div ref={ref} style={{
      marginTop: 10,
      background: "#050b12",
      border: "1px solid #1e293b",
      borderRadius: 6,
      padding: "8px 12px",
      fontFamily: "monospace",
      fontSize: 11,
      maxHeight: 130,
      overflowY: "auto",
      lineHeight: 1.65,
    }}>
      {lines.map((l, i) => (
        <div key={i} style={{ color: l.color || "#6b7280" }}>{l.text}</div>
      ))}
    </div>
  );
}

/* ── Indicador de verificación ──────────────────────────────────────────────── */
function CheckRow({ label, value, ok: isOk, expected }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "5px 10px",
      background: isOk ? "rgba(34,197,94,.06)" : "rgba(239,68,68,.08)",
      borderRadius: 4,
      borderLeft: `3px solid ${isOk ? "#22c55e" : "#ef4444"}`,
      marginBottom: 4,
    }}>
      {isOk
        ? <CheckCircle2 size={13} color="#22c55e" />
        : <XCircle      size={13} color="#ef4444" />
      }
      <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", flexGrow: 1 }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700,
        color: isOk ? "#22c55e" : "#ef4444" }}>{value}</span>
      {!isOk && expected &&
        <span style={{ fontSize: 10, color: "#4b5563", fontFamily: "monospace" }}>
          (esperado: {expected})
        </span>
      }
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════════════ */
export default function RecoveryConsole({ plant, alarms = [], equipment = [] }) {
  const [currentStep, setCurrentStep]   = useState(1);
  const [stepStatus,  setStepStatus]    = useState(
    Object.fromEntries(STEPS.map(s => [s.id, s.id === 1 ? "active" : "pending"]))
  );
  const [stepLogs,    setStepLogs]      = useState(
    Object.fromEntries(STEPS.map(s => [s.id, []]))
  );
  const [plcCode,     setPlcCode]       = useState(CLEAN_PROGRAM);
  const [validation,  setValidation]    = useState(null); // {valid, errors}
  const [verifyData,  setVerifyData]    = useState(null);
  const [recovered,   setRecovered]     = useState(false);

  const proc = plant?.process;

  /* ── Contar activos comprometidos ─────────────────────────────────────────── */
  const compromisedAssets = equipment.filter(
    e => e.status === "COMPROMISED" || e.status === "OFFLINE"
  );
  const criticalAlarms = alarms.filter(a => a.active && a.severity === "CRITICAL");
  const hasIncident = criticalAlarms.length > 0 || compromisedAssets.length > 0;

  /* ── Helpers para logs ───────────────────────────────────────────────────── */
  const addLog = (stepId, text, color = "#6b7280") =>
    setStepLogs(prev => ({
      ...prev,
      [stepId]: [...prev[stepId], { text: `[${new Date().toLocaleTimeString()}] ${text}`, color }],
    }));

  const setStatus = (stepId, status) =>
    setStepStatus(prev => ({ ...prev, [stepId]: status }));

  /* ── Avanzar al siguiente paso ───────────────────────────────────────────── */
  const advance = (doneStepId) => {
    setStatus(doneStepId, "done");
    if (doneStepId < 7) {
      const next = doneStepId + 1;
      setStatus(next, "active");
      setCurrentStep(next);
    }
  };

  /* ══════════════════════════════════════════════════════
     ACCIONES POR PASO
  ══════════════════════════════════════════════════════ */

  /* PASO 1 — Confirmar incidente */
  const handleStep1 = () => {
    addLog(1, "Incidente confirmado — iniciando procedimiento de respuesta ICS-CERT.", "#f59e0b");
    addLog(1, `Alarmas críticas activas: ${criticalAlarms.length}`, criticalAlarms.length > 0 ? "#ef4444" : "#22c55e");
    addLog(1, `Activos comprometidos: ${compromisedAssets.map(a => a.asset_id).join(", ") || "ninguno"}`, compromisedAssets.length > 0 ? "#ef4444" : "#22c55e");
    addLog(1, "Iniciando protocolo de aislamiento.", "#38bdf8");
    advance(1);
  };

  /* PASO 2 — Detener PLC */
  const handleStep2 = async () => {
    setStatus(2, "running");
    addLog(2, "Enviando comando STOP al CPU del PLC S7-1500...", "#38bdf8");
    addLog(2, "Protocolo: S7comm PDU tipo 0x29 (Stop CPU request)", "#4b5563");
    try {
      await delay(600);
      await apiPost("/api/plc/stop");
      addLog(2, "CPU en modo STOP — código malicioso DETENIDO.", "#22c55e");
      addLog(2, "Actuadores en modo manual — estado seguro.", "#22c55e");
      advance(2);
    } catch (e) {
      setStatus(2, "failed");
      addLog(2, `Error: ${e.message}`, "#ef4444");
    }
  };

  /* PASO 3 — Limpiar programa malicioso */
  const handleStep3 = async () => {
    setStatus(3, "running");
    addLog(3, "Eliminando bloque OB1 comprometido de la memoria PLC...", "#38bdf8");
    addLog(3, "Función S7comm: DELETE BLOCK (OB, number=1)", "#4b5563");
    try {
      await delay(800);
      await apiPost("/api/plc/program/reset");
      addLog(3, "OB1 eliminado. Memoria PLC limpia.", "#22c55e");
      addLog(3, "PLC sin programa activo — listo para recibir código limpio.", "#22c55e");
      advance(3);
    } catch (e) {
      setStatus(3, "failed");
      addLog(3, `Error: ${e.message}`, "#ef4444");
    }
  };

  /* PASO 4 — Validar y cargar código limpio */
  const handleValidate = async () => {
    setValidation(null);
    addLog(4, "Validando sintaxis del programa PLC...", "#38bdf8");
    try {
      const r = await apiPost("/api/plc/program/validate", { source: plcCode });
      setValidation(r);
      if (r.valid) {
        addLog(4, "Validación exitosa — programa correcto.", "#22c55e");
        addLog(4, `${plcCode.split("NETWORK").length - 1} redes · ${plcCode.split("\n").length} líneas`, "#6b7280");
      } else {
        addLog(4, `Errores de validación: ${r.errors.join(" | ")}`, "#ef4444");
      }
    } catch (e) {
      addLog(4, `Error de validación: ${e.message}`, "#ef4444");
    }
  };

  const handleStep4 = async () => {
    if (!validation?.valid) {
      addLog(4, "Valida el código primero antes de descargarlo.", "#f59e0b");
      return;
    }
    setStatus(4, "running");
    addLog(4, "Descargando programa al PLC (PUT Block OB1)...", "#38bdf8");
    addLog(4, "CPU en STOP → descarga → CPU en RUN (automático)", "#4b5563");
    try {
      await delay(900);
      await apiPost("/api/plc/program/download", { source: plcCode });
      addLog(4, "OB1 cargado en PLC — código legítimo activo.", "#22c55e");
      advance(4);
    } catch (e) {
      setStatus(4, "failed");
      addLog(4, `Error en descarga: ${e.message}`, "#ef4444");
    }
  };

  /* PASO 5 — Reiniciar PLC y programa */
  const handleStep5 = async () => {
    setStatus(5, "running");
    addLog(5, "Cambiando CPU a modo RUN...", "#38bdf8");
    try {
      await delay(500);
      await apiPost("/api/plc/run");
      addLog(5, "CPU → RUN.", "#22c55e");

      await delay(400);
      addLog(5, "Iniciando ejecución del programa de control...", "#38bdf8");
      await apiPost("/api/plc/program/run");
      addLog(5, "Programa en ejecución — ciclo de scan activo.", "#22c55e");
      addLog(5, "PLC controlando proceso con lógica legítima.", "#22c55e");
      advance(5);
    } catch (e) {
      setStatus(5, "failed");
      addLog(5, `Error: ${e.message}`, "#ef4444");
    }
  };

  /* PASO 6 — Normalizar proceso + equipos + alarmas */
  const handleStep6 = async () => {
    setStatus(6, "running");
    addLog(6, "Normalizando valores de proceso (T=95°C→68°C, P=6.2→3.8 bar)...", "#38bdf8");
    try {
      await delay(700);
      await apiPost("/api/process/normalize");
      addLog(6, "Proceso normalizado — temperatura y presión en rango operativo.", "#22c55e");

      await delay(400);
      addLog(6, "Restaurando estado de activos OT a ONLINE...", "#38bdf8");
      await apiPost("/api/equipment/restore");
      addLog(6, "PLC-001, HMI-001, SCADA-001 → ONLINE.", "#22c55e");

      await delay(400);
      addLog(6, "Limpiando alarmas activas del sistema...", "#38bdf8");
      await apiPost("/api/alarms/reset");
      addLog(6, "Todas las alarmas reseteadas.", "#22c55e");

      await delay(300);
      await apiPost("/api/plant/resume");
      addLog(6, "Producción reanudada.", "#22c55e");

      advance(6);
    } catch (e) {
      setStatus(6, "failed");
      addLog(6, `Error: ${e.message}`, "#ef4444");
    }
  };

  /* PASO 7 — Verificar */
  const handleVerify = async () => {
    addLog(7, "Ejecutando verificación de recuperación...", "#38bdf8");
    try {
      const [plantData, plcData] = await Promise.all([
        apiGet("/api/plant"),
        apiGet("/api/plc"),
      ]);
      const p = plantData.process || {};
      const alarmList = plantData.alarms?.active ?? [];
      const eqList    = plantData.equipment ?? [];

      const checks = {
        cpuState:    plcData.cpu_state === "RUN",
        temperature: p.temperature  >= 60  && p.temperature  <= 80,
        pressure:    p.pressure     >= 3.0 && p.pressure     <= 4.5,
        motorSpeed:  p.motor_speed  >= 500,
        valvePos:    p.valve_position >= 10 && p.valve_position <= 90,
        noAlarms:    alarmList.filter(a => a.active && a.severity === "CRITICAL").length === 0,
        allOnline:   eqList.every(e => e.status === "ONLINE"),
      };

      setVerifyData({ checks, p, plcData, alarmList, eqList });
      const allOk = Object.values(checks).every(Boolean);

      if (allOk) {
        addLog(7, "✓ TODOS LOS CHECKS PASADOS — Planta recuperada.", "#22c55e");
        setStatus(7, "done");
        setRecovered(true);
      } else {
        const fails = Object.entries(checks).filter(([,v]) => !v).map(([k]) => k);
        addLog(7, `⚠ Checks fallidos: ${fails.join(", ")}`, "#f59e0b");
        addLog(7, "Revisa los valores marcados en rojo y repite el paso 6 si es necesario.", "#f59e0b");
      }
    } catch (e) {
      addLog(7, `Error en verificación: ${e.message}`, "#ef4444");
    }
  };

  /* ── Handlers por paso ──────────────────────────────────────────────────── */
  const HANDLERS = { 1: handleStep1, 2: handleStep2, 3: handleStep3,
                     5: handleStep5, 6: handleStep6 };

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14,
                  height: "calc(100vh - 180px)", minHeight: 520 }}>

      {/* ── CABECERA DE INCIDENTE ── */}
      <div style={{
        background:   hasIncident ? "rgba(239,68,68,.08)" : "rgba(34,197,94,.06)",
        border:       `1px solid ${hasIncident ? "rgba(239,68,68,.4)" : "rgba(34,197,94,.3)"}`,
        borderRadius: 8,
        padding:      "10px 16px",
        display:      "flex",
        alignItems:   "center",
        gap:          12,
        flexShrink:   0,
      }}>
        {hasIncident
          ? <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
          : <CheckCircle2  size={18} color="#22c55e" style={{ flexShrink: 0 }} />
        }
        <div style={{ flexGrow: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace",
            color: hasIncident ? "#ef4444" : "#22c55e", letterSpacing: "0.08em" }}>
            {recovered ? "RECUPERACIÓN COMPLETADA" : hasIncident ? "INCIDENTE ACTIVO — RESPUESTA EN CURSO" : "PLANTA OPERATIVA — SIN INCIDENTES"}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace", marginTop: 2 }}>
            {criticalAlarms.length} alarma{criticalAlarms.length !== 1 ? "s" : ""} crítica{criticalAlarms.length !== 1 ? "s" : ""}
            {" · "}
            {compromisedAssets.length} activo{compromisedAssets.length !== 1 ? "s" : ""} comprometido{compromisedAssets.length !== 1 ? "s" : ""}
            {" · "}
            Paso {currentStep} / {STEPS.length}
          </div>
        </div>

        {/* Barra de progreso */}
        <div style={{ display: "flex", gap: 4 }}>
          {STEPS.map(s => {
            const st = stepStatus[s.id];
            return (
              <div key={s.id}
                onClick={() => setCurrentStep(s.id)}
                style={{
                  width:        st === "done" ? 22 : 8,
                  height:       8,
                  borderRadius: 4,
                  background:   st === "done" ? "#22c55e" : st === "active" || st === "running" ? "#38bdf8" : st === "failed" ? "#ef4444" : "#1e293b",
                  cursor:       "pointer",
                  transition:   "width 0.3s",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* ── CUERPO: lista de pasos + panel activo ── */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, flexGrow: 1, minHeight: 0 }}>

        {/* ── LISTA DE PASOS ── */}
        <div style={{
          display:        "flex",
          flexDirection:  "column",
          gap:            4,
          overflowY:      "auto",
        }}>
          {STEPS.map(s => {
            const st    = stepStatus[s.id];
            const isCur = currentStep === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentStep(s.id)}
                style={{
                  display:     "flex",
                  alignItems:  "center",
                  gap:         10,
                  padding:     "9px 12px",
                  borderRadius: 7,
                  border:      `1px solid ${isCur ? "#38bdf8" : st === "done" ? "rgba(34,197,94,.3)" : "#1e293b"}`,
                  background:  isCur ? "rgba(56,189,248,.07)" : st === "done" ? "rgba(34,197,94,.05)" : "rgba(255,255,255,.02)",
                  cursor:      "pointer",
                  textAlign:   "left",
                }}
              >
                <StepBadge status={st} id={s.id} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, fontFamily: "monospace",
                    color: isCur ? "#38bdf8" : st === "done" ? "#22c55e" : st === "failed" ? "#ef4444" : "#6b7280" }}>
                    {s.short}
                  </div>
                  {isCur && (
                    <div style={{ fontSize: 9, color: "#4b5563", fontFamily: "monospace", marginTop: 1 }}>
                      {s.note.split("—")[0].trim()}
                    </div>
                  )}
                </div>
                {isCur && <ChevronRight size={12} color="#38bdf8" style={{ marginLeft: "auto" }} />}
              </button>
            );
          })}
        </div>

        {/* ── PANEL DEL PASO ACTIVO ── */}
        <div style={{
          background:   "#070c15",
          border:       "1px solid #1e293b",
          borderRadius: 10,
          padding:      "18px 20px",
          overflowY:    "auto",
          display:      "flex",
          flexDirection: "column",
          gap:          14,
        }}>
          {(() => {
            const step = STEPS.find(s => s.id === currentStep);
            const st   = stepStatus[currentStep];
            if (!step) return null;

            return (
              <>
                {/* Cabecera del paso */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: "#0d1f30", border: "1px solid #1e3a5f",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#38bdf8",
                  }}>
                    {step.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "#4b5563", fontFamily: "monospace",
                      textTransform: "uppercase", letterSpacing: "0.12em" }}>
                      Paso {step.id} de {STEPS.length} · {step.note}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginTop: 2 }}>
                      {step.title}
                    </div>
                  </div>
                  <StepBadge status={st} id={step.id} />
                </div>

                {/* Descripción */}
                <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.7, margin: 0 }}>
                  {step.description}
                </p>

                {/* ─── CONTENIDO ESPECÍFICO POR PASO ─── */}

                {/* PASO 1: resumen del incidente */}
                {currentStep === 1 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 10, color: "#4b5563", fontFamily: "monospace",
                      textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                      Situación actual
                    </div>
                    {criticalAlarms.slice(0, 4).map((a, i) => (
                      <div key={i} style={{
                        padding: "6px 10px", borderRadius: 5, background: "rgba(239,68,68,.08)",
                        border: "1px solid rgba(239,68,68,.2)", fontSize: 11,
                        fontFamily: "monospace", color: "#fca5a5",
                      }}>
                        ⚠ [{a.severity}] {a.source} — {a.message?.slice(0, 60)}...
                      </div>
                    ))}
                    {compromisedAssets.map((e, i) => (
                      <div key={i} style={{
                        padding: "6px 10px", borderRadius: 5, background: "rgba(239,68,68,.06)",
                        border: "1px solid rgba(239,68,68,.15)", fontSize: 11,
                        fontFamily: "monospace", color: "#ef4444",
                      }}>
                        ✗ {e.asset_id} ({e.name}) → {e.status}
                      </div>
                    ))}
                    {!hasIncident && (
                      <div style={{ color: "#22c55e", fontSize: 12, fontFamily: "monospace" }}>
                        ✓ No se detectan incidentes activos en este momento.
                      </div>
                    )}
                  </div>
                )}

                {/* PASO 4: editor de código PLC */}
                {currentStep === 4 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: "#4b5563", fontFamily: "monospace",
                        textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        Código de control legítimo (revisar antes de descargar)
                      </span>
                      <button
                        onClick={handleValidate}
                        style={{
                          padding: "4px 10px", borderRadius: 4, fontSize: 10,
                          border: "1px solid #1e3a5f", background: "#0d1f30",
                          color: "#38bdf8", cursor: "pointer", fontFamily: "monospace",
                        }}
                      >
                        ▶ Validar
                      </button>
                    </div>
                    <textarea
                      value={plcCode}
                      onChange={e => { setPlcCode(e.target.value); setValidation(null); }}
                      spellCheck={false}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        height: 200,
                        background: "#03080f", border: "1px solid #1e3a5f",
                        borderRadius: 6, padding: "10px 12px",
                        fontFamily: "monospace", fontSize: 12, color: "#22c55e",
                        lineHeight: 1.6, resize: "vertical", outline: "none",
                      }}
                    />
                    {validation && (
                      <div style={{
                        marginTop: 6, padding: "6px 10px", borderRadius: 5,
                        background: validation.valid ? "rgba(34,197,94,.08)" : "rgba(239,68,68,.08)",
                        border: `1px solid ${validation.valid ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}`,
                        fontSize: 11, fontFamily: "monospace",
                        color: validation.valid ? "#22c55e" : "#ef4444",
                      }}>
                        {validation.valid
                          ? "✓ Código válido — listo para descargar al PLC"
                          : `✗ Errores: ${validation.errors?.join(" · ")}`}
                      </div>
                    )}
                  </div>
                )}

                {/* PASO 7: verificación */}
                {currentStep === 7 && verifyData && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ fontSize: 10, color: "#4b5563", fontFamily: "monospace",
                      textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                      Estado del sistema post-recuperación
                    </div>
                    <CheckRow label="CPU PLC"          value={verifyData.plcData.cpu_state}
                      ok={verifyData.checks.cpuState}    expected="RUN" />
                    <CheckRow label="Temperatura"      value={`${verifyData.p.temperature?.toFixed(1)}°C`}
                      ok={verifyData.checks.temperature} expected="60–80°C" />
                    <CheckRow label="Presión"          value={`${verifyData.p.pressure?.toFixed(2)} bar`}
                      ok={verifyData.checks.pressure}    expected="3.0–4.5 bar" />
                    <CheckRow label="Velocidad motor"  value={`${verifyData.p.motor_speed?.toFixed(0)} RPM`}
                      ok={verifyData.checks.motorSpeed}  expected="> 500 RPM" />
                    <CheckRow label="Posición válvula" value={`${verifyData.p.valve_position?.toFixed(0)}%`}
                      ok={verifyData.checks.valvePos}    expected="10–90%" />
                    <CheckRow label="Alarmas críticas" value={verifyData.alarmList.filter(a=>a.active&&a.severity==="CRITICAL").length === 0 ? "Ninguna" : `${verifyData.alarmList.length} activas`}
                      ok={verifyData.checks.noAlarms}    expected="0 activas" />
                    <CheckRow label="Equipos ONLINE"   value={verifyData.checks.allOnline ? "Todos OK" : `${verifyData.eqList.filter(e=>e.status!=="ONLINE").length} sin recuperar`}
                      ok={verifyData.checks.allOnline}   expected="Todos ONLINE" />
                  </div>
                )}

                {/* PASO 7: éxito */}
                {currentStep === 7 && recovered && (
                  <div style={{
                    padding: "14px 16px", borderRadius: 8, textAlign: "center",
                    background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.4)",
                  }}>
                    <CheckCircle2 size={28} color="#22c55e" style={{ display: "block", margin: "0 auto 8px" }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e",
                      fontFamily: "monospace", letterSpacing: "0.08em" }}>
                      PLANTA RECUPERADA EXITOSAMENTE
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                      Producción reanudada · Todos los sistemas operativos
                    </div>
                  </div>
                )}

                {/* Log de actividad */}
                <ActivityLog lines={stepLogs[currentStep]} />

                {/* Botones de acción */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>

                  {/* Botón primario genérico (pasos 1,2,3,5,6) */}
                  {HANDLERS[currentStep] && st !== "done" && (
                    <button
                      onClick={HANDLERS[currentStep]}
                      disabled={st === "running"}
                      style={{
                        padding:     "9px 18px",
                        borderRadius: 6,
                        border:      "none",
                        background:  st === "running" ? "#1e293b" : "#0ea5e9",
                        color:       "white",
                        fontFamily:  "monospace",
                        fontSize:    12,
                        fontWeight:  700,
                        cursor:      st === "running" ? "not-allowed" : "pointer",
                        display:     "flex",
                        alignItems:  "center",
                        gap:         6,
                      }}
                    >
                      {st === "running"
                        ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Procesando...</>
                        : <>{step.icon} {step.action}</>
                      }
                    </button>
                  )}

                  {/* Botones dobles para paso 4 */}
                  {currentStep === 4 && st !== "done" && (
                    <button
                      onClick={handleStep4}
                      disabled={st === "running" || !validation?.valid}
                      style={{
                        padding: "9px 18px", borderRadius: 6, border: "none",
                        background: validation?.valid ? "#0ea5e9" : "#1e293b",
                        color: "white", fontFamily: "monospace", fontSize: 12,
                        fontWeight: 700, cursor: validation?.valid ? "pointer" : "not-allowed",
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      {st === "running"
                        ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Descargando...</>
                        : <><Download size={13} /> Descargar al PLC</>
                      }
                    </button>
                  )}

                  {/* Botón de verificación (paso 7) */}
                  {currentStep === 7 && !recovered && (
                    <button
                      onClick={handleVerify}
                      style={{
                        padding: "9px 18px", borderRadius: 6, border: "none",
                        background: "#0ea5e9", color: "white", fontFamily: "monospace",
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <Search size={13} /> Verificar Estado del Sistema
                    </button>
                  )}

                  {/* Retry si falló */}
                  {st === "failed" && HANDLERS[currentStep] && (
                    <button
                      onClick={() => { setStatus(currentStep, "active"); setStepLogs(p => ({...p, [currentStep]: []})); }}
                      style={{
                        padding: "9px 14px", borderRadius: 6,
                        border: "1px solid rgba(239,68,68,.4)",
                        background: "rgba(239,68,68,.08)", color: "#ef4444",
                        fontFamily: "monospace", fontSize: 12, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <RefreshCw size={13} /> Reintentar
                    </button>
                  )}

                  {/* Ir al paso anterior */}
                  {currentStep > 1 && st !== "running" && (
                    <button
                      onClick={() => setCurrentStep(c => c - 1)}
                      style={{
                        padding: "9px 12px", borderRadius: 6,
                        border: "1px solid #1e293b", background: "transparent",
                        color: "#6b7280", fontFamily: "monospace", fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      ← Paso anterior
                    </button>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}