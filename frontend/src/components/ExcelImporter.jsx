/**
 * ExcelImporter.jsx
 * Interfaz completa de importación de Excel para el OT Cyber Range Lab.
 *
 * Flujo:
 *   1. DROP   — Zona de arrastrar/soltar el archivo
 *   2. PARSE  — Parsing automático + detección de hojas + mapeo de columnas
 *   3. PREVIEW— Vista previa de los datos detectados + confirmación
 *   4. DONE   — Resumen + cierre
 *
 * Requiere: npm install xlsx
 * Uso: <ExcelImporter onImport={(labData) => {}} onClose={() => {}} />
 */

import { useState, useCallback, useRef } from "react";
import { parseExcel, detectColumnMappings, summarizeLabData } from "../utils/excelParser";

/* ── Colores ─────────────────────────────────────────────────────────────── */
const CLR = {
  bg:       "#05080f",
  bg2:      "#08101a",
  border:   "#1e293b",
  accent:   "#3b82f6",
  green:    "#22c55e",
  red:      "#ef4444",
  amber:    "#f59e0b",
  muted:    "#64748b",
  text:     "#e2e8f0",
  dim:      "#334155",
};

const SHEET_LABELS = {
  assets:      { label: "Activos / Assets",     color: "#3b82f6", icon: "🖥" },
  connections: { label: "Conexiones",            color: "#22c55e", icon: "🔗" },
  lines:       { label: "Líneas de Producción", color: "#818cf8", icon: "🏭" },
  variables:   { label: "Variables / Tags",     color: "#f59e0b", icon: "📊" },
  vlans:       { label: "VLANs / Red",           color: "#06b6d4", icon: "🌐" },
  protocols:   { label: "Protocolos",            color: "#a78bfa", icon: "📡" },
};

/* ── Componente principal ─────────────────────────────────────────────────── */
export default function ExcelImporter({ onImport, onClose }) {
  const [step,        setStep]        = useState("drop");   // drop | parse | preview | done
  const [file,        setFile]        = useState(null);
  const [rawSheets,   setRawSheets]   = useState({});
  const [detected,    setDetected]    = useState({});       // { assets: "Assets", ... }
  const [labData,     setLabData]     = useState(null);
  const [summary,     setSummary]     = useState(null);
  const [error,       setError]       = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [dragging,    setDragging]    = useState(false);
  const fileInputRef = useRef();

  /* ── Parsear el archivo ──────────────────────────────────────────────── */
  async function handleFile(f) {
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase();
    if (!["xlsx","xls","xlsm","ods"].includes(ext)) {
      setError(`Formato no soportado: .${ext}. Usa .xlsx, .xls o .xlsm`);
      return;
    }

    setFile(f);
    setError(null);
    setLoading(true);
    setStep("parse");

    try {
      // Importar SheetJS dinámicamente
      const XLSX = await import("xlsx");
      const buffer = await f.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });

      // Convertir todas las hojas a JSON
      const sheets = {};
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
        if (rows.length) sheets[name] = rows;
      }

      setRawSheets(sheets);

      // Detectar qué hoja es qué + mapeo de columnas
      const mappings = detectColumnMappings(sheets);
      setDetected(mappings);

      // Parsear inmediatamente
      const parsed = parseExcel(sheets, mappings);
      const sum    = summarizeLabData(parsed);
      setLabData(parsed);
      setSummary(sum);
      setStep("preview");

    } catch (e) {
      setError(`Error al parsear el archivo: ${e.message}`);
      setStep("drop");
    } finally {
      setLoading(false);
    }
  }

  /* ── Drag & Drop ─────────────────────────────────────────────────────── */
  const onDragOver  = useCallback(e => { e.preventDefault(); setDragging(true);  }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop      = useCallback(e => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  /* ── Confirmar importación ───────────────────────────────────────────── */
  function confirmImport() {
    if (!labData) return;
    onImport(labData);
    setStep("done");
  }

  /* ── Renderizado por paso ────────────────────────────────────────────── */
  return (
    <div style={{
      position:       "fixed",
      inset:          0,
      background:     "rgba(3,6,12,0.92)",
      zIndex:         1000,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      backdropFilter: "blur(4px)",
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background:    CLR.bg2,
        border:        `1.5px solid ${CLR.border}`,
        borderRadius:  14,
        width:         "min(780px, 95vw)",
        maxHeight:     "90vh",
        overflow:      "hidden",
        display:       "flex",
        flexDirection: "column",
        boxShadow:     "0 24px 64px rgba(0,0,0,0.6)",
      }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{
          display:       "flex",
          alignItems:    "center",
          justifyContent:"space-between",
          padding:       "18px 24px",
          borderBottom:  `1px solid ${CLR.border}`,
          flexShrink:    0,
        }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: CLR.muted, letterSpacing: ".15em", marginBottom: 4 }}>
              OT CYBER RANGE LAB
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: CLR.text }}>
              Importar Inventario de Activos
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: CLR.muted, cursor: "pointer", fontSize: 20, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* ── Indicador de pasos ─────────────────────────────────────── */}
        <div style={{ display: "flex", padding: "12px 24px", gap: 8, flexShrink: 0, borderBottom: `1px solid ${CLR.border}` }}>
          {[
            { id: "drop",    label: "1. Seleccionar" },
            { id: "preview", label: "2. Verificar"   },
            { id: "done",    label: "3. Importado"   },
          ].map(({ id, label }) => {
            const done = (step === "preview" && id === "drop") ||
                         (step === "done"    && id !== "done");
            const active = step === id || (step === "parse" && id === "drop");
            return (
              <div key={id} style={{
                fontSize:   10,
                fontFamily: "monospace",
                padding:    "4px 12px",
                borderRadius: 4,
                background: active ? `${CLR.accent}18` : done ? `${CLR.green}12` : "transparent",
                border:     `1px solid ${active ? CLR.accent : done ? CLR.green : CLR.dim}`,
                color:      active ? CLR.accent : done ? CLR.green : CLR.dim,
              }}>
                {done ? "✓ " : ""}{label}
              </div>
            );
          })}
        </div>

        {/* ── Contenido ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

          {/* Error global */}
          {error && (
            <div style={{
              background:   "rgba(239,68,68,0.1)",
              border:       "1px solid rgba(239,68,68,0.4)",
              borderRadius: 8,
              padding:      "12px 16px",
              color:        CLR.red,
              fontSize:     13,
              marginBottom: 20,
              fontFamily:   "monospace",
            }}>
              ⚠ {error}
            </div>
          )}

          {/* ── PASO 1: DROP ─────────────────────────────────────────── */}
          {(step === "drop" || step === "parse") && (
            <div>
              {/* Zona de drag-and-drop */}
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !loading && fileInputRef.current?.click()}
                style={{
                  border:       `2px dashed ${dragging ? CLR.accent : loading ? CLR.green : CLR.border}`,
                  borderRadius: 12,
                  padding:      "48px 24px",
                  textAlign:    "center",
                  cursor:       loading ? "wait" : "pointer",
                  background:   dragging ? `${CLR.accent}06` : loading ? `${CLR.green}06` : "transparent",
                  transition:   "all .2s",
                  marginBottom: 24,
                }}
              >
                {loading ? (
                  <>
                    <div style={{ fontSize: 48, marginBottom: 14 }}>⚙️</div>
                    <div style={{ color: CLR.green, fontFamily: "monospace", fontSize: 14 }}>
                      Analizando Excel...
                    </div>
                    <div style={{ color: CLR.muted, fontSize: 11, marginTop: 6 }}>
                      Detectando hojas, columnas y tipos de activos
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 48, marginBottom: 14 }}>📋</div>
                    <div style={{ color: CLR.text, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                      Arrastra tu Excel aquí
                    </div>
                    <div style={{ color: CLR.muted, fontSize: 12, marginBottom: 16 }}>
                      o haz clic para seleccionar el archivo
                    </div>
                    <div style={{
                      display:        "inline-block",
                      background:     `${CLR.accent}18`,
                      border:         `1px solid ${CLR.accent}44`,
                      color:          CLR.accent,
                      padding:        "8px 20px",
                      borderRadius:   6,
                      fontSize:       12,
                      fontFamily:     "monospace",
                    }}>
                      SELECCIONAR ARCHIVO
                    </div>
                    <div style={{ color: CLR.dim, fontSize: 10, marginTop: 14, fontFamily: "monospace" }}>
                      Formatos: .xlsx · .xls · .xlsm · .ods
                    </div>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm,.ods"
                style={{ display: "none" }}
                onChange={e => handleFile(e.target.files[0])}
              />

              {/* Instrucciones de formato */}
              <div style={{
                background:   "rgba(255,255,255,.02)",
                border:       `1px solid ${CLR.border}`,
                borderRadius: 8,
                padding:      16,
              }}>
                <div style={{ fontSize: 10, fontFamily: "monospace", color: CLR.muted, letterSpacing: ".1em", marginBottom: 12 }}>
                  ESTRUCTURA ESPERADA DEL EXCEL
                </div>
                {[
                  ["Assets / Activos",       "ID, Name, Type, Vendor, Model, IP, VLAN, Line, Status, Purdue_Level, Protocols", "#3b82f6"],
                  ["Connections / Conexiones","Source, Destination, Protocol, Port, Direction", "#22c55e"],
                  ["Lines / Líneas",          "Line_ID, Name, Description  (opcional)", "#818cf8"],
                  ["Variables / Tags",        "Asset, Variable, Type, Initial_Value, Min, Max, Unit  (opcional)", "#f59e0b"],
                  ["VLANs",                   "VLAN_ID, Name, Zone  (opcional)", "#06b6d4"],
                ].map(([sheet, cols, color]) => (
                  <div key={sheet} style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 11 }}>
                    <span style={{ color, fontFamily: "monospace", minWidth: 150, fontWeight: 600 }}>{sheet}</span>
                    <span style={{ color: CLR.dim, fontFamily: "monospace" }}>{cols}</span>
                  </div>
                ))}
                <div style={{ color: CLR.dim, fontSize: 10, marginTop: 10, fontFamily: "monospace" }}>
                  ✓ Los nombres de columna se detectan automáticamente (inglés o español)
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 2: PREVIEW ──────────────────────────────────────── */}
          {step === "preview" && labData && summary && (
            <div>
              {/* Resumen rápido */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                {[
                  { label: "Activos",     value: summary.totalAssets,  color: CLR.accent },
                  { label: "Conexiones",  value: summary.totalConns,   color: CLR.green  },
                  { label: "Líneas",      value: summary.totalLines,   color: "#818cf8"  },
                  { label: "Variables",   value: summary.totalVars,    color: CLR.amber  },
                  { label: "VLANs",       value: summary.totalVlans,   color: "#06b6d4"  },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    background:   `${color}10`,
                    border:       `1px solid ${color}33`,
                    borderRadius: 8,
                    padding:      "10px 16px",
                    textAlign:    "center",
                    minWidth:     90,
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color, lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: 9, color: CLR.muted, marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Hojas detectadas */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontFamily: "monospace", color: CLR.muted, letterSpacing: ".1em", marginBottom: 10 }}>
                  HOJAS DETECTADAS
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {labData.meta.classified.map(({ type, sheetName }) => {
                    const s = SHEET_LABELS[type] ?? { label: type, color: CLR.muted, icon: "📄" };
                    return (
                      <div key={type} style={{
                        background:   `${s.color}12`,
                        border:       `1px solid ${s.color}44`,
                        borderRadius: 6,
                        padding:      "6px 12px",
                        fontSize:     10,
                        fontFamily:   "monospace",
                        color:        s.color,
                        display:      "flex",
                        alignItems:   "center",
                        gap:          6,
                      }}>
                        <span>{s.icon}</span>
                        <span style={{ fontWeight: 700 }}>{s.label}</span>
                        <span style={{ color: CLR.dim }}>← "{sheetName}"</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Activos por línea */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontFamily: "monospace", color: CLR.muted, letterSpacing: ".1em", marginBottom: 10 }}>
                  DISTRIBUCIÓN POR LÍNEA
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {Object.entries(summary.assetsByLine).map(([line, count]) => {
                    const colors = {
                      "LINE-01": "#22d3ee", "LINE-02": "#ef4444",
                      "LINE-03": "#22c55e", "SHARED":  "#f59e0b",
                    };
                    const c = colors[line] ?? CLR.muted;
                    return (
                      <div key={line} style={{
                        background:   `${c}10`,
                        border:       `1px solid ${c}33`,
                        borderRadius: 6,
                        padding:      "8px 14px",
                        fontSize:     11,
                        fontFamily:   "monospace",
                        color:        c,
                      }}>
                        <span style={{ fontWeight: 700 }}>{line}</span>
                        <span style={{ color: CLR.muted, marginLeft: 8 }}>{count} activos</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tipos de activos */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontFamily: "monospace", color: CLR.muted, letterSpacing: ".1em", marginBottom: 10 }}>
                  TIPOS DE EQUIPO DETECTADOS
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {summary.typeBreakdown.map(([type, count]) => (
                    <span key={type} style={{
                      background:   "rgba(255,255,255,.04)",
                      border:       `1px solid ${CLR.border}`,
                      borderRadius: 4,
                      padding:      "3px 10px",
                      fontSize:     10,
                      fontFamily:   "monospace",
                      color:        CLR.text,
                    }}>
                      {type} <span style={{ color: CLR.muted }}>×{count}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Preview tabla de activos */}
              <div>
                <div style={{ fontSize: 10, fontFamily: "monospace", color: CLR.muted, letterSpacing: ".1em", marginBottom: 10 }}>
                  VISTA PREVIA DE ACTIVOS (primeros 8)
                </div>
                <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${CLR.border}` }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "monospace" }}>
                    <thead>
                      <tr style={{ background: CLR.bg }}>
                        {["ID","Nombre","Tipo","Vendor","IP","VLAN","Línea","L.Purdue","Protocolos"].map(h => (
                          <th key={h} style={{
                            padding:   "8px 10px",
                            textAlign: "left",
                            color:     CLR.muted,
                            borderBottom: `1px solid ${CLR.border}`,
                            whiteSpace: "nowrap",
                            letterSpacing: ".06em",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {labData.assets.slice(0, 8).map((a, i) => (
                        <tr key={a.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,.01)" }}>
                          <td style={{ padding: "7px 10px", color: CLR.accent,  borderBottom: `1px solid ${CLR.border}44` }}>{a.id}</td>
                          <td style={{ padding: "7px 10px", color: CLR.text,    borderBottom: `1px solid ${CLR.border}44` }}>{a.name}</td>
                          <td style={{ padding: "7px 10px", color: CLR.text,    borderBottom: `1px solid ${CLR.border}44` }}>{a.type}</td>
                          <td style={{ padding: "7px 10px", color: CLR.muted,   borderBottom: `1px solid ${CLR.border}44` }}>{a.vendor}</td>
                          <td style={{ padding: "7px 10px", color: "#22c55e",   borderBottom: `1px solid ${CLR.border}44`, whiteSpace: "nowrap" }}>{a.ip}</td>
                          <td style={{ padding: "7px 10px", color: CLR.muted,   borderBottom: `1px solid ${CLR.border}44` }}>{a.vlan}</td>
                          <td style={{ padding: "7px 10px", color: CLR.text,    borderBottom: `1px solid ${CLR.border}44` }}>{a.line}</td>
                          <td style={{ padding: "7px 10px", color: CLR.muted,   borderBottom: `1px solid ${CLR.border}44`, textAlign: "center" }}>L{a.purdueLevel}</td>
                          <td style={{ padding: "7px 10px", color: CLR.muted,   borderBottom: `1px solid ${CLR.border}44` }}>
                            {a.protocols.slice(0,2).join(", ")}{a.protocols.length > 2 ? "..." : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {labData.assets.length > 8 && (
                  <div style={{ fontSize: 10, color: CLR.dim, fontFamily: "monospace", marginTop: 6, textAlign: "center" }}>
                    ... y {labData.assets.length - 8} activos más
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PASO 3: DONE ─────────────────────────────────────────── */}
          {step === "done" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: CLR.green, marginBottom: 8 }}>
                ¡Inventario Importado!
              </div>
              <div style={{ color: CLR.muted, fontSize: 13, marginBottom: 28 }}>
                La planta se ha generado con {summary?.totalAssets} activos en {summary?.totalLines} líneas de producción
              </div>
              <button
                onClick={onClose}
                style={{
                  background:   `${CLR.green}18`,
                  border:       `1px solid ${CLR.green}44`,
                  borderRadius: 8,
                  color:        CLR.green,
                  padding:      "12px 32px",
                  fontSize:     13,
                  fontFamily:   "monospace",
                  fontWeight:   700,
                  cursor:       "pointer",
                  letterSpacing: ".06em",
                }}
              >
                VER PLANTA →
              </button>
            </div>
          )}
        </div>

        {/* ── Footer con botones ─────────────────────────────────────── */}
        {step === "preview" && (
          <div style={{
            display:        "flex",
            justifyContent: "flex-end",
            gap:            12,
            padding:        "16px 24px",
            borderTop:      `1px solid ${CLR.border}`,
            flexShrink:     0,
          }}>
            <button
              onClick={() => { setStep("drop"); setFile(null); setLabData(null); setSummary(null); }}
              style={{
                background:   "transparent",
                border:       `1px solid ${CLR.border}`,
                borderRadius: 6,
                color:        CLR.muted,
                padding:      "9px 20px",
                fontSize:     12,
                fontFamily:   "monospace",
                cursor:       "pointer",
              }}
            >
              ← Cambiar archivo
            </button>
            <button
              onClick={confirmImport}
              style={{
                background:   `${CLR.accent}18`,
                border:       `1px solid ${CLR.accent}`,
                borderRadius: 6,
                color:        CLR.accent,
                padding:      "9px 24px",
                fontSize:     12,
                fontFamily:   "monospace",
                fontWeight:   700,
                cursor:       "pointer",
                letterSpacing: ".06em",
              }}
            >
              CONFIRMAR IMPORTACIÓN ✓
            </button>
          </div>
        )}
      </div>
    </div>
  );
}