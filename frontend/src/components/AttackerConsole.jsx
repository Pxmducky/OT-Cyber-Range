/**
 * AttackerConsole.jsx
 * Consola Kali real: comandos escritos por el alumno + carga de SCRIPTS propios
 * (como en un Kali de verdad). Resultados según la topología del Excel y la
 * postura de seguridad. Los ejemplos NO se ejecutan solos: se insertan en la
 * línea de comandos con un marcador <IP> que el alumno completa a mano.
 */

import { useState, useEffect, useRef, useCallback } from "react";

const API_URL = "http://127.0.0.1:8000";
const C = {
  bg:"#05070d", term:"#02060c", panel:"#0a111c", border:"#17212f",
  green:"#7CFC9A", dim:"#4b5563", text:"#cbd5e1", amber:"#f59e0b",
  red:"#ef4444", cyan:"#22d3ee", mono:"'Fira Code','Consolas',monospace",
};

/* ── Escenarios: documentación + comandos de EJEMPLO con marcador <IP> ── */
const SCENARIOS = [
  {
    id:"recon", name:"1 · Reconocimiento", sev:"MEDIUM", color:C.amber,
    objective:"Descubrir los activos OT y sus servicios desde la red corporativa.",
    context:"Kali parte de IT. Con buena segmentación, los OT no responderán.",
    steps:[
      { cmd:"ifconfig", explain:"Tu dirección y zona." },
      { cmd:"nmap -sn <RED>  (ej: 172.16.0.0)", explain:"Barrido de hosts." },
      { cmd:"nmap -sV <IP>", explain:"Puertos y servicios de un host." },
    ],
    detection:"SIEM: RECON_NMAP.", impact:"Habilita las siguientes fases.",
    remediation:"Segmentar con firewall ENFORCING IT↔OT; permitir solo lo necesario.",
  },
  {
    id:"enum", name:"2 · Enumeración (PLC / OPC-UA)", sev:"HIGH", color:"#f97316",
    objective:"Identificar marca/firmware del PLC y navegar servidores OPC-UA.",
    context:"Solo si el objetivo es alcanzable. Si está filtrado, primero debilita la seguridad.",
    steps:[
      { cmd:"plcscan <IP-PLC>", explain:"Enumera el PLC (S7comm 102)." },
      { cmd:"nmap --script s7-info <IP-PLC>", explain:"Equivalente con NSE." },
      { cmd:"opcua-browse <IP-SCADA>", explain:"Enumera nodos OPC-UA (4840)." },
    ],
    detection:"SIEM: RECON_PLC_ENUM / RECON_OPCUA (HIGH).",
    impact:"Exposición de versión y nodos escribibles.",
    remediation:"Bloquear 102/4840 desde zonas no autorizadas; cifrado y contraseña de CPU.",
  },
  {
    id:"access", name:"3 · Acceso y credenciales", sev:"HIGH", color:C.red,
    objective:"Entrar a HMIs/servidores web y romper credenciales débiles.",
    context:"Muchos HMIs usan admin/admin. Útil contra HMI, SCADA, eWON.",
    steps:[
      { cmd:"curl <IP-HMI>", explain:"Revisa el servidor web del equipo." },
      { cmd:"hmi-login <IP-HMI> admin admin", explain:"Login con credenciales por defecto." },
      { cmd:"hydra <IP> http", explain:"Fuerza bruta (ssh/http/rdp/ftp)." },
    ],
    detection:"SIEM: HTTP_ACCESS / BRUTEFORCE.",
    impact:"Control del panel del operador; lectura/forzado de variables.",
    remediation:"Cambiar credenciales por defecto, MFA, deshabilitar servicios web no usados.",
  },
  {
    id:"weaken", name:"4 · Debilitar / pivotar", sev:"HIGH", color:C.red,
    objective:"Conseguir acceso a OT cuando está segmentada.",
    context:"Si nmap marca los OT como FILTRADOS: pon el firewall en BYPASS, agrega una regla PERMIT, o compromete el eWON para pivotar.",
    steps:[
      { cmd:"# En la planta: Firewall → 'PONER EN BYPASS'", explain:"Red plana." },
      { cmd:"# o eWON → 'EXPONER A INTERNET' y comprometerlo", explain:"Pivote remoto (vector #1 en OT)." },
      { cmd:"nmap -sV <IP-PLC>", explain:"Re-escanea: ahora debería responder." },
    ],
    detection:"SIEM: FW_BYPASS / EWON_COMPROMISE.",
    impact:"Pérdida de segmentación: toda la OT expuesta.",
    remediation:"Nunca BYPASS; aislar el eWON, MFA, acceso bajo demanda.",
  },
  {
    id:"sabotage", name:"5 · Sabotaje del proceso", sev:"CRITICAL", color:C.red,
    objective:"Detener/alterar el proceso (prueba de concepto). ¡Consecuencias reales!",
    context:"Con el objetivo alcanzable, estas acciones mueven la planta de verdad.",
    steps:[
      { cmd:"s7-stop <IP-PLC>", explain:"STOP a la CPU → para la línea (cascada)." },
      { cmd:"modbus-write <IP-MOTOR> 40001 0", explain:"Escribe un registro → mueve el actuador." },
      { cmd:"dos <IP>", explain:"Denegación de servicio → deja el equipo fuera." },
    ],
    detection:"SIEM: PLC_STOP / MODBUS_WRITE / DOS_ATTACK (CRITICAL).",
    impact:"Paro de producción; equipos aguas abajo fuera de servicio.",
    remediation:"Protección de CPU, ACLs, monitoreo de comandos, restaurar desde respaldo.",
  },
  {
    id:"script", name:"6 · Script propio", sev:"INFO", color:C.cyan,
    objective:"Cargar y ejecutar tu propio código contra el laboratorio.",
    context:"Abre el panel 'Script'. Puedes escribir variables, comandos del lab, e incluso idioms de Python (pymodbus/snap7/requests) que se traducen a efectos reales — todo en sandbox.",
    steps:[
      { cmd:"# Pulsa el botón 'Script' arriba a la derecha", explain:"Abre el editor." },
      { cmd:"TARGET = \"<IP-PLC>\"", explain:"Define tu objetivo." },
      { cmd:"nmap -sV $TARGET", explain:"Usa la variable en comandos." },
    ],
    detection:"Cada acción del script genera sus propios eventos en el SIEM.",
    impact:"Depende de lo que programes.",
    remediation:"Igual que en cada fase según lo que ejecute tu script.",
  },
];

const SCRIPT_EXAMPLE = `# Script de ejemplo — reemplaza las IPs por las de tu lab
TARGET = "<IP-DEL-PLC>"
MOTOR  = "<IP-DEL-MOTOR>"

# 1) reconocimiento
nmap -sV $TARGET
plcscan $TARGET

# 2) idioms de Python (se traducen a efectos reales)
client = ModbusTcpClient("<IP-DEL-MOTOR>")
client.write_register(40001, 1500)

# 3) sabotaje
s7-stop $TARGET
`;

function downloadDoc(sc) {
  const lines = [
    `OT CYBER RANGE — ESCENARIO: ${sc.name}`, "=".repeat(60), "",
    `Severidad: ${sc.sev}`, "", "OBJETIVO", "--------", sc.objective, "",
    "CONTEXTO", "--------", sc.context, "", "PROCEDIMIENTO", "-------------",
    ...sc.steps.flatMap((s,i)=>[`  ${i+1}. ${s.cmd}`, `     ${s.explain}`]), "",
    "DETECCIÓN", "---------", sc.detection, "", "IMPACTO", "-------", sc.impact, "",
    "REMEDIACIÓN", "-----------", sc.remediation, "",
    "Laboratorio aislado. No usar estas técnicas contra sistemas reales.",
  ];
  const blob = new Blob([lines.join("\n")], { type:"text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = `escenario_${sc.id}.txt`; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function AttackerConsole({ plant, alarms = [], labData }) {
  const [lines, setLines] = useState([
    { t:"Kali GNU/Linux Rolling — OT Cyber Range (laboratorio aislado)", k:"sys" },
    { t:"'help' lista los comandos · botón 'Script' para cargar tu propio código.", k:"dim" },
    { t:"Los ejemplos usan <IP>: haz clic para insertarlos y reemplaza por tu IP real.", k:"dim" },
  ]);
  const [input, setInput]   = useState("");
  const [history, setHistory] = useState([]);
  const [hIdx, setHIdx]     = useState(-1);
  const [busy, setBusy]     = useState(false);
  const [posture, setPosture] = useState(null);
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [restoring, setRestoring] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [scriptText, setScriptText] = useState(SCRIPT_EXAMPLE);
  const termRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const push = useCallback((arr)=>setLines(l=>[...l, ...arr]), []);

  useEffect(() => {
    let t, cancel=false;
    const poll = async () => {
      try { const r=await fetch(`${API_URL}/api/attacker/info`); const d=await r.json(); if(!cancel) setPosture(d.posture); } catch {}
      t=setTimeout(poll, 2000);
    };
    poll(); return ()=>{ cancel=true; clearTimeout(t); };
  }, []);
  useEffect(()=>{ if(termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [lines]);

  const run = async (cmd) => {
    const command = (cmd ?? input).trim();
    if (!command) return;
    push([{ t:`root@kali:~# ${command}`, k:"cmd" }]);
    setHistory(h=>[...h, command]); setHIdx(-1); setInput("");
    if (command === "clear") { setLines([]); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/attacker/exec`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ command }) });
      const data = await res.json();
      if (data.output === "__CLEAR__") setLines([]);
      else push(String(data.output||"").split("\n").map(t=>({ t, k:colorLine(t) })));
      if (data.posture) setPosture(data.posture);
    } catch { push([{ t:"[!] Sin conexión con el backend (inicia uvicorn).", k:"err" }]); }
    finally { setBusy(false); inputRef.current?.focus(); }
  };

  const runScript = async () => {
    if (!scriptText.trim()) return;
    setShowScript(false);
    push([{ t:"root@kali:~# ./exploit.py   (script del usuario)", k:"cmd" }]);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/attacker/run`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ script: scriptText }) });
      const data = await res.json();
      push(String(data.output||"").split("\n").map(t=>({ t, k:colorLine(t) })));
      if (data.posture) setPosture(data.posture);
    } catch { push([{ t:"[!] Sin conexión con el backend.", k:"err" }]); }
    finally { setBusy(false); }
  };

  const loadFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { setScriptText(String(r.result||"")); };
    r.readAsText(f); e.target.value = "";
  };

  const insert = (cmd) => {
    if (cmd.startsWith("#")) return;
    setInput(cmd); inputRef.current?.focus();
  };

  const onKey = (e) => {
    if (e.key==="Enter") run();
    else if (e.key==="ArrowUp") { e.preventDefault(); const i=hIdx<0?history.length-1:Math.max(0,hIdx-1); if(history[i]!=null){ setHIdx(i); setInput(history[i]); } }
    else if (e.key==="ArrowDown") { e.preventDefault(); const i=hIdx<0?-1:Math.min(history.length-1,hIdx+1); setHIdx(i); setInput(i<0?"":history[i]||""); }
  };

  const restore = async () => {
    setRestoring(true);
    try { await fetch(`${API_URL}/api/plant/restore`, { method:"POST" }); push([{ t:"[*] Planta restaurada al estado seguro.", k:"sys" }]); }
    catch { push([{ t:"[!] No se pudo restaurar.", k:"err" }]); } finally { setRestoring(false); }
  };

  const segmented = posture?.segmented && !posture?.pivot;

  return (
    <div style={{ display:"flex", height:"calc(100vh - 130px)", background:C.bg, fontFamily:"'Segoe UI',sans-serif", position:"relative" }}>
      {/* ── IZQUIERDA: escenarios + docs ── */}
      <div style={{ width:340, flexShrink:0, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, background:C.panel }}>
          <div style={{ color:C.red, fontFamily:C.mono, fontSize:12, fontWeight:700, letterSpacing:".05em" }}>⚔ ESCENARIOS DE ATAQUE</div>
          <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, marginTop:2 }}>Laboratorio — clic en un comando para insertarlo</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, padding:10, overflow:"auto", flex:1 }}>
          {SCENARIOS.map(sc => (
            <button key={sc.id} onClick={()=>setScenario(sc)}
              style={{ textAlign:"left", background: scenario.id===sc.id?C.panel:"transparent", border:`1px solid ${scenario.id===sc.id?sc.color:C.border}`, borderRadius:6, padding:"9px 12px", cursor:"pointer" }}>
              <div style={{ color:sc.color, fontFamily:C.mono, fontSize:11, fontWeight:700 }}>{sc.name}</div>
              <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, marginTop:2 }}>{sc.sev}</div>
            </button>
          ))}

          <div style={{ marginTop:8, background:C.term, border:`1px solid ${C.border}`, borderRadius:8, padding:12 }}>
            <div style={{ display:"flex", alignItems:"center", marginBottom:8 }}>
              <span style={{ color:scenario.color, fontFamily:C.mono, fontSize:10, fontWeight:700 }}>DOCUMENTACIÓN</span>
              <div style={{ flex:1 }}/>
              <button onClick={()=>downloadDoc(scenario)} style={{ background:`${C.cyan}18`, border:`1px solid ${C.cyan}`, color:C.cyan, padding:"3px 10px", borderRadius:4, cursor:"pointer", fontSize:9, fontFamily:C.mono, fontWeight:700 }}>⬇ Descargar</button>
            </div>
            <Doc label="Objetivo" text={scenario.objective}/>
            <Doc label="Contexto" text={scenario.context}/>
            <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, margin:"8px 0 4px", letterSpacing:".08em" }}>PASOS (clic = insertar)</div>
            {scenario.steps.map((s,i) => (
              <div key={i} style={{ marginBottom:6 }}>
                <code onClick={()=>insert(s.cmd)}
                  style={{ display:"block", color: s.cmd.startsWith("#")?C.dim:C.green, fontFamily:C.mono, fontSize:10, background:"#0d1520", padding:"4px 7px", borderRadius:4, cursor: s.cmd.startsWith("#")?"default":"pointer", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {s.cmd}
                </code>
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
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 16px", background:C.panel, borderBottom:`1px solid ${C.border}` }}>
          <span style={{ color:C.green, fontFamily:C.mono, fontSize:11, fontWeight:700 }}>kali@ot-range</span>
          <span style={{ color:C.dim, fontFamily:C.mono, fontSize:10 }}>192.168.100.66 · zona IT</span>
          <div style={{ flex:1 }}/>
          {posture && (
            <span style={{ color: segmented?C.green:C.red, fontFamily:C.mono, fontSize:10, fontWeight:700, border:`1px solid ${(segmented?C.green:C.red)}44`, borderRadius:4, padding:"3px 10px" }}>
              {segmented?"🔒 SEGMENTADA":"🔓 ABIERTA"} — {posture.reason}
            </span>
          )}
          <button onClick={()=>setShowScript(s=>!s)} style={{ background:`${C.amber}18`, border:`1px solid ${C.amber}`, color:C.amber, padding:"4px 12px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono, fontWeight:700 }}>📜 Script</button>
          <button onClick={restore} disabled={restoring} style={{ background:`${C.cyan}18`, border:`1px solid ${C.cyan}`, color:C.cyan, padding:"4px 12px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono, fontWeight:700 }}>{restoring?"…":"⟲ RESTAURAR"}</button>
        </div>

        <div ref={termRef} onClick={()=>inputRef.current?.focus()}
          style={{ flex:1, overflow:"auto", background:C.term, padding:"12px 16px", fontFamily:C.mono, fontSize:12.5, lineHeight:1.55, cursor:"text" }}>
          {lines.map((l,i)=>(<div key={i} style={{ color:lineColor(l.k), whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{l.t}</div>))}
          <div style={{ display:"flex", alignItems:"center" }}>
            <span style={{ color:C.green, marginRight:8 }}>root@kali:~#</span>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey}
              spellCheck={false} autoFocus disabled={busy}
              style={{ flex:1, background:"transparent", border:"none", outline:"none", color:C.text, fontFamily:C.mono, fontSize:12.5, caretColor:C.green }}/>
            {busy && <span style={{ color:C.dim, fontSize:10 }}>…</span>}
          </div>
        </div>

        <div style={{ padding:"6px 16px", background:C.panel, borderTop:`1px solid ${C.border}`, color:C.dim, fontSize:9, fontFamily:C.mono }}>
          ↑/↓ historial · 'help' comandos · los resultados dependen del Excel y del estado de seguridad real.
        </div>
      </div>

      {/* ── MODAL SCRIPT ── */}
      {showScript && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:20 }}>
          <div style={{ width:620, maxWidth:"92%", background:C.panel, border:`1px solid ${C.amber}`, borderRadius:10, padding:16, boxShadow:"0 12px 40px rgba(0,0,0,.6)" }}>
            <div style={{ display:"flex", alignItems:"center", marginBottom:10 }}>
              <span style={{ color:C.amber, fontFamily:C.mono, fontSize:13, fontWeight:700 }}>📜 EJECUTAR SCRIPT PROPIO</span>
              <div style={{ flex:1 }}/>
              <button onClick={()=>fileRef.current?.click()} style={{ background:`${C.cyan}18`, border:`1px solid ${C.cyan}`, color:C.cyan, padding:"4px 12px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono, fontWeight:700, marginRight:8 }}>📂 Cargar archivo</button>
              <button onClick={()=>setShowScript(false)} style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"4px 10px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono }}>✕</button>
              <input ref={fileRef} type="file" accept=".txt,.py,.sh,.rb" onChange={loadFile} style={{ display:"none" }}/>
            </div>
            <div style={{ color:C.dim, fontSize:10, fontFamily:C.mono, marginBottom:8, lineHeight:1.5 }}>
              Escribe tu código (variables, comandos del lab, e idioms de Python). Reemplaza los &lt;IP&gt; por las IPs reales. Se ejecuta en sandbox.
            </div>
            <textarea value={scriptText} onChange={e=>setScriptText(e.target.value)} spellCheck={false}
              style={{ width:"100%", height:260, background:C.term, border:`1px solid ${C.border}`, color:C.green, fontFamily:C.mono, fontSize:12, lineHeight:1.5, padding:12, borderRadius:8, outline:"none", resize:"vertical", boxSizing:"border-box", whiteSpace:"pre" }}/>
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <button onClick={runScript} style={{ flex:1, background:`${C.green}20`, border:`1px solid ${C.green}`, color:C.green, padding:"10px", borderRadius:6, cursor:"pointer", fontSize:11, fontFamily:C.mono, fontWeight:700 }}>▶ EJECUTAR SCRIPT</button>
              <button onClick={()=>setScriptText(SCRIPT_EXAMPLE)} style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"10px 14px", borderRadius:6, cursor:"pointer", fontSize:10, fontFamily:C.mono }}>Ejemplo</button>
            </div>
          </div>
        </div>
      )}
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
  if (/\[\!\]|CRITICAL|DETENIDA|filtrad|rechazada|down|Vulnerable|no responder|SIN auten/i.test(t)) return "err";
  if (/\[\+\]|open|Host is up|CPU state|up,|Login OK|password:|completado/i.test(t)) return "ok";
  if (/>>|Para avanzar|Starting Nmap|postura|\[var\]|\[\*\]|root@kali/i.test(t)) return "warn";
  if (/\[py\]/i.test(t)) return "dim";
  return "out";
};
const lineColor = (k) => ({ cmd:"#7CFC9A", ok:"#7CFC9A", err:"#ef4444", warn:"#f59e0b", sys:"#22d3ee", dim:"#4b5563", out:"#cbd5e1" }[k] || "#cbd5e1");