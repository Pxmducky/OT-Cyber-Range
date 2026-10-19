/**
 * AttackerConsole.jsx
 * Consola Kali REAL: el alumno escribe comandos que el backend ejecuta contra
 * la topología importada. El firewall/segmentación cambian el resultado, y las
 * acciones destructivas tienen consecuencias reales en la planta.
 *
 * Cada escenario incluye documentación descargable y pasos a seguir — es un
 * laboratorio para aprender el procedimiento, no botones de "ataque automático".
 */

import { useState, useEffect, useRef, useCallback } from "react";

const API_URL = "http://127.0.0.1:8000";

const C = {
  bg:"#05070d", term:"#02060c", panel:"#0a111c", border:"#17212f",
  green:"#7CFC9A", dim:"#4b5563", text:"#cbd5e1", amber:"#f59e0b",
  red:"#ef4444", cyan:"#22d3ee", mono:"'Fira Code','Consolas',monospace",
};

/* ── Escenarios con documentación y pasos (laboratorio) ── */
const SCENARIOS = [
  {
    id:"recon", name:"1 · Reconocimiento de red", sev:"MEDIUM", color:C.amber,
    objective:"Descubrir los activos OT y sus servicios desde la red corporativa.",
    context:"El atacante parte de una Kali en IT (192.168.100.66). Si la planta está bien segmentada, los equipos OT no responderán.",
    prereq:["Acceso a la red corporativa","Topología cargada (Excel importado)"],
    steps:[
      { cmd:"ifconfig", explain:"Confirma tu dirección y zona." },
      { cmd:"nmap -sn 172.16.0.0", explain:"Barrido de hosts (ping sweep) de la red OT." },
      { cmd:"nmap -sV 172.16.10.5", explain:"Escaneo de servicios/puertos de un host." },
    ],
    detection:"El SIEM registra RECON_NMAP. Un IDS en línea lo marcaría como barrido.",
    impact:"Ninguno directo; habilita las siguientes fases.",
    remediation:"Segmentar con firewall ENFORCING entre IT y OT; permitir solo flujos necesarios.",
  },
  {
    id:"plc_enum", name:"2 · Enumeración de PLC", sev:"HIGH", color:"#f97316",
    objective:"Identificar marca, modelo y firmware del PLC vía S7comm (102/tcp).",
    context:"Solo funciona si el PLC es alcanzable. Con firewall ENFORCING estará filtrado: primero hay que debilitar la seguridad.",
    prereq:["Haber descubierto la IP del PLC","Puerto 102 alcanzable"],
    steps:[
      { cmd:"plcscan 172.16.10.5", explain:"Enumera el PLC (si está filtrado, verás por qué)." },
      { cmd:"nmap --script s7-info 172.16.10.5", explain:"Equivalente con script NSE de nmap." },
    ],
    detection:"El SIEM registra RECON_PLC_ENUM (severidad HIGH).",
    impact:"Exposición de versión/firmware → selección de exploits.",
    remediation:"Bloquear 102/tcp desde zonas no autorizadas; activar protección de CPU con contraseña.",
  },
  {
    id:"weaken", name:"3 · Debilitar la seguridad (pivote)", sev:"HIGH", color:C.red,
    objective:"Conseguir acceso a la red OT cuando está segmentada.",
    context:"Si nmap muestra los OT como FILTRADOS, necesitas una vía: poner el firewall en BYPASS, agregar una regla PERMIT, o comprometer el eWON (acceso remoto) para pivotar.",
    prereq:["Firewall o eWON en la topología"],
    steps:[
      { cmd:"# Opción A: en la planta, abre el Firewall → 'PONER EN BYPASS'", explain:"Deja de inspeccionar: la red queda plana." },
      { cmd:"# Opción B: abre el eWON → 'EXPONER A INTERNET' y luego compromételo", explain:"El acceso remoto expuesto es el vector real #1 en OT." },
      { cmd:"nmap -sV 172.16.10.5", explain:"Re-escanea: ahora el PLC debería responder." },
    ],
    detection:"El SIEM registra FW_BYPASS / EWON_COMPROMISE (HIGH/CRITICAL).",
    impact:"Pérdida de segmentación → toda la red OT queda expuesta.",
    remediation:"Nunca dejar el firewall en BYPASS; aislar el eWON, MFA y acceso bajo demanda.",
  },
  {
    id:"sabotage", name:"4 · Sabotaje del proceso", sev:"CRITICAL", color:C.red,
    objective:"Detener la CPU del PLC y provocar paro de línea (prueba de concepto).",
    context:"Muchas CPUs S7 aceptan STOP/START sin autenticación. Esto tiene CONSECUENCIAS REALES en el lab: la línea se detiene y cae en cascada.",
    prereq:["PLC alcanzable (fase 3 completada)"],
    steps:[
      { cmd:"s7-stop 172.16.10.5", explain:"Envía STOP a la CPU. Observa la planta: equipos en rojo/naranja." },
    ],
    detection:"El SIEM dispara alarma crítica (PLC_STOP) y eventos de cascada.",
    impact:"Paro de producción; motores/válvulas aguas abajo fuera de servicio.",
    remediation:"Protección de CPU, listas de acceso, monitoreo de comandos S7, y restaurar desde respaldo.",
  },
];

function downloadDoc(sc) {
  const lines = [
    `OT CYBER RANGE — ESCENARIO: ${sc.name}`,
    "=".repeat(60), "",
    `Severidad: ${sc.sev}`, "",
    "OBJETIVO", "--------", sc.objective, "",
    "CONTEXTO", "--------", sc.context, "",
    "PRERREQUISITOS", "--------------", ...sc.prereq.map(p => `  - ${p}`), "",
    "PROCEDIMIENTO", "-------------",
    ...sc.steps.flatMap((s,i) => [`  ${i+1}. ${s.cmd}`, `     ${s.explain}`]), "",
    "DETECCIÓN", "---------", sc.detection, "",
    "IMPACTO", "-------", sc.impact, "",
    "REMEDIACIÓN", "-----------", sc.remediation, "",
    "Nota: laboratorio aislado. Estas técnicas no deben usarse jamás contra sistemas reales.",
  ];
  const blob = new Blob([lines.join("\n")], { type:"text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `escenario_${sc.id}.txt`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function AttackerConsole({ plant, alarms = [], labData }) {
  const [lines, setLines]   = useState([
    { t:"Kali GNU/Linux Rolling — OT Cyber Range (laboratorio aislado)", k:"sys" },
    { t:"Escribe 'help' para ver los comandos. Selecciona un escenario a la izquierda para la guía.", k:"dim" },
  ]);
  const [input, setInput]   = useState("");
  const [history, setHistory] = useState([]);
  const [hIdx, setHIdx]     = useState(-1);
  const [busy, setBusy]     = useState(false);
  const [posture, setPosture] = useState(null);
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [restoring, setRestoring] = useState(false);
  const termRef = useRef(null);
  const inputRef = useRef(null);

  const push = useCallback((arr) => setLines(l => [...l, ...arr]), []);

  // posture poll
  useEffect(() => {
    let t, cancel=false;
    const poll = async () => {
      try { const r = await fetch(`${API_URL}/api/attacker/info`); const d = await r.json(); if(!cancel) setPosture(d.posture); } catch {}
      t = setTimeout(poll, 2000);
    };
    poll();
    return () => { cancel=true; clearTimeout(t); };
  }, []);

  useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [lines]);

  const run = async (cmd) => {
    const command = cmd.trim();
    if (!command) return;
    push([{ t:`root@kali:~# ${command}`, k:"cmd" }]);
    setHistory(h => [...h, command]); setHIdx(-1); setInput("");
    if (command === "clear") { setLines([]); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/attacker/exec`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();
      if (data.output === "__CLEAR__") { setLines([]); }
      else {
        const out = String(data.output || "").split("\n").map(t => ({ t, k: colorLine(t) }));
        push(out);
      }
      if (data.posture) setPosture(data.posture);
    } catch {
      push([{ t:"[!] Sin conexión con el backend (inicia uvicorn).", k:"err" }]);
    } finally { setBusy(false); inputRef.current?.focus(); }
  };

  const onKey = (e) => {
    if (e.key === "Enter") run(input);
    else if (e.key === "ArrowUp") { e.preventDefault(); const i = hIdx < 0 ? history.length-1 : Math.max(0,hIdx-1); if(history[i]!=null){ setHIdx(i); setInput(history[i]); } }
    else if (e.key === "ArrowDown") { e.preventDefault(); const i = hIdx<0?-1:Math.min(history.length-1,hIdx+1); setHIdx(i); setInput(i<0?"":history[i]||""); }
  };

  const restore = async () => {
    setRestoring(true);
    try { await fetch(`${API_URL}/api/plant/restore`, { method:"POST" }); push([{ t:"[*] Planta restaurada al estado seguro.", k:"sys" }]); }
    catch { push([{ t:"[!] No se pudo restaurar.", k:"err" }]); }
    finally { setRestoring(false); }
  };

  const segmented = posture?.segmented && !posture?.pivot;

  return (
    <div style={{ display:"flex", height:"calc(100vh - 130px)", background:C.bg, fontFamily:"'Segoe UI',sans-serif" }}>

      {/* ── IZQUIERDA: escenarios + documentación ── */}
      <div style={{ width:340, flexShrink:0, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, background:C.panel }}>
          <div style={{ color:C.red, fontFamily:C.mono, fontSize:12, fontWeight:700, letterSpacing:".05em" }}>⚔ ESCENARIOS DE ATAQUE</div>
          <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, marginTop:2 }}>Laboratorio — sigue los pasos</div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:6, padding:10, overflow:"auto", flex:1 }}>
          {SCENARIOS.map(sc => (
            <button key={sc.id} onClick={() => setScenario(sc)}
              style={{ textAlign:"left", background: scenario.id===sc.id ? C.panel : "transparent", border:`1px solid ${scenario.id===sc.id ? sc.color : C.border}`, borderRadius:6, padding:"9px 12px", cursor:"pointer" }}>
              <div style={{ color:sc.color, fontFamily:C.mono, fontSize:11, fontWeight:700 }}>{sc.name}</div>
              <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, marginTop:2 }}>{sc.sev}</div>
            </button>
          ))}

          {/* documentación del escenario seleccionado */}
          <div style={{ marginTop:8, background:C.term, border:`1px solid ${C.border}`, borderRadius:8, padding:12 }}>
            <div style={{ display:"flex", alignItems:"center", marginBottom:8 }}>
              <span style={{ color:scenario.color, fontFamily:C.mono, fontSize:10, fontWeight:700 }}>DOCUMENTACIÓN</span>
              <div style={{ flex:1 }}/>
              <button onClick={() => downloadDoc(scenario)} style={{ background:`${C.cyan}18`, border:`1px solid ${C.cyan}`, color:C.cyan, padding:"3px 10px", borderRadius:4, cursor:"pointer", fontSize:9, fontFamily:C.mono, fontWeight:700 }}>⬇ Descargar</button>
            </div>
            <Doc label="Objetivo" text={scenario.objective}/>
            <Doc label="Contexto" text={scenario.context}/>
            <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, margin:"8px 0 4px", letterSpacing:".08em" }}>PASOS</div>
            {scenario.steps.map((s,i) => (
              <div key={i} style={{ marginBottom:6 }}>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <code onClick={() => !s.cmd.startsWith("#") && setInput(s.cmd)}
                    style={{ color: s.cmd.startsWith("#") ? C.dim : C.green, fontFamily:C.mono, fontSize:10, background:"#0d1520", padding:"3px 7px", borderRadius:4, cursor: s.cmd.startsWith("#")?"default":"pointer", flex:1, overflow:"hidden", textOverflow:"ellipsis" }}>
                    {s.cmd}
                  </code>
                  {!s.cmd.startsWith("#") && (
                    <button onClick={() => run(s.cmd)} style={{ background:`${scenario.color}18`, border:`1px solid ${scenario.color}`, color:scenario.color, padding:"2px 8px", borderRadius:3, cursor:"pointer", fontSize:8, fontFamily:C.mono, fontWeight:700 }}>▶</button>
                  )}
                </div>
                <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, marginTop:2 }}>{s.explain}</div>
              </div>
            ))}
            <Doc label="Detección" text={scenario.detection}/>
            <Doc label="Impacto" text={scenario.impact}/>
            <Doc label="Remediación" text={scenario.remediation}/>
          </div>
        </div>
      </div>

      {/* ── DERECHA: terminal ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* barra de estado */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 16px", background:C.panel, borderBottom:`1px solid ${C.border}` }}>
          <span style={{ color:C.green, fontFamily:C.mono, fontSize:11, fontWeight:700 }}>kali@ot-range</span>
          <span style={{ color:C.dim, fontFamily:C.mono, fontSize:10 }}>192.168.100.66 · zona IT</span>
          <div style={{ flex:1 }}/>
          {posture && (
            <span style={{ color: segmented ? C.green : C.red, fontFamily:C.mono, fontSize:10, fontWeight:700, border:`1px solid ${segmented ? C.green : C.red}44`, borderRadius:4, padding:"3px 10px" }}>
              {segmented ? "🔒 SEGMENTADA" : "🔓 ABIERTA"} — {posture.reason}
            </span>
          )}
          <button onClick={restore} disabled={restoring} style={{ background:`${C.cyan}18`, border:`1px solid ${C.cyan}`, color:C.cyan, padding:"4px 12px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono, fontWeight:700 }}>
            {restoring ? "…" : "⟲ RESTAURAR PLANTA"}
          </button>
        </div>

        {/* salida */}
        <div ref={termRef} onClick={() => inputRef.current?.focus()}
          style={{ flex:1, overflow:"auto", background:C.term, padding:"12px 16px", fontFamily:C.mono, fontSize:12.5, lineHeight:1.55, cursor:"text" }}>
          {lines.map((l,i) => (
            <div key={i} style={{ color: lineColor(l.k), whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{l.t}</div>
          ))}
          {/* línea de entrada */}
          <div style={{ display:"flex", alignItems:"center" }}>
            <span style={{ color:C.green, marginRight:8 }}>root@kali:~#</span>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
              spellCheck={false} autoFocus disabled={busy}
              style={{ flex:1, background:"transparent", border:"none", outline:"none", color:C.text, fontFamily:C.mono, fontSize:12.5, caretColor:C.green }}/>
            {busy && <span style={{ color:C.dim, fontSize:10 }}>…</span>}
          </div>
        </div>

        <div style={{ padding:"6px 16px", background:C.panel, borderTop:`1px solid ${C.border}`, color:C.dim, fontSize:9, fontFamily:C.mono }}>
          ↑/↓ historial · 'help' comandos · los resultados dependen del Excel y del estado de seguridad real de la planta.
        </div>
      </div>
    </div>
  );
}

function Doc({ label, text }) {
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".08em" }}>{label.toUpperCase()}</div>
      <div style={{ color:C.text, fontSize:10, fontFamily:C.mono, lineHeight:1.45 }}>{text}</div>
    </div>
  );
}

const colorLine = (t) => {
  if (/\[\!\]|CRITICAL|DETENIDA|filtrad|rechazada|down|Vulnerable/i.test(t)) return "err";
  if (/\[\+\]|open|Host is up|CPU state|up,/i.test(t)) return "ok";
  if (/>>|Para avanzar|Starting Nmap|postura/i.test(t)) return "warn";
  return "out";
};
const lineColor = (k) => ({ cmd:"#7CFC9A", ok:"#7CFC9A", err:"#ef4444", warn:"#f59e0b", sys:"#22d3ee", dim:"#4b5563", out:"#cbd5e1" }[k] || "#cbd5e1");