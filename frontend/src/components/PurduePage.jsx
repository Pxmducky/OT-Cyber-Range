/**
 * PurduePage.jsx
 * Vista Purdue interactiva alineada al inventario importado.
 *   · Diseño: arrastrar activos entre niveles (cambia la segmentación real).
 *   · Arquitectura conectada: todos los equipos y sus conexiones en Purdue.
 *   · Clic en un activo → ficha con TODOS sus datos (incluye estado vivo).
 */

import { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from "react";

const API_URL = "http://127.0.0.1:8000";
const C = {
  bg:"#070b12", text:"#e2e8f0", dim:"#64748b", border:"#1e293b",
  mono:"'Consolas','Courier New',monospace", sans:"'Segoe UI',sans-serif",
};

const BANDS = [
  { key:"IT",  zone:"IT",  label:"Nivel 4/5 · Enterprise / IT",   color:"#3b82f6" },
  { key:"DMZ", zone:"DMZ", label:"Nivel 3.5 · DMZ Industrial",    color:"#f59e0b" },
  { key:"L3",  zone:"OT",  label:"Nivel 3 · Operaciones (SCADA)", color:"#22d3ee" },
  { key:"L2",  zone:"OT",  label:"Nivel 2 · Supervisión (HMI)",   color:"#818cf8" },
  { key:"L1",  zone:"OT",  label:"Nivel 1 · Control (PLC)",       color:"#22c55e" },
  { key:"L0",  zone:"OT",  label:"Nivel 0 · Proceso / Campo",     color:"#10b981" },
];
const BAND = Object.fromEntries(BANDS.map(b => [b.key, b]));
const zoneOfBand = (k) => BAND[k]?.zone || "OT";

function inferBand(a) {
  const pl = parseFloat(a.purdueLevel);
  if (!Number.isNaN(pl)) {
    if (pl >= 4) return "IT";
    if (pl === 3.5) return "DMZ";
    if (pl === 3) return "L3";
    if (pl === 2) return "L2";
    if (pl === 1) return "L1";
    return "L0";
  }
  const t = (a.type || "").toLowerCase();
  if (/scada/.test(t)) return "L3";
  if (/hmi|panel/.test(t)) return "L2";
  if (/plc|controller|controlador|rtu/.test(t)) return "L1";
  if (/firewall|switch|ewon|gateway|server|servidor|histor|mes|jump|dmz/.test(t)) return "DMZ";
  if (/workstation|ingenier|estacion|it/.test(t)) return "IT";
  return "L0";
}

export default function PurduePage({ assets = [], connections = [] }) {
  const [view, setView]           = useState("editor");   // editor | connected
  const [placement, setPlacement] = useState({});
  const [designed, setDesigned]   = useState({});
  const [selected, setSelected]   = useState(null);
  const [lineFilter, setLineFilter] = useState("ALL");
  const [zoom, setZoom]           = useState(1);
  const [coords, setCoords]       = useState({});
  const [live, setLive]           = useState(null);       // estado vivo del backend
  const [msg, setMsg]             = useState(null);
  const wrapRef   = useRef(null);
  const nodeRefs  = useRef(new Map());
  const applyTimer = useRef(null);

  const flash = useCallback((t) => { setMsg(t); setTimeout(()=>setMsg(null), 2500); }, []);

  useEffect(() => {
    const d = {}; for (const a of assets) d[a.id] = inferBand(a);
    setDesigned(d); setPlacement(d);
  }, [assets]);

  /* estado vivo del activo seleccionado */
  useEffect(() => {
    setLive(null);
    if (!selected) return;
    let cancel=false;
    fetch(`${API_URL}/api/equipment/${encodeURIComponent(selected)}`)
      .then(r => r.ok ? r.json() : null).then(d => { if(!cancel) setLive(d); }).catch(()=>{});
    return () => { cancel=true; };
  }, [selected]);

  const lines = useMemo(() => ["ALL", ...Array.from(new Set(assets.map(a=>a.line).filter(Boolean)))], [assets]);
  const visible = useMemo(() => assets.filter(a => lineFilter==="ALL" || a.line===lineFilter), [assets, lineFilter]);
  const visibleIds = useMemo(() => new Set(visible.map(a=>a.id)), [visible]);
  const byBand = useMemo(() => {
    const m = Object.fromEntries(BANDS.map(b=>[b.key,[]]));
    for (const a of visible) (m[placement[a.id]||"L0"] ||= []).push(a);
    return m;
  }, [visible, placement]);

  const applySegmentation = useCallback((plc) => {
    const placements = {};
    for (const [id, band] of Object.entries(plc)) placements[id] = zoneOfBand(band);
    clearTimeout(applyTimer.current);
    applyTimer.current = setTimeout(() => {
      fetch(`${API_URL}/api/segmentation`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ placements }) }).catch(()=>{});
    }, 300);
  }, []);

  const onDropBand = (bandKey) => (e) => {
    if (view !== "editor") return;
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain"); if (!id) return;
    setPlacement(prev => { const next = {...prev, [id]:bandKey}; applySegmentation(next); return next; });
  };
  const resetDesign = () => { setPlacement(designed); applySegmentation(designed); flash("Restaurado al diseño automático"); };

  /* conexiones a dibujar */
  const drawConns = useMemo(() => {
    if (view === "connected")
      return connections.filter(c => visibleIds.has(c.sourceId) && visibleIds.has(c.targetId));
    if (selected)
      return connections.filter(c => (c.sourceId===selected||c.targetId===selected) && visibleIds.has(c.sourceId) && visibleIds.has(c.targetId));
    if (lineFilter !== "ALL")
      return connections.filter(c => visibleIds.has(c.sourceId) && visibleIds.has(c.targetId));
    return [];
  }, [view, selected, lineFilter, connections, visibleIds]);

  /* medir coordenadas lógicas (compensando el zoom) */
  useLayoutEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    const box = wrap.getBoundingClientRect();
    const next = {};
    for (const a of visible) {
      const el = nodeRefs.current.get(a.id);
      if (el) { const r = el.getBoundingClientRect();
        next[a.id] = { x: ((r.left - box.left) + r.width/2)/zoom, y: ((r.top - box.top) + r.height/2)/zoom }; }
    }
    setCoords(next);
  }, [visible, placement, lineFilter, selected, view, zoom]);

  const analysis = useMemo(() => {
    const zoneOf = (id) => zoneOfBand(placement[id] || designed[id] || "L0");
    let itOt = 0;
    for (const c of connections) {
      if (!placement[c.sourceId] && !designed[c.sourceId]) continue;
      if ([zoneOf(c.sourceId), zoneOf(c.targetId)].sort().join("-") === "IT-OT") itOt++;
    }
    const moved = Object.keys(placement).filter(id => designed[id] && placement[id]!==designed[id]).length;
    const otInIt = assets.filter(a => zoneOfBand(placement[a.id])==="IT" && zoneOfBand(designed[a.id])==="OT").length;
    return { itOt, moved, otInIt, score: Math.max(0, 100 - itOt*8 - otInIt*10) };
  }, [placement, designed, connections, assets]);

  const selAsset = assets.find(a => a.id === selected);
  const selConns = selected ? connections.filter(c => c.sourceId===selected||c.targetId===selected) : [];

  if (!assets.length) return (
    <div style={{ padding:40, color:C.dim, fontFamily:C.mono, fontSize:13 }}>
      No hay inventario cargado. Importa el Excel para autodiseñar el modelo Purdue.
    </div>
  );

  return (
    <div style={{ display:"flex", height:"calc(100vh - 130px)", background:C.bg, fontFamily:C.sans }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* barra */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px", borderBottom:`1px solid ${C.border}`, flexShrink:0, flexWrap:"wrap" }}>
          {[["editor","Diseño (arrastrar)"],["connected","Arquitectura conectada"]].map(([v,l]) => (
            <button key={v} onClick={()=>setView(v)} style={{ background: view===v?"#0d1520":"transparent", border:`1px solid ${view===v?"#22d3ee":C.border}`, color: view===v?"#22d3ee":C.dim, padding:"5px 12px", borderRadius:5, cursor:"pointer", fontFamily:C.mono, fontSize:10, fontWeight:700 }}>{l}</button>
          ))}
          <span style={{ color:C.dim, fontSize:10, fontFamily:C.mono, marginLeft:6 }}>{visible.length} activos</span>
          <div style={{ flex:1 }}/>
          {view==="connected" && (
            <>
              <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>zoom</span>
              <input type="range" min={0.5} max={1.4} step={0.1} value={zoom} onChange={e=>setZoom(Number(e.target.value))} style={{ width:90, accentColor:"#22d3ee" }}/>
            </>
          )}
          <span style={{ color:C.dim, fontSize:10, fontFamily:C.mono }}>Línea:</span>
          <select value={lineFilter} onChange={e=>{ setLineFilter(e.target.value); }}
            style={{ background:"#0d1520", border:`1px solid ${C.border}`, color:C.text, padding:"4px 8px", borderRadius:4, fontSize:10, fontFamily:C.mono }}>
            {lines.map(l => <option key={l} value={l}>{l==="ALL"?"Todas":l}</option>)}
          </select>
          {view==="editor" && <button onClick={resetDesign} style={btn("#22d3ee")}>⟲ Diseño automático</button>}
          {msg && <span style={{ color:"#22c55e", fontSize:10, fontFamily:C.mono }}>{msg}</span>}
        </div>

        {/* canvas */}
        <div style={{ flex:1, overflow:"auto", padding:"8px 12px" }}>
          <div ref={wrapRef} style={{ position:"relative", transform:`scale(${zoom})`, transformOrigin:"0 0", width: zoom!==1 ? `${100/zoom}%` : "auto" }}>
            <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:1, overflow:"visible" }}>
              {drawConns.map((c,i) => {
                const a = coords[c.sourceId], b = coords[c.targetId]; if (!a||!b) return null;
                const zs = zoneOfBand(placement[c.sourceId]||designed[c.sourceId]);
                const zd = zoneOfBand(placement[c.targetId]||designed[c.targetId]);
                const risky = [zs,zd].sort().join("-")==="IT-OT";
                const hot = selected && (c.sourceId===selected||c.targetId===selected);
                return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={risky?"#ef4444":hot?"#22d3ee":"#334155"} strokeWidth={risky?2:hot?1.8:1}
                  strokeDasharray={risky?"4 3":"none"} opacity={risky||hot?0.95:0.45}/>;
              })}
            </svg>

            <div style={{ position:"relative", zIndex:2, display:"flex", flexDirection:"column", gap:8 }}>
              {BANDS.map(band => (
                <div key={band.key} onDragOver={e=>view==="editor"&&e.preventDefault()} onDrop={onDropBand(band.key)}
                  style={{ border:`1px solid ${band.color}44`, borderLeft:`3px solid ${band.color}`, borderRadius:8, background:`${band.color}08`, minHeight:64 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 12px" }}>
                    <span style={{ color:band.color, fontFamily:C.mono, fontSize:11, fontWeight:700 }}>{band.label}</span>
                    <span style={{ color:C.dim, fontFamily:C.mono, fontSize:9, border:`1px solid ${C.border}`, borderRadius:4, padding:"1px 6px" }}>zona {band.zone}</span>
                    <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>{byBand[band.key].length}</span>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5, padding:"0 10px 10px" }}>
                    {byBand[band.key].map(a => {
                      const isSel = selected===a.id;
                      const isLinked = selected && selConns.some(c => c.sourceId===a.id||c.targetId===a.id);
                      const movedWrong = zoneOfBand(placement[a.id])!==zoneOfBand(designed[a.id]);
                      return (
                        <div key={a.id}
                          ref={el => { if (el) nodeRefs.current.set(a.id, el); else nodeRefs.current.delete(a.id); }}
                          draggable={view==="editor"}
                          onDragStart={e=>e.dataTransfer.setData("text/plain", a.id)}
                          onClick={()=>setSelected(isSel?null:a.id)}
                          title={`${a.id} · ${a.type}`}
                          style={{ display:"flex", flexDirection:"column", cursor: view==="editor"?"grab":"pointer",
                            background: isSel?`${band.color}30`:"#0d1520",
                            border:`1px solid ${isSel?band.color:isLinked?"#22d3ee":movedWrong?"#ef4444":C.border}`,
                            borderRadius:5, padding:"4px 8px", minWidth:84, maxWidth:120 }}>
                          <span style={{ color:C.text, fontFamily:C.mono, fontSize:9, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{a.name||a.id}</span>
                          <span style={{ color:C.dim, fontFamily:C.mono, fontSize:7.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{a.type}</span>
                        </div>
                      );
                    })}
                    {byBand[band.key].length===0 && <span style={{ color:C.dim, fontSize:9, fontFamily:C.mono, padding:"4px 0" }}>{view==="editor"?"(vacío — arrastra aquí)":"(vacío)"}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── PANEL LATERAL ── */}
      <div style={{ width:320, flexShrink:0, borderLeft:`1px solid ${C.border}`, overflow:"auto", padding:14 }}>
        {selAsset ? (
          <AssetDetail asset={selAsset} live={live} conns={selConns} selected={selected}
            band={placement[selAsset.id]} designed={designed[selAsset.id]}
            onClose={()=>setSelected(null)}/>
        ) : (
          <Analysis analysis={analysis}/>
        )}
      </div>
    </div>
  );
}

/* ── Ficha completa del activo ── */
function AssetDetail({ asset, live, conns, selected, band, designed, onClose }) {
  const fields = [
    ["ID", asset.id], ["Nombre", asset.name], ["Hostname", asset.hostname],
    ["Tipo", asset.type], ["Categoría (motor sim.)", live?.category],
    ["Fabricante", asset.vendor], ["Modelo", asset.model], ["Firmware", asset.firmware],
    ["IP", asset.ip], ["MAC", asset.mac], ["VLAN", asset.vlan],
    ["Línea", asset.line], ["Área", asset.area],
    ["Zona actual", zoneOfBand(band)], ["Nivel Purdue", asset.purdueLevel],
    ["Criticidad", asset.criticality || live?.criticality],
    ["Salud", live?.health], ["Estado", live?.status || asset.status],
    ["Protocolos", (asset.protocols||[]).join(", ")],
    ["Puertos", (asset.ports||[]).join(", ")],
    ["Aplicación", asset.application],
    ["Conectado a", (asset.connectedTo||[]).join(", ")],
    ["Zona seguridad (Excel)", asset.zone],
    ["Descripción", asset.description],
  ].filter(([,v]) => v != null && String(v).trim() !== "");

  const healthColor = { normal:"#22c55e", warning:"#f59e0b", critical:"#ef4444" }[live?.health] || C.text;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", marginBottom:4 }}>
        <span style={{ color:C.text, fontFamily:C.mono, fontSize:12, fontWeight:700 }}>FICHA DEL ACTIVO</span>
        <div style={{ flex:1 }}/>
        <button onClick={onClose} style={{ background:"none", border:`1px solid ${C.border}`, color:C.dim, padding:"2px 8px", borderRadius:4, cursor:"pointer", fontSize:9, fontFamily:C.mono }}>✕</button>
      </div>
      <div style={{ color:healthColor, fontFamily:C.mono, fontSize:13, fontWeight:700, marginBottom:2 }}>{asset.name || asset.id}</div>
      <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, marginBottom:10 }}>{asset.type}</div>

      {fields.map(([l,v]) => (
        <div key={l} style={{ display:"flex", gap:8, padding:"4px 0", borderBottom:`1px solid ${C.border}33` }}>
          <span style={{ color:C.dim, fontSize:9.5, fontFamily:C.mono, minWidth:118, flexShrink:0 }}>{l}</span>
          <span style={{ color: l==="Salud"?healthColor:C.text, fontSize:9.5, fontFamily:C.mono, wordBreak:"break-word" }}>{String(v)}</span>
        </div>
      ))}

      {/* estado vivo del proceso */}
      {live?.state && Object.keys(live.state).length > 0 && (
        <>
          <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".08em", margin:"12px 0 4px" }}>ESTADO EN VIVO</div>
          {Object.entries(live.state).map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", fontFamily:C.mono, fontSize:9.5 }}>
              <span style={{ color:C.dim }}>{k}</span>
              <span style={{ color:"#22d3ee" }}>{typeof v==="number" ? (Number.isInteger(v)?v:v.toFixed(2)) : String(v)}</span>
            </div>
          ))}
        </>
      )}

      {/* conexiones */}
      <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono, letterSpacing:".08em", margin:"12px 0 4px" }}>CONEXIONES ({conns.length})</div>
      {conns.slice(0,30).map((c,i) => {
        const other = c.sourceId===selected ? c.targetId : c.sourceId;
        return (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:9, fontFamily:C.mono, padding:"2px 0" }}>
            <span style={{ color:C.text }}>{c.sourceId===selected?"→":"←"} {other}</span>
            <span style={{ color:C.dim }}>{c.protocol||""}{c.port?`:${c.port}`:""}</span>
          </div>
        );
      })}
      {conns.length===0 && <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>Sin conexiones registradas.</div>}
    </div>
  );
}

/* ── Análisis de segmentación ── */
function Analysis({ analysis }) {
  return (
    <div>
      <div style={{ color:C.text, fontFamily:C.mono, fontSize:11, fontWeight:700, letterSpacing:".05em", marginBottom:10 }}>ANÁLISIS DE SEGMENTACIÓN</div>
      <div style={{ textAlign:"center", marginBottom:12 }}>
        <div style={{ fontSize:38, fontWeight:900, fontFamily:C.mono, color: analysis.score>=80?"#22c55e":analysis.score>=50?"#f59e0b":"#ef4444" }}>{analysis.score}</div>
        <div style={{ color:C.dim, fontSize:9, fontFamily:C.mono }}>SCORE DE SEGMENTACIÓN</div>
      </div>
      {[
        ["Conexiones directas IT↔OT", analysis.itOt, analysis.itOt>0?"#ef4444":"#22c55e"],
        ["Activos OT expuestos en IT", analysis.otInIt, analysis.otInIt>0?"#ef4444":"#22c55e"],
        ["Activos movidos del diseño", analysis.moved, "#f59e0b"],
      ].map(([l,v,col]) => (
        <div key={l} style={{ display:"flex", justifyContent:"space-between", background:"#0d1520", border:`1px solid ${C.border}`, borderRadius:5, padding:"7px 10px", marginBottom:6 }}>
          <span style={{ color:C.dim, fontSize:10, fontFamily:C.mono }}>{l}</span>
          <span style={{ color:col, fontSize:11, fontFamily:C.mono, fontWeight:700 }}>{v}</span>
        </div>
      ))}
      {analysis.itOt>0 && (
        <div style={{ background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.3)", borderRadius:6, padding:"8px 10px", marginTop:8 }}>
          <div style={{ color:"#ef4444", fontFamily:C.mono, fontSize:10, fontWeight:700, marginBottom:4 }}>⚠ MALA SEGMENTACIÓN</div>
          <div style={{ color:C.text, fontSize:9.5, fontFamily:C.mono, lineHeight:1.5 }}>
            Tráfico directo IT↔OT sin DMZ. El atacante puede escanear y manipular esos equipos. Coloca una DMZ entre IT y OT.
          </div>
        </div>
      )}
      <div style={{ color:C.dim, fontSize:9.5, fontFamily:C.mono, marginTop:16, lineHeight:1.5 }}>
        Haz clic en un activo para ver su ficha completa. En "Arquitectura conectada" se dibujan todos los enlaces. En "Diseño" arrastra entre niveles; los cambios afectan la segmentación real.
      </div>
    </div>
  );
}

const btn = (color) => ({ background:`${color}18`, border:`1px solid ${color}`, color, padding:"4px 10px", borderRadius:5, cursor:"pointer", fontFamily:"'Consolas','Courier New',monospace", fontSize:10, fontWeight:700 });