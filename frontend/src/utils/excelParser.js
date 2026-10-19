/**
 * excelParser.js
 * Convierte CUALQUIER Excel de inventario OT al formato interno del Lab.
 * Robusto ante: nombres de columnas en español/inglés, hojas con cualquier
 * nombre, conexiones en una hoja de comunicaciones Y/O en una columna
 * "Conectado_a", y referencias mezcladas por Asset_ID o por Hostname.
 *
 *   XLSX.utils.sheet_to_json(ws,{defval:null,raw:false}) → parseExcel(rawSheets) → LabData
 */

/* ── Diccionario de columnas (interno → posibles nombres) ── */
const ASSET_COLS = {
  id:          ["asset_id","id","device_id","equipo_id","activo_id","identifier","tag","ot_id"],
  name:        ["hostname","name","nombre","device_name","asset_name","host","label","equipo"],
  type:        ["tipo_activo","asset_type","device_type","type","tipo","categoria","category","clase"],
  vendor:      ["fabricante","vendor","manufacturer","marca","make","brand"],
  model:       ["modelo","model","model_number","part_number","referencia"],
  ip:          ["ip","ip_address","ip_addr","direccion_ip","address","ipv4"],
  mac:         ["mac","mac_address","hardware_address","physical_address"],
  vlan:        ["vlan","vlan_id","vlan_number","segmento"],
  line:        ["linea_id","line_id","linea","line","production_line","linea_area","area_linea"],
  area:        ["linea_area","area","subarea","zona_area","sector"],
  status:      ["estado","status","state","condicion","condition"],
  purdueLevel: ["nivel_purdue","purdue_level","purdue","nivel","isa_level","level","capa"],
  firmware:    ["firmware_so","firmware","os","sistema_operativo","version_sw","software_os"],
  application: ["aplicacion","application","software","app"],
  protocols:   ["protocolos","protocols","protocol","protocolo","comm_protocols"],
  ports:       ["puertos","ports","port","puerto","port_number"],
  zone:        ["zona_seguridad","security_zone","zona","zone","purdue_zone"],
  criticality: ["criticidad","criticality","criticalidad","importancia","severity"],
  hostname:    ["hostname","host","nombre_host"],
  connectedTo: ["conectado_a","connected_to","uplink","conexiones","conecta_con","parent","connected"],
  description: ["descripcion","description","notes","notas","comentario","comment","detalle"],
};

const CONN_COLS = {
  sourceId:  ["origen","source","source_id","from","desde","src","equipo_origen","origen_id","asset_origen","a_origen"],
  targetId:  ["destino","destination","target","target_id","to","hasta","dest","dst","equipo_destino","destino_id","asset_destino"],
  protocol:  ["protocolo","protocol","comm_protocol","servicio","service","aplicacion"],
  port:      ["puerto","port","puertos","ports","port_number"],
  direction: ["direccion","direction","flow","flujo","sentido"],
  allowed:   ["permitido_fw","permitido","allowed","enabled","active","permit"],
  vlan:      ["vlan","vlan_id"],
  usage:     ["uso","usage","descripcion","nota"],
};

const LINE_COLS = {
  id:          ["linea_id","line_id","id","linea","line"],
  name:        ["linea_area","line_name","nombre","name","descripcion","area"],
  description: ["descripcion","description","details","detalle","etapas_estaciones"],
  vlan:        ["vlan_ot","vlan","vlan_id"],
  order:       ["order","orden","sequence","sort"],
};

const FW_COLS = {
  id:          ["regla","rule","id","nombre","name"],
  source:      ["origen","source","from","src"],
  destination: ["destino","destination","target","to","dst"],
  service:     ["servicio","service","aplicacion","application","protocolo"],
  ports:       ["puertos","ports","puerto","port"],
  action:      ["accion","action","permitir","allow_deny"],
  log:         ["log","logging","registro"],
  priority:    ["prioridad","priority","orden","order"],
  note:        ["justificacion","justification","nota","note","descripcion"],
};

const VAR_COLS = {
  assetId:      ["asset_id","asset","equipo","device","activo"],
  variable:     ["variable","tag","name","nombre"],
  type:         ["type","tipo","data_type","datatype"],
  initialValue: ["initial_value","valor_inicial","default","value","valor"],
  min:          ["min","minimo","min_value","minimum"],
  max:          ["max","maximo","max_value","maximum"],
  unit:         ["unit","unidad","units","measure"],
  description:  ["description","descripcion","notes"],
};

/* ── Utilidades ── */
function norm(s = "") {
  return String(s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function findCol(cols, candidates) {
  for (const cand of candidates) {
    const exact = cols.find(c => c.toLowerCase() === cand.toLowerCase());
    if (exact) return exact;
  }
  for (const cand of candidates) {
    const normed = cols.find(c => norm(c) === norm(cand));
    if (normed) return normed;
  }
  // parcial: preferimos que la COLUMNA contenga al candidato (más preciso)
  for (const cand of candidates) {
    const p = cols.find(c => norm(c).includes(norm(cand)));
    if (p) return p;
  }
  for (const cand of candidates) {
    const p = cols.find(c => norm(cand).includes(norm(c)) && norm(c).length >= 3);
    if (p) return p;
  }
  return null;
}

function hasAny(cols, candidates) { return !!findCol(cols, candidates); }

/* ── Clasificación de hojas ── */
function detectBySheetName(name = "") {
  const n = norm(name);
  if (/(firewall|regla|rule|politic|policy|acl)/.test(n)) return "firewall";
  if (/(comunicacion|flujo|flow|trafico|relacion|conexion|conn|link|enlace|topolog)/.test(n)) return "connections";
  if (/(inventario|activo|asset|device|equipo|host)/.test(n)) return "assets";
  if (/(linea|line|produccion|production)/.test(n)) return "lines";
  if (/(^var|variable|tag|setpoint)/.test(n)) return "variables";
  if (/(arquitectura|architecture|purdue|readme|info|nota|leyenda|diccionario|instruc)/.test(n)) return "ignore";
  return null;
}

function detectByContent(rows) {
  if (!rows?.length) return "unknown";
  const cols = Object.keys(rows[0] || {});
  const hasSrc = hasAny(cols, CONN_COLS.sourceId);
  const hasDst = hasAny(cols, CONN_COLS.targetId);
  const hasId  = hasAny(cols, ASSET_COLS.id);
  const hasType= hasAny(cols, ASSET_COLS.type);
  const hasIp  = hasAny(cols, ASSET_COLS.ip);
  const hasAction = hasAny(cols, FW_COLS.action);

  // Firewall: origen+destino+acción (allow/deny)
  if (hasSrc && hasDst && hasAction) return "firewall";
  // Conexiones: par origen/destino presentes
  if (hasSrc && hasDst) return "connections";
  // Variables
  if (hasAny(cols, VAR_COLS.assetId) && hasAny(cols, VAR_COLS.variable)) return "variables";
  // Activos: id + (tipo o ip)
  if (hasId && (hasType || hasIp)) return "assets";
  return "unknown";
}

function extractRow(row, colDef) {
  const rawCols = Object.keys(row);
  const out = {};
  for (const [key, cands] of Object.entries(colDef)) {
    const found = findCol(rawCols, cands);
    out[key] = found ? (row[found] ?? null) : null;
  }
  return out;
}

/* ── Limpieza de valores ── */
function splitList(raw) {
  if (!raw) return [];
  return String(raw).split(/[;,|/]/).map(s => s.trim()).filter(Boolean);
}
function cleanProto(raw) {
  if (!raw) return "";
  // "S7comm / EtherNet-IP (según PLC)" -> "S7comm"
  return String(raw).split("(")[0].split(/[;,/]/)[0].trim();
}
function firstPort(raw) {
  if (!raw) return "";
  const m = String(raw).match(/\d{2,5}/);
  return m ? m[0] : "";
}
function parsePurdue(raw) {
  if (raw == null) return "1";
  const s = String(raw).trim();
  const m = s.match(/\d(\.\d)?/);
  return m ? m[0] : "1";
}
function parseDirection(raw = "") {
  const r = norm(raw);
  if (r.includes("bi") || r.includes("ambos")) return "bidirectional";
  if (r.includes("salida") || r.includes("out")) return "outbound";
  if (r.includes("entrada") || r.includes("in")) return "inbound";
  return "bidirectional";
}

/* ── Normalizadores ── */
function normalizeAsset(raw) {
  const r = extractRow(raw, ASSET_COLS);
  const id = String(r.id ?? "").trim();
  return {
    id,
    name:        String(r.name ?? r.hostname ?? id ?? "").trim(),
    hostname:    String(r.hostname ?? r.name ?? "").trim(),
    type:        String(r.type ?? "Unknown").trim(),
    vendor:      String(r.vendor ?? "").trim(),
    model:       String(r.model ?? "").trim(),
    ip:          String(r.ip ?? "").trim(),
    mac:         String(r.mac ?? "").trim(),
    vlan:        String(r.vlan ?? "").trim(),
    line:        String(r.line ?? "SHARED").trim() || "SHARED",
    area:        String(r.area ?? "").trim(),
    status:      String(r.status ?? "ONLINE").toUpperCase(),
    purdueLevel: parsePurdue(r.purdueLevel),
    firmware:    String(r.firmware ?? "").trim(),
    application: String(r.application ?? "").trim(),
    protocols:   splitList(r.protocols),
    ports:       splitList(r.ports),
    zone:        String(r.zone ?? "").trim(),
    criticality: String(r.criticality ?? "").trim(),
    connectedTo: splitList(r.connectedTo),
    description: String(r.description ?? "").trim(),
  };
}

/* ── FUNCIÓN PRINCIPAL ── */
export function parseExcel(rawSheets) {
  const classified = {};
  for (const [sheetName, rows] of Object.entries(rawSheets)) {
    if (!rows?.length) continue;
    const t = detectBySheetName(sheetName) ?? detectByContent(rows);
    if (t === "ignore" || t === "unknown") continue;
    // una sola hoja por tipo (la primera que matchee)
    if (!classified[t]) classified[t] = { sheetName, rows };
  }

  const result = {
    assets: [], connections: [], lines: [], variables: [],
    vlans: [], protocols: [], firewallRules: [],
    meta: {
      sheetNames: Object.keys(rawSheets),
      classified: Object.entries(classified).map(([type, { sheetName }]) => ({ type, sheetName })),
      importedAt: new Date().toISOString(),
      warnings: [],
    },
  };

  const nonEmpty = rows => rows.filter(r => r && Object.values(r).some(v => v != null));

  /* ASSETS */
  if (classified.assets) {
    result.assets = nonEmpty(classified.assets.rows)
      .map(normalizeAsset)
      .filter(a => a.id && a.id !== "?");
  }

  /* Índice de referencias: por id, por hostname, por name → id canónico */
  const refIndex = {};
  for (const a of result.assets) {
    for (const key of [a.id, a.hostname, a.name]) {
      const k = norm(key);
      if (k && !(k in refIndex)) refIndex[k] = a.id;
    }
  }
  const resolve = (ref) => {
    const k = norm(ref);
    return refIndex[k] || String(ref).trim();  // si no resuelve, deja el texto
  };

  /* CONNECTIONS — hoja de comunicaciones */
  const connKey = new Set();
  const pushConn = (c) => {
    if (!c.sourceId || !c.targetId || c.sourceId === c.targetId) return;
    const key = [c.sourceId, c.targetId].sort().join("|") + "|" + (c.protocol || "");
    if (connKey.has(key)) return;
    connKey.add(key);
    result.connections.push(c);
  };

  if (classified.connections) {
    for (const row of nonEmpty(classified.connections.rows)) {
      const r = extractRow(row, CONN_COLS);
      if (!r.sourceId || !r.targetId) continue;
      pushConn({
        sourceId:  resolve(r.sourceId),
        targetId:  resolve(r.targetId),
        protocol:  cleanProto(r.protocol),
        port:      firstPort(r.port),
        direction: parseDirection(r.direction),
        allowed:   r.allowed == null || !/^(no|deny|false|0)/i.test(String(r.allowed)),
        source:    "comunicaciones",
      });
    }
  }

  /* CONNECTIONS — columna Conectado_a del inventario */
  for (const a of result.assets) {
    for (const ref of a.connectedTo) {
      pushConn({
        sourceId:  a.id,
        targetId:  resolve(ref),
        protocol:  a.protocols[0] ? cleanProto(a.protocols[0]) : "",
        port:      a.ports[0] ? firstPort(a.ports[0]) : "",
        direction: "bidirectional",
        allowed:   true,
        source:    "conectado_a",
      });
    }
  }

  /* LINES */
  if (classified.lines) {
    result.lines = nonEmpty(classified.lines.rows).map((row, i) => {
      const r = extractRow(row, LINE_COLS);
      return {
        id:          String(r.id ?? "").trim(),
        name:        String(r.name ?? r.id ?? "").trim(),
        description: String(r.description ?? "").trim(),
        vlan:        String(r.vlan ?? "").trim(),
        order:       parseInt(r.order) || (i + 1),
      };
    }).filter(l => l.id).sort((a, b) => a.order - b.order);
  }
  if (!result.lines.length && result.assets.length) {
    const seen = {};
    for (const a of result.assets) {
      if (!seen[a.line]) seen[a.line] = { id: a.line, name: a.line, description: "", vlan: "", order: Object.keys(seen).length + 1 };
    }
    result.lines = Object.values(seen).sort((a, b) => a.order - b.order);
  }

  /* VARIABLES */
  if (classified.variables) {
    result.variables = nonEmpty(classified.variables.rows).map(row => {
      const r = extractRow(row, VAR_COLS);
      return {
        assetId: resolve(r.assetId), variable: String(r.variable ?? "").trim(),
        type: String(r.type ?? "float"), initialValue: r.initialValue,
        min: r.min, max: r.max, unit: String(r.unit ?? "").trim(),
        description: String(r.description ?? "").trim(),
      };
    }).filter(v => v.assetId && v.variable);
  }

  /* FIREWALL RULES (para la interfaz del firewall / futuro) */
  if (classified.firewall) {
    result.firewallRules = nonEmpty(classified.firewall.rows).map(row => {
      const r = extractRow(row, FW_COLS);
      return {
        id: String(r.id ?? "").trim(),
        source: String(r.source ?? "").trim(),
        destination: String(r.destination ?? "").trim(),
        service: String(r.service ?? "").trim(),
        ports: splitList(r.ports),
        action: /deny|block|rech/i.test(String(r.action ?? "")) ? "deny" : "allow",
        log: !/^(no|false|0)/i.test(String(r.log ?? "si")),
        priority: parseInt(r.priority) || 100,
        note: String(r.note ?? "").trim(),
      };
    }).filter(r => r.id);
  }

  /* Avisos útiles */
  if (!result.assets.length) result.meta.warnings.push("No se detectó ninguna hoja de activos con columna de ID.");
  if (classified.connections && !result.connections.length) result.meta.warnings.push("Se detectó hoja de comunicaciones pero no se pudieron mapear origen/destino.");

  return result;
}

/* ── Resumen para la UI ── */
export function summarizeLabData(data) {
  const lineCount = data.lines.filter(l => l.id && l.id !== "SHARED").length;
  const assetsByLine = {};
  for (const a of data.assets) assetsByLine[a.line] = (assetsByLine[a.line] ?? 0) + 1;
  return {
    totalAssets: data.assets.length,
    totalConns:  data.connections.length,
    totalLines:  lineCount,
    totalVars:   data.variables.length,
    totalVlans:  (data.vlans || []).length,
    totalFwRules: (data.firewallRules || []).length,
    assetsByLine,
    typeBreakdown: Object.entries(
      data.assets.reduce((acc, a) => { acc[a.type] = (acc[a.type] ?? 0) + 1; return acc; }, {})
    ).sort((a, b) => b[1] - a[1]),
    classified: data.meta?.classified || [],
    warnings: data.meta?.warnings || [],
  };
}

/* ── Compatibilidad con la UI existente ── */
export function detectColumnMappings(rawSheets) {
  const result = {};
  for (const [name, rows] of Object.entries(rawSheets)) {
    if (!rows?.length) continue;
    const type = detectBySheetName(name) ?? detectByContent(rows);
    const cols = Object.keys(rows[0] ?? {});
    const map = (def) => Object.fromEntries(
      Object.entries(def).map(([k, c]) => [k, findCol(cols, c)]).filter(([, v]) => v)
    );
    if (type === "assets")      result.assets      = map(ASSET_COLS);
    if (type === "connections") result.connections = map(CONN_COLS);
    if (type === "lines")       result.lines       = map(LINE_COLS);
    if (type === "variables")   result.variables   = map(VAR_COLS);
    if (type === "firewall")    result.firewall    = map(FW_COLS);
  }
  return result;
}

export const COL_DEFINITIONS = { ASSET_COLS, CONN_COLS, LINE_COLS, VAR_COLS, FW_COLS };