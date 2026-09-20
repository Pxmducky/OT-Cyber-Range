/**
 * AttackerConsole.jsx
 * Simula una workstation Kali Linux para escenarios de ataque OT educativos.
 * Conecta con el backend para ejecutar ataques reales sobre la simulación de planta.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Terminal,
  Wifi,
  ShieldOff,
  Cpu,
  Server,
  AlertTriangle,
  RefreshCw,
  Play,
  ChevronRight,
  Circle,
  Activity,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000";

/* =========================================================
   DATOS DE ESCENARIOS (espejo del backend para UI instantánea)
========================================================= */
const SCENARIOS = [
  {
    id: "port_scan",
    name: "Network Reconnaissance",
    tool: "nmap 7.94",
    severity: "MEDIUM",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.35)",
    icon: <Wifi size={15} />,
    mitre: "T0846",
    short: "Escaneo pasivo de la red OT. Solo reconocimiento.",
  },
  {
    id: "s7_enum",
    name: "S7comm PLC Enumeration",
    tool: "s7-info.py",
    severity: "HIGH",
    color: "#f97316",
    bg: "rgba(249,115,22,0.10)",
    border: "rgba(249,115,22,0.35)",
    icon: <Cpu size={15} />,
    mitre: "T0861",
    short: "Lee registros de proceso del PLC sin autenticación.",
  },
  {
    id: "plc_inject",
    name: "PLC Code Injection",
    tool: "s7-inject.py",
    severity: "CRITICAL",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.40)",
    icon: <ShieldOff size={15} />,
    mitre: "T0836",
    short: "Inyecta lógica maliciosa. Motor a 0 RPM. Válvula 100%. Alarmas suprimidas.",
  },
  {
    id: "hmi_exploit",
    name: "HMI EternalBlue",
    tool: "Metasploit 6.3",
    severity: "CRITICAL",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.40)",
    icon: <Server size={15} />,
    mitre: "T0866",
    short: "CVE-2017-0144 en HMI Windows. Acceso SYSTEM + robo de credenciales.",
  },
  {
    id: "scada_dos",
    name: "SCADA OPC-UA DoS",
    tool: "opcua-flood.py",
    severity: "CRITICAL",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.40)",
    icon: <Activity size={15} />,
    mitre: "T0814",
    short: "Inunda el endpoint OPC-UA. Supervisión OFFLINE. Operadores ciegos.",
  },
  {
    id: "full_sabotage",
    name: "Full Plant Sabotage",
    tool: "ot-sabotage.py",
    severity: "CRITICAL",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.12)",
    border: "rgba(124,58,237,0.45)",
    icon: <AlertTriangle size={15} />,
    mitre: "T0879",
    short: "Multi-vector: código PLC + T=95°C P=6.2bar + HMI + SCADA offline.",
  },
];

const SEVERITY_LABEL = {
  MEDIUM:   { color: "#f59e0b", bg: "rgba(245,158,11,0.15)", text: "MEDIUM" },
  HIGH:     { color: "#f97316", bg: "rgba(249,115,22,0.15)", text: "HIGH"   },
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.15)",  text: "CRITICAL"},
};

/* =========================================================
   UTILIDAD: efecto máquina de escribir async
========================================================= */
function useTypewriter() {
  const [lines, setLines] = useState([]);
  const [typing, setTyping] = useState(false);
  const cancelRef = useRef(false);

  const typeLines = useCallback(async (rawText) => {
    cancelRef.current = false;
    setTyping(true);

    const allLines = rawText.split("\n");
    setLines([]);

    for (let i = 0; i < allLines.length; i++) {
      if (cancelRef.current) break;
      const line = allLines[i];

      // Líneas de "progreso" salen lentas; el resto, rápido
      const isProgress = line.includes("##") || line.includes("req enviadas");
      const delay = isProgress ? 80 : 18;

      await new Promise((r) => setTimeout(r, delay));
      if (cancelRef.current) break;
      setLines((prev) => [...prev, line]);
    }

    setTyping(false);
  }, []);

  const clear = useCallback(() => {
    cancelRef.current = true;
    setLines([]);
    setTyping(false);
  }, []);

  return { lines, typing, typeLines, clear };
}

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */
export default function AttackerConsole({ plant, alarms = [] }) {
  const [activeScenario, setActiveScenario] = useState(null);
  const [running, setRunning]               = useState(false);
  const [restoring, setRestoring]           = useState(false);
  const [lastEffects, setLastEffects]       = useState([]);
  const [error, setError]                   = useState(null);
  const termRef = useRef(null);

  const { lines, typing, typeLines, clear } = useTypewriter();

  const criticalAlarmCount = alarms.filter(
    (a) => a.active && a.severity === "CRITICAL"
  ).length;

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [lines]);

  // ── Ejecutar ataque ────────────────────────────────────────────
  const executeAttack = async (scenario) => {
    if (running || restoring) return;
    setError(null);
    setRunning(true);
    setActiveScenario(scenario);
    clear();

    // Mostrar línea de comando primero
    await new Promise((r) => setTimeout(r, 300));

    try {
      const res = await fetch(`${API_URL}/api/attack/execute`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ attack_type: scenario.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Error en el servidor");
      }

      const data = await res.json();
      setLastEffects(data.effects || []);
      await typeLines(data.terminal_output);
    } catch (e) {
      setError(e.message);
      await typeLines(`[ERROR] ${e.message}\n`);
    } finally {
      setRunning(false);
    }
  };

  // ── Restaurar planta ───────────────────────────────────────────
  const restorePlant = async () => {
    if (running || restoring) return;
    setRestoring(true);
    setError(null);
    clear();

    const restoreText =
      "[*] Iniciando restauración de planta...\n" +
      "[*] Descargando programa PLC malicioso...\n" +
      "[+] Programa PLC limpiado\n" +
      "[*] Restaurando velocidad de motor: 0 → 1450 RPM\n" +
      "[+] Motor en velocidad nominal\n" +
      "[*] Restaurando posición de válvula: 100% → 50%\n" +
      "[+] Válvula en posición nominal\n" +
      "[*] Restaurando temperatura: 95°C → 68°C\n" +
      "[*] Restaurando presión: 6.2 bar → 3.8 bar\n" +
      "[+] Proceso en parámetros normales\n" +
      "[*] Reseteando estado de equipos...\n" +
      "[+] PLC-001   → ONLINE\n" +
      "[+] HMI-001   → ONLINE\n" +
      "[+] SCADA-001 → ONLINE\n" +
      "[+] GW-001    → ONLINE\n" +
      "[+] M-001     → ONLINE\n" +
      "[*] Limpiando todas las alarmas activas...\n" +
      "[+] Alarmas limpiadas\n" +
      "[+] PLANTA RESTAURADA — estado operativo normal\n";

    typeLines(restoreText);

    try {
      await fetch(`${API_URL}/api/plant/restore`, { method: "POST" });
    } catch (e) {
      setError("No se pudo conectar con el backend para restaurar la planta.");
    }

    setTimeout(() => {
      setRestoring(false);
      setActiveScenario(null);
      setLastEffects([]);
    }, restoreText.split("\n").length * 20 + 500);
  };

  // ── Colorear líneas del terminal ───────────────────────────────
  const colorLine = (line) => {
    if (line.startsWith("[!]")) return "#ef4444";
    if (line.startsWith("[+]")) return "#22c55e";
    if (line.startsWith("[*]")) return "#60a5fa";
    if (line.startsWith("meterpreter")) return "#a78bfa";
    if (line.startsWith("    ")) return "#94a3b8";
    if (line.includes("##")) return "#f59e0b";
    return "#d1d5db";
  };

  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{
      display:      "grid",
      gridTemplateColumns: "300px 1fr",
      gap:          "14px",
      height:       "calc(100vh - 120px)",
      minHeight:    "500px",
    }}>

      {/* ── PANEL IZQUIERDO: escenarios ───────────────────────── */}
      <div style={{
        display:       "flex",
        flexDirection: "column",
        gap:           "8px",
        overflowY:     "auto",
        paddingRight:  "4px",
      }}>

        {/* Cabecera Kali */}
        <div style={{
          background:   "#0a0a0a",
          border:       "1px solid #1e1e1e",
          borderRadius: "8px",
          padding:      "12px 14px",
          marginBottom: "2px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ marginLeft: 6, color: "#4b5563", fontSize: 11, fontFamily: "monospace" }}>
              kali@attacker — bash
            </span>
          </div>
          <div style={{
            marginTop: 8,
            fontFamily: "monospace",
            fontSize:   11,
            color:      "#6b7280",
            lineHeight: 1.5,
          }}>
            <div style={{ color: "#22c55e" }}>┌──(root㉿kali)-[~]</div>
            <div style={{ color: "#22c55e" }}>└─# <span style={{ color: "#e5e7eb" }}>_</span></div>
          </div>
        </div>

        {/* Alarmas activas badge */}
        {criticalAlarmCount > 0 && (
          <div style={{
            background:   "rgba(239,68,68,0.15)",
            border:       "1px solid rgba(239,68,68,0.5)",
            borderRadius: "6px",
            padding:      "8px 10px",
            display:      "flex",
            alignItems:   "center",
            gap:          "6px",
            animation:    "pulse-red 1s infinite",
          }}>
            <AlertTriangle size={13} color="#ef4444" />
            <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>
              {criticalAlarmCount} ALARMA{criticalAlarmCount > 1 ? "S" : ""} CRÍTICA{criticalAlarmCount > 1 ? "S" : ""}
            </span>
          </div>
        )}

        {/* Lista de escenarios */}
        <div style={{ fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 2px" }}>
          Vectores de Ataque
        </div>

        {SCENARIOS.map((sc) => {
          const sev    = SEVERITY_LABEL[sc.severity];
          const active = activeScenario?.id === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => !running && !restoring && executeAttack(sc)}
              disabled={running || restoring}
              style={{
                background:    active ? sc.bg : "rgba(255,255,255,0.02)",
                border:        `1px solid ${active ? sc.border : "#1e1e1e"}`,
                borderRadius:  "8px",
                padding:       "10px 12px",
                cursor:        running || restoring ? "not-allowed" : "pointer",
                textAlign:     "left",
                transition:    "all 0.15s",
                opacity:       running && !active ? 0.5 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: sc.color }}>
                  {sc.icon}
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#e5e7eb" }}>
                    {sc.name}
                  </span>
                </div>
                <span style={{
                  fontSize:     9,
                  fontWeight:   700,
                  padding:      "2px 5px",
                  borderRadius: "4px",
                  color:        sev.color,
                  background:   sev.bg,
                  fontFamily:   "monospace",
                  letterSpacing: "0.05em",
                }}>
                  {sev.text}
                </span>
              </div>

              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, fontFamily: "monospace" }}>
                {sc.tool} · {sc.mitre}
              </div>

              <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.4 }}>
                {sc.short}
              </div>

              {active && running && (
                <div style={{
                  marginTop:  6,
                  fontSize:   9,
                  color:      sc.color,
                  fontFamily: "monospace",
                  display:    "flex",
                  alignItems: "center",
                  gap:        4,
                }}>
                  <Circle size={6} style={{ animation: "spin 1s linear infinite" }} />
                  EJECUTANDO...
                </div>
              )}
            </button>
          );
        })}

        {/* Botón restaurar */}
        <div style={{ marginTop: "auto", paddingTop: 6 }}>
          <button
            onClick={restorePlant}
            disabled={running || restoring}
            style={{
              width:         "100%",
              background:    "rgba(34,197,94,0.08)",
              border:        "1px solid rgba(34,197,94,0.3)",
              borderRadius:  "8px",
              padding:       "10px 12px",
              cursor:        running || restoring ? "not-allowed" : "pointer",
              display:       "flex",
              alignItems:    "center",
              justifyContent: "center",
              gap:           8,
              color:         "#22c55e",
              fontSize:      12,
              fontWeight:    600,
              transition:    "all 0.15s",
              opacity:       restoring ? 0.7 : 1,
            }}
          >
            <RefreshCw size={13} style={restoring ? { animation: "spin 1s linear infinite" } : {}} />
            {restoring ? "RESTAURANDO..." : "RESTAURAR PLANTA"}
          </button>
        </div>
      </div>

      {/* ── PANEL DERECHO: terminal ───────────────────────────── */}
      <div style={{
        background:   "#0a0a0a",
        borderRadius: "10px",
        border:       `1px solid ${criticalAlarmCount > 0 ? "rgba(239,68,68,0.5)" : "#1e1e1e"}`,
        display:      "flex",
        flexDirection: "column",
        overflow:     "hidden",
        transition:   "border-color 0.3s",
      }}>

        {/* Barra del terminal */}
        <div style={{
          background:   "#111111",
          borderBottom: `1px solid ${criticalAlarmCount > 0 ? "rgba(239,68,68,0.3)" : "#1e1e1e"}`,
          padding:      "8px 14px",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Terminal size={13} color="#22c55e" />
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>
              root@kali:~# attack-console
            </span>
            {typing && (
              <span style={{ fontSize: 10, color: "#f59e0b", fontFamily: "monospace", animation: "blink 1s step-end infinite" }}>
                ● EJECUTANDO
              </span>
            )}
          </div>

          {activeScenario && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "monospace" }}>
              <span style={{ color: "#4b5563" }}>ataque:</span>
              <span style={{ color: activeScenario.color, fontWeight: 600 }}>
                {activeScenario.id}
              </span>
            </div>
          )}
        </div>

        {/* Área de terminal */}
        <div
          ref={termRef}
          style={{
            flex:       1,
            overflowY:  "auto",
            padding:    "14px 18px",
            fontFamily: "'Courier New', 'Consolas', monospace",
            fontSize:   12,
            lineHeight: 1.65,
          }}
        >
          {/* Mensaje de bienvenida si no hay líneas */}
          {lines.length === 0 && !typing && (
            <div>
              <div style={{ color: "#22c55e", marginBottom: 8 }}>
                ┌──────────────────────────────────────────────────────┐
              </div>
              <div style={{ color: "#22c55e" }}>
                │  OT CYBER RANGE — ATTACKER WORKSTATION               │
              </div>
              <div style={{ color: "#22c55e" }}>
                │  Kali Linux 2024.3 — Herramientas ICS/SCADA          │
              </div>
              <div style={{ color: "#22c55e", marginBottom: 8 }}>
                └──────────────────────────────────────────────────────┘
              </div>

              <div style={{ color: "#4b5563", marginBottom: 16 }}>
                {/* Inventario rápido de red */}
                <div style={{ color: "#3b82f6", marginBottom: 6 }}>[*] Red OT objetivo: 172.16.100.0/24</div>
                <div style={{ color: "#6b7280" }}>
                  <span style={{ color: "#22c55e" }}>├─</span> 172.16.100.10  PLC-001   Siemens S7-1500<br />
                  <span style={{ color: "#22c55e" }}>├─</span> 172.16.102.10  HMI-001   Siemens KP400<br />
                  <span style={{ color: "#22c55e" }}>├─</span> 172.16.104.10  SCADA-001 WinCC<br />
                  <span style={{ color: "#22c55e" }}>└─</span> 172.16.103.10  GW-001    eWON Cosy+
                </div>
              </div>

              <div style={{ color: "#374151" }}>
                ──────────────────────────────────────────────────────
              </div>
              <div style={{ color: "#6b7280", marginTop: 8 }}>
                Selecciona un vector de ataque en el panel izquierdo.
              </div>
              <div style={{ color: "#4b5563", marginTop: 4, fontSize: 11 }}>
                ⚠  Solo para uso educativo en entorno simulado.
              </div>
            </div>
          )}

          {/* Comando actual */}
          {activeScenario && lines.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <span style={{ color: "#22c55e" }}>┌──(root㉿kali)-[~]</span>
              <br />
              <span style={{ color: "#22c55e" }}>└─# </span>
              <span style={{ color: "#e5e7eb" }}>{activeScenario.tool} </span>
              <span style={{ color: "#94a3b8", fontSize: 11 }}>
                {SCENARIOS.find(s => s.id === activeScenario.id)?.id === "port_scan"
                  ? "nmap -sS -sV -O -p 102,502,44818,4840 172.16.100.0/24 --open"
                  : activeScenario.id}
              </span>
              <br /><br />
            </div>
          )}

          {/* Líneas del terminal */}
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                color:     colorLine(line),
                whiteSpace: "pre",
                wordBreak:  "break-all",
              }}
            >
              {line}
            </div>
          ))}

          {/* Cursor parpadeante */}
          {(lines.length > 0 || typing) && (
            <div style={{ marginTop: 4 }}>
              {!typing && (
                <>
                  <span style={{ color: "#22c55e" }}>┌──(root㉿kali)-[~]</span>
                  <br />
                  <span style={{ color: "#22c55e" }}>└─# </span>
                </>
              )}
              <span style={{
                display:    "inline-block",
                width:      8,
                height:     14,
                background: "#22c55e",
                verticalAlign: "text-bottom",
                animation:  "blink 1s step-end infinite",
              }} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              marginTop:    12,
              color:        "#ef4444",
              background:   "rgba(239,68,68,0.1)",
              border:       "1px solid rgba(239,68,68,0.3)",
              borderRadius: "4px",
              padding:      "6px 10px",
              fontSize:     11,
              fontFamily:   "monospace",
            }}>
              [ERROR] {error}
            </div>
          )}
        </div>

        {/* Barra de efectos en la parte inferior */}
        {lastEffects.length > 0 && (
          <div style={{
            borderTop:   "1px solid #1e1e1e",
            padding:     "8px 14px",
            display:     "flex",
            gap:         8,
            flexWrap:    "wrap",
            background:  "#0d0d0d",
          }}>
            <span style={{ fontSize: 9, color: "#4b5563", fontFamily: "monospace", alignSelf: "center" }}>
              EFECTOS:
            </span>
            {lastEffects.map((eff, i) => (
              <span key={i} style={{
                fontSize:     9,
                fontFamily:   "monospace",
                color:        "#ef4444",
                background:   "rgba(239,68,68,0.1)",
                border:       "1px solid rgba(239,68,68,0.2)",
                borderRadius: "3px",
                padding:      "2px 6px",
              }}>
                {eff}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* CSS de animaciones inline */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse-red {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}