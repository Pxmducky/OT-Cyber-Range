/**
 * FirewallInterface.jsx
 * Interfaz estilo Palo Alto (PAN-OS) para el firewall OT.
 * Lee el rulebase y el tráfico reales del backend y permite configurar
 * políticas (allow/deny por zona y aplicación) con COMMIT. Las reglas tienen
 * efecto real: cambian lo que el atacante puede escanear/atacar.
 */

import { useState, useEffect, useRef, useCallback } from "react";

//const API_URL = "http://127.0.0.1:8000";
import { API_URL } from "../../utils/config";

const C = {
  bg:"#1b1b1b", panel:"#252526", bar:"#2e2e2e", border:"#3a3a3a",
  text:"#e8e8e8", dim:"#8a8a8a", green:"#95d600", greenD:"#6f9f00",
  red:"#e4572e", blue:"#2aa5d6", amber:"#f0a500",
  mono:"'Consolas','Courier New',monospace", sans:"'Segoe UI',sans-serif",
};
const ZONES = ["any", "IT", "DMZ", "OT"];
const APPS  = ["any","s7comm","opcua","modbus","profinet","ethernet-ip","dnp3","web-browsing","ssl","ssh","ms-rdp","snmp","ping"];

export default function FirewallInterface({ asset, onBack }) {
  const [fw, setFw]         = useState(null);
  const [rules, setRules]   = useState([]);     // copia editable
  const [dirty, setDirty]   = useState(false);
  const [tab, setTab]       = useState("policies");
  const [msg, setMsg]       = useState(null);
  const [notFound, setNotFound] = useState(false);
  const committedRef = useRef("");

  const flash = useCallback((ok, t) => { setMsg({ ok, t }); setTimeout(()=>setMsg(null), 2500); }, []);

  // poll del firewall (no pisa la edición en curso)
  useEffect(() => {
    let timer, cancel=false;
    const poll = async () => {
      try {
        const r = await fetch(`${API_URL}/api/firewall/${encodeURIComponent(asset.id)}`);
        if (r.status === 404) { if(!cancel) setNotFound(true); }
        else { const d = await r.json(); if(!cancel){ setNotFound(false); setFw(d);
          const sig = JSON.stringify(d.rules);
          if (!dirty) { setRules(d.rules); committedRef.current = sig; }
        }}
      } catch {}
      timer = setTimeout(poll, 1500);
    };
    poll();
    return () => { cancel=true; clearTimeout(timer); };
  }, [asset.id, dirty]);

  const mode = fw?.mode || "ENFORCING";
  const markDirty = (next) => { setRules(next); setDirty(true); };

  const updateRule = (i, patch) => markDirty(rules.map((r,idx)=> idx===i ? {...r, ...patch} : r));
  const delRule    = (i) => markDirty(rules.filter((_,idx)=>idx!==i));
  const move       = (i, d) => { const j=i+d; if(j<0||j>=rules.length) return; const a=[...rules]; [a[i],a[j]]=[a[j],a[i]]; markDirty(a); };
  const addRule    = () => markDirty([...rules, { name:`regla-${rules.length+1}`, from:"IT", to:"OT", app:["any"], action:"deny", log:true }]);

  const commit = async (overrideMode) => {
    try {
      const body = { rules: rules.map(r => ({...r, app: Array.isArray(r.app) ? r.app : String(r.app).split(",").map(x=>x.trim()).filter(Boolean) })) };
      if (overrideMode) body.mode = overrideMode;
      const r = await fetch(`${API_URL}/api/firewall/${encodeURIComponent(asset.id)}/commit`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body),
      });
      const d = await r.json();
      setFw(d); setRules(d.rules); setDirty(false); committedRef.current = JSON.stringify(d.rules);
      flash(true, "Commit aplicado");
    } catch { flash(false, "Error en commit"); }
  };

  if (notFound) {
    return (
      <div style={{ height:"100%", background:C.bg, color:C.dim, fontFamily:C.sans, display:"flex", flexDirection:"column" }}>
        <TopBar asset={asset} onBack={onBack} mode="—"/>
        <div style={{ padding:30, fontFamily:C.mono, fontSize:12 }}>
          Este firewall no está cargado en el backend. Importa el Excel (con un activo tipo Firewall) para activarlo.
        </div>
      </div>
    );
  }

  return (
    <div style={{ height:"100%", background:C.bg, display:"flex", flexDirection:"column", fontFamily:C.sans }}>
      <TopBar asset={asset} onBack={onBack} mode={mode}
        onToggleMode={() => commit(mode === "ENFORCING" ? "BYPASS" : "ENFORCING")}
        counters={fw?.counters} msg={msg}/>

      {/* tabs PAN-OS */}
      <div style={{ display:"flex", background:C.bar, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        {[["dashboard","Dashboard"],["policies","Policies"],["objects","Objects"],["monitor","Monitor"]].map(([id,label]) => (
          <button key={id} onClick={()=>setTab(id)} style={{
            background: tab===id ? C.bg : "transparent", border:"none",
            borderBottom: tab===id ? `2px solid ${C.green}` : "2px solid transparent",
            color: tab===id ? C.green : C.dim, padding:"9px 18px", cursor:"pointer",
            fontFamily:C.sans, fontSize:12, fontWeight:600 }}>{label}</button>
        ))}
      </div>

      <div style={{ flex:1, overflow:"auto", padding:16 }}>
        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
            {[
              ["Modo", mode, mode==="BYPASS"?C.red:C.green],
              ["Reglas", fw?.counters?.rules ?? "—", C.text],
              ["Sesiones permitidas", fw?.counters?.allowed ?? 0, C.green],
              ["Sesiones denegadas", fw?.counters?.denied ?? 0, C.red],
            ].map(([l,v,col]) => (
              <div key={l} style={card()}>
                <div style={{ color:C.dim, fontSize:10, marginBottom:6 }}>{l}</div>
                <div style={{ color:col, fontSize:22, fontWeight:700, fontFamily:C.mono }}>{v}</div>
              </div>
            ))}
            <div style={{ ...card(), gridColumn:"1 / -1" }}>
              <div style={{ color:C.dim, fontSize:10, marginBottom:8 }}>ZONAS DE SEGURIDAD</div>
              <div style={{ display:"flex", gap:10 }}>
                {(fw?.zones || ZONES.slice(1)).map(z => (
                  <div key={z} style={{ background:C.bar, border:`1px solid ${C.border}`, borderRadius:6, padding:"8px 16px", color:z==="OT"?C.green:z==="DMZ"?C.amber:C.blue, fontFamily:C.mono, fontWeight:700 }}>{z}</div>
                ))}
              </div>
              <div style={{ color:C.dim, fontSize:10, marginTop:10, fontFamily:C.mono }}>
                IT (corporativo) · DMZ (Historian/MES/servidores/eWON) · OT (control y campo)
              </div>
            </div>
          </div>
        )}

        {/* ── POLICIES ── */}
        {tab === "policies" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", marginBottom:10 }}>
              <span style={{ color:C.text, fontSize:13, fontWeight:600 }}>Security Policy Rulebase</span>
              <div style={{ flex:1 }}/>
              <button onClick={addRule} style={btn(C.blue, false)}>+ Añadir regla</button>
              <button onClick={() => commit()} disabled={!dirty} style={{ ...btn(C.green, !dirty), marginLeft:8 }}>
                {dirty ? "● COMMIT" : "COMMIT"}
              </button>
            </div>
            {dirty && <div style={{ color:C.amber, fontSize:10, fontFamily:C.mono, marginBottom:8 }}>Cambios sin aplicar — pulsa COMMIT para que tengan efecto.</div>}

            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
              <thead>
                <tr style={{ background:C.bar, color:C.dim }}>
                  {["#","Nombre","Origen","Destino","Aplicación","Acción","Log",""].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"8px 10px", borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map((r,i) => (
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background: r.action==="deny" ? "rgba(228,87,46,0.06)" : "transparent" }}>
                    <td style={{ padding:"6px 10px", color:C.dim, fontFamily:C.mono }}>{i+1}</td>
                    <td style={{ padding:"6px 10px" }}>
                      <input value={r.name} onChange={e=>updateRule(i,{name:e.target.value})} style={inp(120)}/>
                    </td>
                    <td style={{ padding:"6px 10px" }}>
                      <select value={r.from} onChange={e=>updateRule(i,{from:e.target.value})} style={inp(70)}>{ZONES.map(z=><option key={z}>{z}</option>)}</select>
                    </td>
                    <td style={{ padding:"6px 10px" }}>
                      <select value={r.to} onChange={e=>updateRule(i,{to:e.target.value})} style={inp(70)}>{ZONES.map(z=><option key={z}>{z}</option>)}</select>
                    </td>
                    <td style={{ padding:"6px 10px" }}>
                      <input value={Array.isArray(r.app)?r.app.join(","):r.app} onChange={e=>updateRule(i,{app:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}
                        list="apps" style={inp(150)}/>
                    </td>
                    <td style={{ padding:"6px 10px" }}>
                      <button onClick={()=>updateRule(i,{action: r.action==="allow"?"deny":"allow"})}
                        style={{ background: r.action==="allow"?"rgba(149,214,0,.15)":"rgba(228,87,46,.15)", border:`1px solid ${r.action==="allow"?C.green:C.red}`, color:r.action==="allow"?C.green:C.red, padding:"3px 10px", borderRadius:4, cursor:"pointer", fontSize:10, fontFamily:C.mono, fontWeight:700 }}>
                        {r.action==="allow"?"ALLOW":"DENY"}
                      </button>
                    </td>
                    <td style={{ padding:"6px 10px" }}>
                      <input type="checkbox" checked={!!r.log} onChange={e=>updateRule(i,{log:e.target.checked})}/>
                    </td>
                    <td style={{ padding:"6px 10px", whiteSpace:"nowrap" }}>
                      <button onClick={()=>move(i,-1)} style={mini()}>↑</button>
                      <button onClick={()=>move(i,1)} style={mini()}>↓</button>
                      <button onClick={()=>delRule(i)} style={{...mini(), color:C.red}}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="apps">{APPS.map(a=><option key={a} value={a}/>)}</datalist>
            <div style={{ color:C.dim, fontSize:10, fontFamily:C.mono, marginTop:10 }}>
              Primera coincidencia gana (orden importa). Lo que no coincide: <b style={{color:C.red}}>deny</b> implícito.
            </div>
          </div>
        )}

        {/* ── OBJECTS / ZONES ── */}
        {tab === "objects" && (
          <div>
            <div style={{ color:C.text, fontSize:13, fontWeight:600, marginBottom:10 }}>Zonas de seguridad</div>
            {(fw?.zones || ZONES.slice(1)).map(z => (
              <div key={z} style={{ display:"flex", alignItems:"center", gap:12, ...card(), marginBottom:8 }}>
                <div style={{ color:z==="OT"?C.green:z==="DMZ"?C.amber:C.blue, fontFamily:C.mono, fontWeight:700, minWidth:60 }}>{z}</div>
                <div style={{ color:C.dim, fontSize:11, fontFamily:C.mono }}>
                  {z==="OT" ? "Control y campo: PLC, HMI, SCADA, motores, válvulas, sensores" :
                   z==="DMZ" ? "Perímetro industrial: Historian, MES, servidores, eWON" :
                   "Corporativo: estaciones de ingeniería, IT"}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── MONITOR ── */}
        {tab === "monitor" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", marginBottom:10 }}>
              <span style={{ color:C.text, fontSize:13, fontWeight:600 }}>Traffic Log</span>
              <div style={{ flex:1 }}/>
              <span style={{ color:C.green, fontFamily:C.mono, fontSize:11 }}>allow {fw?.counters?.allowed ?? 0}</span>
              <span style={{ color:C.red, fontFamily:C.mono, fontSize:11, marginLeft:12 }}>deny {fw?.counters?.denied ?? 0}</span>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, fontFamily:C.mono }}>
              <thead>
                <tr style={{ background:C.bar, color:C.dim }}>
                  {["#","From","To","Source","Destination","App","Action","Rule"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"6px 10px", borderBottom:`1px solid ${C.border}`, fontSize:9 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(fw?.traffic || []).slice().reverse().map((t) => (
                  <tr key={t.seq} style={{ borderBottom:`1px solid ${C.border}22` }}>
                    <td style={{ padding:"4px 10px", color:C.dim }}>{t.seq}</td>
                    <td style={{ padding:"4px 10px", color:C.blue }}>{t.from}</td>
                    <td style={{ padding:"4px 10px", color:C.blue }}>{t.to}</td>
                    <td style={{ padding:"4px 10px", color:C.text }}>{t.src}</td>
                    <td style={{ padding:"4px 10px", color:C.text }}>{t.dst}</td>
                    <td style={{ padding:"4px 10px", color:C.amber }}>{t.app}</td>
                    <td style={{ padding:"4px 10px", color: t.action==="allow"?C.green:C.red, fontWeight:700 }}>{t.action.toUpperCase()}</td>
                    <td style={{ padding:"4px 10px", color:C.dim }}>{t.rule}</td>
                  </tr>
                ))}
                {(!fw?.traffic || fw.traffic.length===0) && (
                  <tr><td colSpan={8} style={{ padding:14, color:C.dim }}>Sin tráfico registrado todavía.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function TopBar({ asset, onBack, mode, onToggleMode, counters, msg }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", background:"linear-gradient(180deg,#2e2e2e,#232323)", borderBottom:`2px solid ${C.green}`, flexShrink:0 }}>
      <button onClick={onBack} style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"4px 12px", borderRadius:4, cursor:"pointer", fontSize:10, fontFamily:C.mono }}>← VOLVER</button>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:10, height:10, borderRadius:"50%", background:C.green, boxShadow:`0 0 6px ${C.green}` }}/>
        <div>
          <div style={{ color:"#fff", fontWeight:800, fontSize:13, letterSpacing:".04em" }}>paloalto<span style={{color:C.green}}>NETWORKS</span></div>
          <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>{asset.id} · {asset.model || asset.type || "PA-Series"}</div>
        </div>
      </div>
      <div style={{ flex:1 }}/>
      {msg && <div style={{ color: msg.ok?C.green:C.red, fontSize:10, fontFamily:C.mono, border:`1px solid ${(msg.ok?C.green:C.red)}55`, borderRadius:4, padding:"2px 8px" }}>{msg.t}</div>}
      {onToggleMode && (
        <button onClick={onToggleMode} style={{ background: mode==="BYPASS"?"rgba(228,87,46,.15)":"rgba(149,214,0,.12)", border:`1px solid ${mode==="BYPASS"?C.red:C.green}`, color: mode==="BYPASS"?C.red:C.green, padding:"5px 12px", borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:C.mono, fontWeight:700 }}>
          {mode==="BYPASS" ? "⚠ BYPASS — activar inspección" : "● ENFORCING"}
        </button>
      )}
    </div>
  );
}

const card = () => ({ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:"14px 16px" });
const btn = (color, dis) => ({ background: dis?"transparent":`${color}22`, border:`1px solid ${dis?C.border:color}`, color: dis?C.dim:color, padding:"6px 14px", borderRadius:5, cursor: dis?"not-allowed":"pointer", fontFamily:C.mono, fontSize:11, fontWeight:700 });
const inp = (w) => ({ background:C.bg, border:`1px solid ${C.border}`, color:C.text, padding:"4px 7px", borderRadius:4, fontSize:10, fontFamily:C.mono, width:w, outline:"none" });
const mini = () => ({ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"2px 7px", borderRadius:3, cursor:"pointer", fontSize:10, fontFamily:C.mono, marginLeft:3 });