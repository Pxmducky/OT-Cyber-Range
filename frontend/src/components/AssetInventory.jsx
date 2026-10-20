/**
 * AssetInventory.jsx
 * Visibilidad de activos OT estilo Claroty / Nozomi.
 *   · Listado con KPIs, gráficas, búsqueda, filtros, orden y export CSV.
 *   · Clic en un activo → PANTALLA DEDICADA de detalle con imagen del equipo,
 *     todos sus datos, puertos/servicios, estado vivo y comunicaciones.
 */

import { useState, useEffect, useMemo, useCallback } from "react";

//const API_URL = "http://127.0.0.1:8000";
import { API_URL } from "../utils/config";
const C = {
  bg:"#070b12", panel:"#0d1520", card:"#0a1018", text:"#e2e8f0", dim:"#64748b", border:"#1e293b",
  accent:"#22d3ee", green:"#22c55e", amber:"#f59e0b", red:"#ef4444", purple:"#818cf8",
  mono:"'Consolas','Courier New',monospace", sans:"'Segoe UI',sans-serif",
};
const HEALTH_COL = { normal:"#22c55e", warning:"#f59e0b", critical:"#ef4444" };
const CRIT_COL = (c="") => /crit|alta|high|crít/i.test(c) ? C.red : /med/i.test(c) ? C.amber : /baj|low/i.test(c) ? C.green : C.dim;
const zoneOfLevel = (pl) => { const n=parseFloat(pl); if(Number.isNaN(n))return "OT"; if(n>=4)return "IT"; if(n===3.5)return "DMZ"; return "OT"; };

/* ── Imagen / categoría del activo ── */
function categoryOf(type="") {
  const t = type.toUpperCase();
  if (/EWON|VPN|ACCESO REMOTO|GATEWAY/.test(t)) return "gateway";
  if (/FIREWALL|MGUARD|PALO ALTO|NGFW/.test(t)) return "firewall";
  if (/SWITCH|ROUTER|CONMUTADOR/.test(t)) return "switch";
  if (/PLC|RTU|CONTROLADOR|CONTROLLER|DCS|SAFETY/.test(t)) return "plc";
  if (/CNC|ROBOT|MAQUINA|MACHINE|CELDA/.test(t)) return "machine";
  if (/MOTOR|DRIVE|VFD|VARIADOR|SERVO/.test(t)) return "motor";
  if (/BOMBA|PUMP/.test(t)) return "pump";
  if (/VALV|ELECTROVAL|ACTUADOR/.test(t)) return "valve";
  if (/SENSOR|TRANSMI|ENCODER|INDUCTIV|FOTOCEL|DETECTOR|VISION|CAMARA|PRESION|TEMPERATURA|FLUJO|NIVEL|PROXIM|REMOTE I\/O|IO REMOT/.test(t)) return "sensor";
  if (/HMI|PANEL|OPERADOR/.test(t)) return "hmi";
  if (/SCADA/.test(t)) return "scada";
  if (/HISTORIAN|HISTORIADOR/.test(t)) return "historian";
  if (/MES/.test(t)) return "mes";
  if (/WORKSTATION|INGENIER|ESTACION|EWS|IPC/.test(t)) return "workstation";
  if (/SERVER|SERVIDOR|JUMP|BASTION/.test(t)) return "server";
  return "generic";
}
const IMG_BY_CAT = {
  plc:"/equipment/plc-siemens.jpg", hmi:"/equipment/hmi-siemens.jpg",
  scada:"/equipment/engineering-station.jpg", historian:"/equipment/engineering-station.jpg",
  mes:"/equipment/engineering-station.jpg", server:"/equipment/engineering-station.jpg",
  workstation:"/equipment/engineering-station.jpg", gateway:"/equipment/ewon-hms.jpg",
  switch:"/equipment/switch-siemens.jpg", firewall:"/equipment/switch-siemens.jpg",
};
const EMOJI_BY_CAT = { plc:"🖥", hmi:"📟", scada:"🖥", historian:"🗄", mes:"🏷", server:"🖲", workstation:"💻", gateway:"🌐", switch:"🔀", firewall:"🧱", motor:"⚙", pump:"🌀", valve:"🔧", sensor:"📡", machine:"🏭", generic:"📦" };
const PROTO_PORT = { S7COMM:102,S7:102,"OPC-UA":4840,OPCUA:4840,MODBUS:502,"ETHERNET/IP":44818,ETHERNETIP:44818,DNP3:20000,PROFINET:34962,HTTP:80,HTTPS:443,SSH:22,RDP:3389,SMB:445,FTP:21,SNMP:161,MQTT:1883 };
const portOf = (p="") => PROTO_PORT[p.toUpperCase().replace(/\s/g,"")] || PROTO_PORT[p.toUpperCase()] || null;

function AssetImage({ asset, size=160 }) {
  const cat = categoryOf(asset.type);
  const src = IMG_BY_CAT[cat];
  const [err, setErr] = useState(false);
  if (src && !err) {
    return <img src={src} alt={asset.type} onError={()=>setErr(true)}
      style={{ width:size, height:size, objectFit:"cover", borderRadius:12, border:`1px solid ${C.border}` }}/>;
  }
  return (
    <div style={{ width:size, height:size, borderRadius:12, border:`1px solid ${C.border}`, background:C.card, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.42 }}>
      {EMOJI_BY_CAT[cat] || "📦"}
    </div>
  );
}

export default function AssetInventory({ assets = [], connections = [] }) {
  const [liveById, setLiveById] = useState({});
  const [q, setQ]           = useState("");
  const [fLine, setFLine]   = useState("ALL");
  const [fType, setFType]   = useState("ALL");
  const [fCrit, setFCrit]   = useState("ALL");
  const [fProto, setFProto] = useState("ALL");
  const [fLevel, setFLevel] = useState("ALL");
  const [sortKey, setSortKey] = useState("id");
  const [sortDir, setSortDir] = useState(1);
  const [selected, setSelected] = useState(null);   // id → pantalla de detalle

  useEffect(() => {
    let t, cancel=false;
    const poll = async () => {
      try { const r = await fetch(`${API_URL}/api/plant`); const d = await r.json(); if(!cancel) setLiveById(d.assets || {}); } catch {}
      t = setTimeout(poll, 2500);
    };
    poll();
    return () => { cancel=true; clearTimeout(t); };
  }, []);

  const opts = useMemo(() => {
    const u = (f) => Array.from(new Set(assets.flatMap(f).filter(Boolean))).sort();
    return { lines:u(a=>[a.line]), types:u(a=>[a.type]), crits:u(a=>[a.criticality]), protos:u(a=>a.protocols||[]), levels:u(a=>[a.purdueLevel]) };
  }, [assets]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = assets.filter(a => {
      if (fLine!=="ALL" && a.line!==fLine) return false;
      if (fType!=="ALL" && a.type!==fType) return false;
      if (fCrit!=="ALL" && a.criticality!==fCrit) return false;
      if (fLevel!=="ALL" && String(a.purdueLevel)!==fLevel) return false;
      if (fProto!=="ALL" && !(a.protocols||[]).includes(fProto)) return false;
      if (term) { const hay=`${a.id} ${a.name} ${a.hostname} ${a.ip} ${a.type} ${a.vendor} ${a.model} ${(a.protocols||[]).join(" ")}`.toLowerCase(); if(!hay.includes(term)) return false; }
      return true;
    });
    const get = (a) => sortKey==="health" ? (liveById[a.id]?.health||"zzz") : sortKey==="purdueLevel" ? (parseFloat(a.purdueLevel)||0) : (a[sortKey]??"").toString().toLowerCase();
    list.sort((a,b)=>{ const x=get(a),y=get(b); return (x<y?-1:x>y?1:0)*sortDir; });
    return list;
  }, [assets,q,fLine,fType,fCrit,fProto,fLevel,sortKey,sortDir,liveById]);

  const stats = useMemo(() => {
    const byZone={IT:0,DMZ:0,OT:0}, byLevel={}, byCrit={}; const vendors=new Set(), protos=new Set(); let warn=0,crit=0;
    for (const a of assets) {
      byZone[zoneOfLevel(a.purdueLevel)]++;
      byLevel[a.purdueLevel]=(byLevel[a.purdueLevel]||0)+1;
      if (a.criticality) byCrit[a.criticality]=(byCrit[a.criticality]||0)+1;
      if (a.vendor) vendors.add(a.vendor);
      (a.protocols||[]).forEach(p=>protos.add(p));
      const h=liveById[a.id]?.health; if(h==="warning")warn++; if(h==="critical")crit++;
    }
    return { total:assets.length, byZone, byLevel, byCrit, vendors:vendors.size, protos:protos.size, warn, crit };
  }, [assets, liveById]);

  const sort = (k)=>{ if(sortKey===k) setSortDir(d=>-d); else { setSortKey(k); setSortDir(1); } };
  const clear = ()=>{ setQ(""); setFLine("ALL"); setFType("ALL"); setFCrit("ALL"); setFProto("ALL"); setFLevel("ALL"); };

  const exportCSV = useCallback(() => {
    const cols=["id","name","hostname","type","vendor","model","firmware","ip","mac","vlan","purdueLevel","zone","criticality","line","area","protocols","ports","description"];
    const esc=(v)=>`"${String(v??"").replace(/"/g,'""')}"`;
    const out=[cols.join(",")]; for (const a of rows) out.push(cols.map(c=>esc(Array.isArray(a[c])?a[c].join("; "):a[c])).join(","));
    const blob=new Blob([out.join("\n")],{type:"text/csv;charset=utf-8"}); const url=URL.createObjectURL(blob); const el=document.createElement("a");
    el.href=url; el.download="inventario_ot.csv"; document.body.appendChild(el); el.click(); document.body.removeChild(el); URL.revokeObjectURL(url);
  }, [rows]);

  if (!assets.length) return (
    <div style={{ padding:40, color:C.dim, fontFamily:C.mono, fontSize:13 }}>No hay inventario cargado. Importa el Excel para ver tus activos.</div>
  );

  /* ── Pantalla dedicada de detalle ── */
  const selAsset = selected && assets.find(a=>a.id===selected);
  if (selAsset) {
    const idx = rows.findIndex(a=>a.id===selected);
    const go = (d) => { const n=rows[idx+d]; if(n) setSelected(n.id); };
    return <AssetDetailScreen asset={selAsset} connections={connections}
      onBack={()=>setSelected(null)} onPeer={(id)=>assets.find(a=>a.id===id)&&setSelected(id)}
      onPrev={idx>0?()=>go(-1):null} onNext={idx<rows.length-1?()=>go(1):null}/>;
  }

  const COLS = [
    ["health","",40],["id","ID",90],["name","Nombre / Host",150],["type","Tipo",150],
    ["vendor","Fabricante",110],["model","Modelo",110],["ip","IP",110],["mac","MAC",120],
    ["vlan","VLAN",56],["purdueLevel","Purdue",60],["criticality","Criticidad",80],
    ["protocols","Protocolos",150],["ports","Puertos",110],["line","Línea",64],["firmware","Firmware",90],
  ];

  return (
    <div style={{ height:"calc(100vh - 130px)", background:C.bg, fontFamily:C.sans, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10, padding:"12px 16px", flexShrink:0 }}>
        {[
          ["ACTIVOS", stats.total, C.accent],["OT / DMZ / IT", `${stats.byZone.OT}/${stats.byZone.DMZ}/${stats.byZone.IT}`, C.green],
          ["FABRICANTES", stats.vendors, C.purple],["PROTOCOLOS", stats.protos, C.amber],
          ["EN ADVERTENCIA", stats.warn, stats.warn?C.amber:C.dim],["EN CRÍTICO", stats.crit, stats.crit?C.red:C.dim],
        ].map(([l,v,col]) => (
          <div key={l} style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px" }}>
            <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".06em" }}>{l}</div>
            <div style={{ color:col, fontSize:20, fontWeight:800, fontFamily:C.mono }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, padding:"0 16px 12px", flexShrink:0 }}>
        <MiniBar title="Por nivel Purdue" data={stats.byLevel} color={C.accent}/>
        <MiniBar title="Por criticidad" data={stats.byCrit} colorFn={CRIT_COL}/>
        <MiniBar title="Por tipo (top)" data={topN(assets,"type",6)} color={C.purple}/>
      </div>

      <div style={{ display:"flex", gap:8, alignItems:"center", padding:"8px 16px", borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, flexShrink:0, flexWrap:"wrap" }}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 buscar ID, nombre, IP, tipo, fabricante…"
          style={{ background:C.panel, border:`1px solid ${C.border}`, color:C.text, padding:"6px 12px", borderRadius:6, fontSize:11, fontFamily:C.mono, flex:1, minWidth:220, outline:"none" }}/>
        {[["Línea",fLine,setFLine,opts.lines],["Tipo",fType,setFType,opts.types],["Nivel",fLevel,setFLevel,opts.levels],["Criticidad",fCrit,setFCrit,opts.crits],["Protocolo",fProto,setFProto,opts.protos]].map(([lbl,val,set,list]) => (
          <select key={lbl} value={val} onChange={e=>set(e.target.value)} title={lbl}
            style={{ background:C.panel, border:`1px solid ${C.border}`, color:val==="ALL"?C.dim:C.text, padding:"5px 8px", borderRadius:5, fontSize:10, fontFamily:C.mono, maxWidth:130 }}>
            <option value="ALL">{lbl}: todos</option>
            {list.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <button onClick={clear} style={btn(C.dim)}>Limpiar</button>
        <button onClick={exportCSV} style={btn(C.green)}>⬇ CSV</button>
        <span style={{ color:C.dim, fontSize:10, fontFamily:C.mono }}>{rows.length} / {assets.length}</span>
      </div>

      <div style={{ flex:1, overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10.5, fontFamily:C.mono }}>
          <thead style={{ position:"sticky", top:0, zIndex:1 }}>
            <tr style={{ background:"#0a1018" }}>
              {COLS.map(([k,l,w]) => (
                <th key={k} onClick={()=>l&&sort(k)} style={{ textAlign:"left", padding:"8px 10px", color:C.dim, fontSize:9, fontWeight:600, borderBottom:`1px solid ${C.border}`, cursor:l?"pointer":"default", minWidth:w, whiteSpace:"nowrap" }}>
                  {l}{sortKey===k?(sortDir>0?" ▲":" ▼"):""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a,i) => {
              const h=liveById[a.id]?.health; const hc=HEALTH_COL[h]||C.dim;
              return (
                <tr key={a.id} onClick={()=>setSelected(a.id)}
                  style={{ background:i%2?"#0a0f17":"transparent", borderBottom:`1px solid ${C.border}22`, cursor:"pointer" }}>
                  <td style={{ padding:"5px 10px" }}><span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:hc, boxShadow:h?`0 0 5px ${hc}`:"none" }}/></td>
                  <td style={{ padding:"5px 10px", color:C.accent, fontWeight:700 }}>{a.id}</td>
                  <td style={{ padding:"5px 10px", color:C.text }}>{a.name||a.hostname||"—"}</td>
                  <td style={{ padding:"5px 10px", color:C.text }}>{a.type}</td>
                  <td style={{ padding:"5px 10px", color:C.dim }}>{a.vendor||"—"}</td>
                  <td style={{ padding:"5px 10px", color:C.dim }}>{a.model||"—"}</td>
                  <td style={{ padding:"5px 10px", color:C.green }}>{a.ip||"—"}</td>
                  <td style={{ padding:"5px 10px", color:C.dim }}>{a.mac||"—"}</td>
                  <td style={{ padding:"5px 10px", color:C.purple }}>{a.vlan||"—"}</td>
                  <td style={{ padding:"5px 10px", color:C.dim }}>{a.purdueLevel}</td>
                  <td style={{ padding:"5px 10px", color:CRIT_COL(a.criticality), fontWeight:700 }}>{a.criticality||"—"}</td>
                  <td style={{ padding:"5px 10px", color:C.amber, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:150 }}>{(a.protocols||[]).join(", ")||"—"}</td>
                  <td style={{ padding:"5px 10px", color:C.dim }}>{(a.ports||[]).join(", ")||"—"}</td>
                  <td style={{ padding:"5px 10px", color:C.dim }}>{a.line}</td>
                  <td style={{ padding:"5px 10px", color:C.dim }}>{a.firmware||"—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length===0 && <div style={{ padding:30, color:C.dim, fontFamily:C.mono, fontSize:12 }}>Ningún activo coincide con los filtros.</div>}
      </div>
    </div>
  );
}

/* ══════════════ PANTALLA DEDICADA DE DETALLE ══════════════ */
function AssetDetailScreen({ asset, connections, onBack, onPeer, onPrev, onNext }) {
  const [live, setLive] = useState(null);
  useEffect(() => {
    let t, cancel=false;
    const poll = async () => {
      try { const r=await fetch(`${API_URL}/api/equipment/${encodeURIComponent(asset.id)}`); if(r.ok){ const d=await r.json(); if(!cancel) setLive(d);} } catch {}
      t=setTimeout(poll, 1500);
    };
    poll(); return ()=>{ cancel=true; clearTimeout(t); };
  }, [asset.id]);

  const conns = connections.filter(c=>c.sourceId===asset.id||c.targetId===asset.id);
  const zone = zoneOfLevel(asset.purdueLevel);
  const hc = HEALTH_COL[live?.health] || C.dim;
  const ports = (asset.protocols||[]).map(p=>({ p, port:portOf(p) }));

  const Badge = ({ text, color }) => (
    <span style={{ color, border:`1px solid ${color}55`, background:`${color}14`, borderRadius:5, padding:"3px 10px", fontSize:10, fontFamily:C.mono, fontWeight:700 }}>{text}</span>
  );
  const Section = ({ title, children }) => (
    <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 16px" }}>
      <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".1em", marginBottom:10 }}>{title}</div>
      {children}
    </div>
  );
  const Row = ({ l, v, col }) => (v==null||String(v).trim()==="") ? null : (
    <div style={{ display:"flex", gap:10, padding:"4px 0", borderBottom:`1px solid ${C.border}22` }}>
      <span style={{ color:C.dim, fontSize:10, fontFamily:C.mono, minWidth:120, flexShrink:0 }}>{l}</span>
      <span style={{ color:col||C.text, fontSize:10.5, fontFamily:C.mono, wordBreak:"break-word" }}>{String(v)}</span>
    </div>
  );

  return (
    <div style={{ height:"calc(100vh - 130px)", background:C.bg, fontFamily:C.sans, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* barra superior */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 18px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <button onClick={onBack} style={btn(C.accent)}>← Inventario</button>
        <span style={{ color:C.dim, fontSize:10, fontFamily:C.mono }}>Inventario / {asset.id}</span>
        <div style={{ flex:1 }}/>
        <button onClick={onPrev} disabled={!onPrev} style={{ ...btn(C.dim), opacity:onPrev?1:.4 }}>↑ Anterior</button>
        <button onClick={onNext} disabled={!onNext} style={{ ...btn(C.dim), opacity:onNext?1:.4 }}>↓ Siguiente</button>
      </div>

      <div style={{ flex:1, overflow:"auto", padding:18 }}>
        {/* HERO */}
        <div style={{ display:"flex", gap:20, background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:18, marginBottom:16, alignItems:"center" }}>
          <AssetImage asset={asset} size={150}/>
          <div style={{ flex:1 }}>
            <div style={{ color:hc, fontSize:22, fontWeight:800, fontFamily:C.mono }}>{asset.name || asset.id}</div>
            <div style={{ color:C.dim, fontSize:12, fontFamily:C.mono, marginBottom:10 }}>{asset.type}{asset.vendor?` · ${asset.vendor}`:""}{asset.model?` ${asset.model}`:""}</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <Badge text={asset.id} color={C.accent}/>
              {asset.ip && <Badge text={asset.ip} color={C.green}/>}
              <Badge text={`Purdue ${asset.purdueLevel}`} color={C.purple}/>
              <Badge text={`Zona ${zone}`} color={zone==="OT"?C.green:zone==="DMZ"?C.amber:"#3b82f6"}/>
              {(asset.criticality||live?.criticality) && <Badge text={asset.criticality||live?.criticality} color={CRIT_COL(asset.criticality||live?.criticality)}/>}
              {live?.health && <Badge text={`salud: ${live.health}`} color={hc}/>}
            </div>
          </div>
        </div>

        {/* SECCIONES */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Section title="IDENTIDAD">
            <Row l="ID" v={asset.id}/><Row l="Nombre" v={asset.name}/><Row l="Hostname" v={asset.hostname}/>
            <Row l="Tipo" v={asset.type}/><Row l="Categoría (sim.)" v={live?.category}/>
            <Row l="Fabricante" v={asset.vendor}/><Row l="Modelo" v={asset.model}/><Row l="Firmware / SO" v={asset.firmware}/>
            <Row l="Aplicación" v={asset.application}/>
          </Section>

          <Section title="RED">
            <Row l="IP" v={asset.ip} col={C.green}/><Row l="MAC" v={asset.mac}/><Row l="VLAN" v={asset.vlan} col={C.purple}/>
            <Row l="Hostname" v={asset.hostname}/><Row l="Nivel Purdue" v={asset.purdueLevel}/>
            <Row l="Zona (segmentación)" v={zone}/><Row l="Zona seguridad (Excel)" v={asset.zone}/>
            <Row l="Línea" v={asset.line}/><Row l="Área" v={asset.area}/>
          </Section>

          <Section title="SEGURIDAD / EXPOSICIÓN">
            <Row l="Criticidad" v={asset.criticality||live?.criticality} col={CRIT_COL(asset.criticality||live?.criticality)}/>
            <Row l="Salud" v={live?.health} col={hc}/><Row l="Estado" v={live?.status||asset.status}/>
            <Row l="Zona" v={zone}/>
            <Row l="Exposición" v={zone==="IT"?"Alta (red corporativa)":zone==="DMZ"?"Media (DMZ)":"Protegida (OT)"} col={zone==="IT"?C.red:zone==="DMZ"?C.amber:C.green}/>
            <Row l="Protocolos" v={(asset.protocols||[]).join(", ")} col={C.amber}/>
          </Section>

          <Section title="PUERTOS Y SERVICIOS">
            {ports.length===0 ? <span style={{ color:C.dim, fontSize:10, fontFamily:C.mono }}>Sin protocolos OT declarados.</span> :
              ports.map(({p,port},i) => (
                <div key={i} style={{ display:"flex", gap:10, padding:"4px 0", borderBottom:`1px solid ${C.border}22`, fontFamily:C.mono, fontSize:10.5 }}>
                  <span style={{ color:C.green, minWidth:70 }}>{port?`${port}/tcp`:"—"}</span>
                  <span style={{ color:C.amber, minWidth:90 }}>{p}</span>
                  <span style={{ color:C.dim }}>abierto</span>
                </div>
              ))}
            {(asset.ports||[]).length>0 && <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, marginTop:6 }}>Puertos declarados: {(asset.ports||[]).join(", ")}</div>}
          </Section>

          {live?.state && Object.keys(live.state).length>0 && (
            <Section title="PROCESO / ESTADO EN VIVO">
              {Object.entries(live.state).map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontFamily:C.mono, fontSize:10.5 }}>
                  <span style={{ color:C.dim }}>{k}</span>
                  <span style={{ color:C.accent }}>{typeof v==="number"?(Number.isInteger(v)?v:v.toFixed(2)):String(v)}</span>
                </div>
              ))}
            </Section>
          )}

          <Section title={`COMUNICACIONES (${conns.length})`}>
            {conns.length===0 ? <span style={{ color:C.dim, fontSize:10, fontFamily:C.mono }}>Sin conexiones registradas.</span> :
              conns.slice(0,40).map((c,i) => {
                const other = c.sourceId===asset.id ? c.targetId : c.sourceId;
                return (
                  <div key={i} onClick={()=>onPeer(other)} style={{ display:"flex", gap:10, padding:"4px 0", borderBottom:`1px solid ${C.border}22`, fontFamily:C.mono, fontSize:10, cursor:"pointer" }}>
                    <span style={{ color:C.dim, minWidth:16 }}>{c.sourceId===asset.id?"→":"←"}</span>
                    <span style={{ color:C.accent, flex:1 }}>{other}</span>
                    <span style={{ color:C.amber }}>{c.protocol||""}</span>
                    <span style={{ color:C.dim }}>{c.port?`:${c.port}`:""}</span>
                  </div>
                );
              })}
          </Section>

          {asset.description && (
            <Section title="DESCRIPCIÓN">
              <div style={{ color:C.text, fontSize:10.5, fontFamily:C.mono, lineHeight:1.6 }}>{asset.description}</div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniBar({ title, data, color, colorFn }) {
  const entries = Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const max = Math.max(1, ...entries.map(e=>e[1]));
  return (
    <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px" }}>
      <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".06em", marginBottom:6 }}>{title.toUpperCase()}</div>
      {entries.map(([k,v]) => (
        <div key={k} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
          <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono, width:90, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }} title={k}>{k}</span>
          <div style={{ flex:1, height:8, background:"#0a0f17", borderRadius:3, overflow:"hidden" }}>
            <div style={{ width:`${(v/max)*100}%`, height:"100%", background:colorFn?colorFn(k):color, borderRadius:3 }}/>
          </div>
          <span style={{ color:C.text, fontSize:9, fontFamily:C.mono, width:28, textAlign:"right" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function topN(assets, key, n) {
  const m={}; for (const a of assets){ const v=a[key]; if(v) m[v]=(m[v]||0)+1; }
  return Object.fromEntries(Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,n));
}
const btn = (color) => ({ background:`${color}18`, border:`1px solid ${color}`, color, padding:"5px 12px", borderRadius:5, cursor:"pointer", fontFamily:"'Consolas','Courier New',monospace", fontSize:10, fontWeight:700 });