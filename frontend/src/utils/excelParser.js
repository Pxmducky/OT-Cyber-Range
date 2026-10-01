/**
 * excelParser.js
 * Convierte cualquier Excel de inventario OT al formato interno del Lab.
 * Maneja nombres de columnas variados, separadores distintos y hojas con nombres
 * en cualquier idioma.
 *
 * Flujo:
 *   XLSX.utils.sheet_to_json(ws)  →  parseExcel(rawSheets)  →  LabData
 *
 * LabData (formato interno):
 *   assets[]       — activos normalizados
 *   connections[]  — conexiones normalizadas
 *   lines[]        — metadatos de líneas de producción
 *   variables[]    — variables por activo (para interacción PLC)
 *   vlans[]        — VLANs / zonas de red
 *   protocols[]    — catálogo de protocolos
 */

/* ── Diccionario de mapeo de columnas ──────────────────────────────────────
   Cada clave interna tiene una lista de nombres posibles en el Excel.
   Se prueba: coincidencia exacta → parcial → sin tildes.
────────────────────────────────────────────────────────────────────────── */
const ASSET_COLS = {
    id:          ["id", "asset_id", "device_id", "equipo_id", "identifier", "tag"],
    name:        ["name", "nombre", "device_name", "asset_name", "descripcion_corta", "label"],
    type:        ["type", "tipo", "device_type", "asset_type", "category", "categoria"],
    vendor:      ["vendor", "fabricante", "manufacturer", "make", "brand", "marca"],
    model:       ["model", "modelo", "model_number", "part_number", "version"],
    ip:          ["ip", "ip_address", "ip_addr", "address", "direccion_ip", "network_address"],
    mac:         ["mac", "mac_address", "hardware_address", "physical_address", "mac_addr"],
    vlan:        ["vlan", "vlan_id", "vlan_number", "red", "network", "segmento"],
    line:        ["line", "linea", "line_id", "production_line", "area", "zone", "zona"],
    status:      ["status", "estado", "state", "condition", "condicion"],
    purdueLevel: ["purdue_level", "purdue", "level", "nivel", "isa_level", "layer", "capa"],
    firmware:    ["os_firmware", "firmware", "os", "version_sw", "software"],
    application: ["application", "aplicacion", "software", "app"],
    protocols:   ["protocols", "protocol", "protocolo", "protocolos", "comm_protocols", "communication"],
    ports:       ["ports", "port", "puerto", "puertos", "port_number"],
    description: ["description", "descripcion", "notes", "notas", "comment", "comentario", "remarks"],
  };
  
  const CONN_COLS = {
    sourceId:  ["source", "origen", "source_id", "from", "desde", "src", "equipo_origen"],
    targetId:  ["destination", "destino", "target", "target_id", "to", "hasta", "dest", "dst", "equipo_destino"],
    protocol:  ["protocol", "protocolo", "comm_protocol"],
    port:      ["port", "puerto", "port_number"],
    direction: ["direction", "direccion", "flow", "flujo", "sentido"],
    allowed:   ["allowed", "permitido", "enabled", "active"],
  };
  
  const LINE_COLS = {
    id:          ["line_id", "id", "linea_id", "identifier"],
    name:        ["name", "nombre", "line_name", "descripcion"],
    description: ["description", "descripcion", "details", "notas"],
    order:       ["order", "orden", "sequence", "sort"],
  };
  
  const VAR_COLS = {
    assetId:      ["asset", "asset_id", "equipo", "device"],
    variable:     ["variable", "tag", "name", "nombre"],
    type:         ["type", "tipo", "data_type", "datatype"],
    initialValue: ["initial_value", "valor_inicial", "default", "default_value", "value"],
    min:          ["min", "minimum", "minimo", "min_value"],
    max:          ["max", "maximum", "maximo", "max_value"],
    unit:         ["unit", "units", "unidad", "measure"],
    description:  ["description", "descripcion", "notes"],
  };
  
  const VLAN_COLS = {
    id:          ["vlan_id", "id", "vlan", "network_id"],
    name:        ["name", "nombre", "vlan_name"],
    zone:        ["zone", "zona", "area", "purdue_zone"],
    description: ["description", "descripcion"],
  };
  
  const PROTO_COLS = {
    protocol:    ["protocol", "protocolo", "name", "nombre"],
    transport:   ["transport", "transporte", "layer"],
    port:        ["port", "puerto", "default_port"],
    description: ["description", "descripcion"],
  };
  
  /* ── Detección de tipo de hoja ─────────────────────────────────────────── */
  const SHEET_DETECT = {
    assets:      { required: ["id", "ip", "type"], weight: 10 },
    connections: { required: ["source", "dest"],   weight: 10 },
    lines:       { required: ["line_id", "name"],  weight: 8  },
    variables:   { required: ["asset", "variable"],weight: 9  },
    vlans:       { required: ["vlan"],             weight: 7  },
    protocols:   { required: ["protocol"],         weight: 5  },
  };
  
  /* ── Utilidades ─────────────────────────────────────────────────────────── */
  
  /** Normaliza una cadena para comparación fuzzy */
  function norm(s = "") {
    return String(s).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // sin tildes
      .replace(/[^a-z0-9]/g, "");                          // solo alfanumérico
  }
  
  /** Busca en `cols` el que más se parezca a alguno de `candidates` */
  function findCol(cols, candidates) {
    for (const cand of candidates) {
      // Exacto (sin normalizar)
      const exact = cols.find(c => c.toLowerCase() === cand.toLowerCase());
      if (exact) return exact;
    }
    for (const cand of candidates) {
      // Exacto normalizado
      const normed = cols.find(c => norm(c) === norm(cand));
      if (normed) return normed;
    }
    for (const cand of candidates) {
      // Parcial normalizado
      const partial = cols.find(c => norm(c).includes(norm(cand)) || norm(cand).includes(norm(c)));
      if (partial) return partial;
    }
    return null;
  }
  
  /** Detecta qué tipo de hoja es basándose en sus columnas */
  function detectSheetType(rows) {
    if (!rows?.length) return "unknown";
    const cols = Object.keys(rows[0] || {}).map(c => norm(c));
  
    const scores = {};
    for (const [type, { required, weight }] of Object.entries(SHEET_DETECT)) {
      const matches = required.filter(req =>
        cols.some(col => col.includes(norm(req)) || norm(req).includes(col))
      ).length;
      scores[type] = (matches / required.length) * weight;
    }
  
    // También detectar por nombre de hoja (si se pasa)
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return best[0][1] > 0 ? best[0][0] : "unknown";
  }
  
  /** Detecta tipo de hoja también por su nombre */
  function detectBySheetName(name = "") {
    const n = norm(name);
    if (n.includes("asset") || n.includes("activo") || n.includes("inventario") || n.includes("device") || n.includes("equipo")) return "assets";
    if (n.includes("conn") || n.includes("link") || n.includes("enlace") || n.includes("topolog")) return "connections";
    if (n.includes("line") || n.includes("linea")) return "lines";
    if (n.includes("var") || n.includes("tag"))   return "variables";
    if (n.includes("vlan") || n.includes("red") || n.includes("network")) return "vlans";
    if (n.includes("proto")) return "protocols";
    return null;
  }
  
  /** Extrae y normaliza un valor de fila dado un diccionario de columnas */
  function extractRow(row, colMap, colDef) {
    const result = {};
    const rawCols = Object.keys(row);
  
    for (const [internalKey, candidates] of Object.entries(colDef)) {
      // Primero usar mapeo manual si existe
      if (colMap[internalKey]) {
        result[internalKey] = row[colMap[internalKey]] ?? null;
      } else {
        const found = findCol(rawCols, candidates);
        result[internalKey] = found ? (row[found] ?? null) : null;
      }
    }
    return result;
  }
  
  /** Limpia y tipifica un protocolo (split por ; o ,) */
  function parseProtocols(raw) {
    if (!raw) return [];
    return String(raw)
      .split(/[;,|]/)
      .map(p => p.trim())
      .filter(Boolean);
  }
  
  /** Normaliza el nivel Purdue a string limpio */
  function parsePurdueLevel(raw) {
    if (raw == null) return "1";
    const s = String(raw).trim();
    if (s === "3.5" || s === "3,5") return "3.5";
    const n = parseInt(s);
    return isNaN(n) ? "1" : String(Math.min(5, Math.max(0, n)));
  }
  
  /** Normaliza dirección de conexión */
  function parseDirection(raw = "") {
    const r = norm(raw);
    if (r.includes("bi") || r.includes("ambos"))       return "bidirectional";
    if (r.includes("out") || r.includes("salida"))     return "outbound";
    if (r.includes("in") || r.includes("entrada"))     return "inbound";
    return "bidirectional";
  }
  
  /* ── Normalizadores por tipo ─────────────────────────────────────────────── */
  
  function normalizeAsset(raw, colMap = {}) {
    const r = extractRow(raw, colMap, ASSET_COLS);
    return {
      id:          String(r.id  ?? "?"),
      name:        String(r.name ?? r.id ?? ""),
      type:        String(r.type ?? "Unknown"),
      vendor:      String(r.vendor ?? ""),
      model:       String(r.model ?? ""),
      ip:          String(r.ip  ?? "—"),
      mac:         String(r.mac ?? "—"),
      vlan:        String(r.vlan ?? ""),
      line:        String(r.line ?? "SHARED"),
      status:      String(r.status ?? "ONLINE").toUpperCase(),
      purdueLevel: parsePurdueLevel(r.purdueLevel),
      firmware:    String(r.firmware ?? ""),
      application: String(r.application ?? ""),
      protocols:   parseProtocols(r.protocols),
      ports:       r.ports ? parseProtocols(r.ports) : [],
      description: String(r.description ?? ""),
      _raw: raw,
    };
  }
  
  function normalizeConnection(raw, colMap = {}) {
    const r = extractRow(raw, colMap, CONN_COLS);
    return {
      sourceId:  String(r.sourceId ?? ""),
      targetId:  String(r.targetId ?? ""),
      protocol:  String(r.protocol ?? ""),
      port:      r.port != null ? String(r.port) : "",
      direction: parseDirection(r.direction),
      allowed:   r.allowed == null || String(r.allowed).toUpperCase() !== "NO",
      _raw: raw,
    };
  }
  
  function normalizeLine(raw, colMap = {}) {
    const r = extractRow(raw, colMap, LINE_COLS);
    return {
      id:          String(r.id ?? ""),
      name:        String(r.name ?? r.id ?? ""),
      description: String(r.description ?? ""),
      order:       parseInt(r.order) || 99,
    };
  }
  
  function normalizeVariable(raw, colMap = {}) {
    const r = extractRow(raw, colMap, VAR_COLS);
    return {
      assetId:      String(r.assetId ?? ""),
      variable:     String(r.variable ?? ""),
      type:         String(r.type ?? "float"),
      initialValue: r.initialValue,
      min:          r.min,
      max:          r.max,
      unit:         String(r.unit ?? ""),
      description:  String(r.description ?? ""),
    };
  }
  
  function normalizeVlan(raw, colMap = {}) {
    const r = extractRow(raw, colMap, VLAN_COLS);
    return {
      id:          String(r.id ?? ""),
      name:        String(r.name ?? ""),
      zone:        String(r.zone ?? ""),
      description: String(r.description ?? ""),
    };
  }
  
  function normalizeProtocol(raw, colMap = {}) {
    const r = extractRow(raw, colMap, PROTO_COLS);
    return {
      protocol:    String(r.protocol ?? ""),
      transport:   String(r.transport ?? ""),
      port:        r.port != null ? String(r.port) : "",
      description: String(r.description ?? ""),
    };
  }
  
  /* ── FUNCIÓN PRINCIPAL ──────────────────────────────────────────────────── */
  
  /**
   * Convierte los datos crudos de SheetJS en el formato interno LabData.
   *
   * @param {Object} rawSheets  — { sheetName: [ rowObject, ... ], ... }
   *                              donde rowObject son los objetos que devuelve
   *                              XLSX.utils.sheet_to_json(ws, { defval: null })
   * @param {Object} colMaps    — mapeos manuales opcionales por tipo:
   *                              { assets: { id: "AssetID", ... }, connections: {...} }
   * @returns {Object} LabData
   */
  export function parseExcel(rawSheets, colMaps = {}) {
    // Clasificar cada hoja
    const classified = {};
    for (const [sheetName, rows] of Object.entries(rawSheets)) {
      if (!rows?.length) continue;
      // Intentar por nombre primero, luego por contenido
      const byName    = detectBySheetName(sheetName);
      const byContent = detectSheetType(rows);
      const type = byName ?? byContent;
  
      if (type !== "unknown" && !classified[type]) {
        classified[type] = { sheetName, rows };
      }
    }
  
    const result = {
      assets:      [],
      connections: [],
      lines:       [],
      variables:   [],
      vlans:       [],
      protocols:   [],
      meta: {
        sheetNames:  Object.keys(rawSheets),
        classified:  Object.entries(classified).map(([type, { sheetName }]) => ({ type, sheetName })),
        importedAt:  new Date().toISOString(),
      },
    };
  
    // Assets
    if (classified.assets) {
      result.assets = classified.assets.rows
        .filter(r => r && Object.values(r).some(v => v != null))
        .map(r => normalizeAsset(r, colMaps.assets ?? {}))
        .filter(a => a.id && a.id !== "?");
    }
  
    // Connections
    if (classified.connections) {
      result.connections = classified.connections.rows
        .filter(r => r && Object.values(r).some(v => v != null))
        .map(r => normalizeConnection(r, colMaps.connections ?? {}))
        .filter(c => c.sourceId && c.targetId);
    }
  
    // Lines
    if (classified.lines) {
      result.lines = classified.lines.rows
        .filter(r => r && Object.values(r).some(v => v != null))
        .map(r => normalizeLine(r, colMaps.lines ?? {}))
        .filter(l => l.id)
        .sort((a, b) => a.order - b.order);
    }
  
    // Variables
    if (classified.variables) {
      result.variables = classified.variables.rows
        .filter(r => r && Object.values(r).some(v => v != null))
        .map(r => normalizeVariable(r, colMaps.variables ?? {}))
        .filter(v => v.assetId && v.variable);
    }
  
    // VLANs
    if (classified.vlans) {
      result.vlans = classified.vlans.rows
        .filter(r => r && Object.values(r).some(v => v != null))
        .map(r => normalizeVlan(r, colMaps.vlans ?? {}))
        .filter(v => v.id);
    }
  
    // Protocols
    if (classified.protocols) {
      result.protocols = classified.protocols.rows
        .filter(r => r && Object.values(r).some(v => v != null))
        .map(r => normalizeProtocol(r, colMaps.protocols ?? {}))
        .filter(p => p.protocol);
    }
  
    // Si no hay hoja de Lines, generarla desde los assets
    if (!result.lines.length && result.assets.length) {
      const lineSet = {};
      for (const a of result.assets) {
        if (!lineSet[a.line]) {
          lineSet[a.line] = {
            id:          a.line,
            name:        a.line,
            description: "",
            order:       Object.keys(lineSet).length + 1,
          };
        }
      }
      result.lines = Object.values(lineSet).sort((a, b) => a.order - b.order);
    }
  
    return result;
  }
  
  /**
   * Genera un resumen legible de lo que se encontró en el Excel.
   */
  export function summarizeLabData(data) {
    const lineCount  = data.lines.filter(l => l.id !== "SHARED").length;
    const assetsByLine = {};
    for (const a of data.assets) {
      assetsByLine[a.line] = (assetsByLine[a.line] ?? 0) + 1;
    }
    return {
      totalAssets:   data.assets.length,
      totalConns:    data.connections.length,
      totalLines:    lineCount,
      totalVars:     data.variables.length,
      totalVlans:    data.vlans.length,
      assetsByLine,
      typeBreakdown: Object.entries(
        data.assets.reduce((acc, a) => { acc[a.type] = (acc[a.type]??0)+1; return acc; }, {})
      ).sort((a,b) => b[1]-a[1]),
    };
  }
  
  /**
   * Detecta los mejores mapeos de columnas para mostrar en la UI.
   * Retorna { assets: { id: "ID", name: "Name", ... }, connections: {...} }
   */
  export function detectColumnMappings(rawSheets) {
    const result = {};
  
    const detect = (rows, colDef) => {
      if (!rows?.length) return {};
      const rawCols = Object.keys(rows[0] ?? {});
      const mapping = {};
      for (const [key, candidates] of Object.entries(colDef)) {
        const found = findCol(rawCols, candidates);
        if (found) mapping[key] = found;
      }
      return mapping;
    };
  
    // Detectar hoja de activos
    for (const [name, rows] of Object.entries(rawSheets)) {
      const type = detectBySheetName(name) ?? detectSheetType(rows);
      if (type === "assets")      result.assets      = detect(rows, ASSET_COLS);
      if (type === "connections")  result.connections = detect(rows, CONN_COLS);
      if (type === "lines")        result.lines       = detect(rows, LINE_COLS);
      if (type === "variables")    result.variables   = detect(rows, VAR_COLS);
      if (type === "vlans")        result.vlans       = detect(rows, VLAN_COLS);
      if (type === "protocols")    result.protocols   = detect(rows, PROTO_COLS);
    }
  
    return result;
  }
  
  // Exportar las definiciones para la UI de mapeo manual
  export const COL_DEFINITIONS = {
    ASSET_COLS, CONN_COLS, LINE_COLS, VAR_COLS, VLAN_COLS, PROTO_COLS,
  };