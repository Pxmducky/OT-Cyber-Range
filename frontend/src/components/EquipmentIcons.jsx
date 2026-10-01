/**
 * EquipmentIcons.jsx
 * Iconos SVG realistas de equipos industriales para el OT Cyber Range Lab.
 * Cada icono es una representación visual del equipo real (vista frontal/isométrica).
 * Se selecciona automáticamente por Type + Vendor del Excel importado.
 */

/* ── Paleta de colores por vendor ─────────────────────────────────────────── */
const V = {
    siemens:   { primary: "#009999", dark: "#004d4d", light: "#00cccc", bg: "#001a1a" },
    rockwell:  { primary: "#CC2200", dark: "#7a1500", light: "#ff4422", bg: "#1a0500" },
    hirsch:    { primary: "#0055A5", dark: "#003366", light: "#3399ff", bg: "#000d1a" },
    cisco:     { primary: "#1BA0D7", dark: "#0d6088", light: "#4dc3f0", bg: "#001520" },
    fortinet:  { primary: "#EE3124", dark: "#8c1b15", light: "#ff6655", bg: "#1a0500" },
    fanuc:     { primary: "#FFCD00", dark: "#997a00", light: "#ffe066", bg: "#1a1500" },
    kuka:      { primary: "#FF6600", dark: "#993d00", light: "#ff9944", bg: "#1a0d00" },
    abb:       { primary: "#FF000F", dark: "#990009", light: "#ff4455", bg: "#1a0003" },
    dmg:       { primary: "#F26522", dark: "#8f3a13", light: "#f5945a", bg: "#1a0d05" },
    engel:     { primary: "#1A5276", dark: "#0d2e42", light: "#2980B9", bg: "#030e15" },
    cognex:    { primary: "#0072BB", dark: "#004070", light: "#3399dd", bg: "#00101e" },
    ni:        { primary: "#33A8E0", dark: "#1a6690", light: "#66ccff", bg: "#00131a" },
    sew:       { primary: "#00A0DB", dark: "#006080", light: "#44ccff", bg: "#00131a" },
    phoenix:   { primary: "#D40000", dark: "#7a0000", light: "#ff3333", bg: "#1a0000" },
    hms:       { primary: "#005B8E", dark: "#003355", light: "#3399cc", bg: "#000d1a" },
    emerson:   { primary: "#0069AD", dark: "#003d66", light: "#3399dd", bg: "#00101a" },
    hp:        { primary: "#0096D6", dark: "#005580", light: "#33bbff", bg: "#00131a" },
    generic:   { primary: "#3b82f6", dark: "#1d4ed8", light: "#93c5fd", bg: "#0d1f40" },
  };
  
  function getVendorColors(vendor = "") {
    const v = vendor.toLowerCase();
    if (v.includes("siemens"))           return V.siemens;
    if (v.includes("rockwell") || v.includes("allen") || v.includes("ab")) return V.rockwell;
    if (v.includes("hirsch"))            return V.hirsch;
    if (v.includes("cisco"))             return V.cisco;
    if (v.includes("fortinet"))          return V.fortinet;
    if (v.includes("fanuc"))             return V.fanuc;
    if (v.includes("kuka"))              return V.kuka;
    if (v.includes("abb"))               return V.abb;
    if (v.includes("dmg"))               return V.dmg;
    if (v.includes("engel"))             return V.engel;
    if (v.includes("cognex"))            return V.cognex;
    if (v.includes("national") || v.includes("ni")) return V.ni;
    if (v.includes("sew"))               return V.sew;
    if (v.includes("phoenix") || v.includes("contact")) return V.phoenix;
    if (v.includes("hms") || v.includes("ewon")) return V.hms;
    if (v.includes("emerson") || v.includes("fisher") || v.includes("rosemount")) return V.emerson;
    if (v.includes("hp") || v.includes("hewlett")) return V.hp;
    return V.generic;
  }
  
  function statusLED(status) {
    return {
      ONLINE:      "#22c55e",
      OFFLINE:     "#4b5563",
      WARNING:     "#f59e0b",
      COMPROMISED: "#ef4444",
      DAMAGED:     "#ef4444",
    }[status?.toUpperCase()] ?? "#22c55e";
  }
  
  /* ═══════════════════════════════════════════════════════════════
     RENDERERS POR TIPO DE EQUIPO
  ═══════════════════════════════════════════════════════════════ */
  
  /** PLC — Siemens S7-1500 / S7-1200 / Rockwell ControlLogix / Genérico */
  export function IconPLC({ vendor = "Siemens", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
    const isRockwell = vendor.toLowerCase().includes("rockwell") || vendor.toLowerCase().includes("allen");
    const isS1200    = model.includes("1200") || model.includes("1214");
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label={`PLC ${vendor}`}>
        {/* DIN rail */}
        <rect x={2} y={70} width={76} height={5} rx={1} fill="#374151"/>
        <rect x={2} y={71} width={76} height={1} fill="#4b5563"/>
        {/* Cabinet body */}
        <rect x={3} y={6} width={74} height={64} rx={3} fill="#0d1520" stroke={c.primary} strokeWidth={1}/>
  
        {isRockwell ? (
          /* Rockwell ControlLogix — chassis horizontal */
          <>
            <rect x={5} y={8} width={70} height={20} rx={2} fill={c.bg} stroke={c.dark}/>
            <text x={40} y={20} textAnchor="middle" fontSize={6} fill={c.primary} fontWeight="bold" fontFamily="monospace">ControlLogix</text>
            {[0,1,2,3,4,5,6].map(i => (
              <rect key={i} x={7+i*9} y={30} width={7} height={34} rx={1} fill={i===0?c.bg:"#0d1a24"} stroke={i===0?c.primary:"#1e293b"}/>
            ))}
            {[0,1,2,3,4].map(i => (
              <rect key={i} x={9} y={32+i*6} width={3} height={4} rx={0.5} fill={c.dark}/>
            ))}
            <circle cx={12} cy={38} r={2.5} fill={led}/>
            <circle cx={12} cy={45} r={2.5} fill="#f59e0b" opacity={0.6}/>
            <text x={40} y={72} textAnchor="middle" fontSize={4} fill={c.primary} fontFamily="monospace">ALLEN·BRADLEY</text>
          </>
        ) : isS1200 ? (
          /* Siemens S7-1200 — compacto */
          <>
            <rect x={5} y={8} width={32} height={56} rx={2} fill={c.bg} stroke={c.primary} strokeWidth={1}/>
            <rect x={7} y={12} width={28} height={18} rx={1} fill="#001a1a"/>
            <text x={21} y={23} textAnchor="middle" fontSize={5} fill={c.light} fontFamily="monospace">S7-1200</text>
            <circle cx={13} cy={38} r={2.5} fill={led}/>
            <circle cx={20} cy={38} r={2.5} fill="#f59e0b" opacity={status==="WARNING"?1:0.3}/>
            <circle cx={27} cy={38} r={2.5} fill="#3b82f6" opacity={0.5}/>
            {[0,1,2,3,4,5].map(i => (
              <rect key={i} x={8} y={44+i*3} width={22} height={2} rx={0.5} fill="#0d2a2a"/>
            ))}
            <rect x={39} y={8} width={22} height={56} rx={1.5} fill="#0d1520" stroke="#1e293b"/>
            {[0,1,2,3,4,5,6,7].map(i => (
              <rect key={i} x={41} y={11+i*6} width={18} height={4} rx={0.5} fill="#050c14"/>
            ))}
            <text x={40} y={72} textAnchor="middle" fontSize={4} fill={c.primary} fontFamily="monospace">SIMATIC</text>
          </>
        ) : (
          /* Siemens S7-1500 — módulos verticales */
          <>
            {/* CPU module */}
            <rect x={5} y={8} width={20} height={56} rx={2} fill={c.bg} stroke={c.primary} strokeWidth={1.2}/>
            <rect x={7} y={12} width={16} height={12} rx={1} fill="#001a1a"/>
            <text x={15} y={19.5} textAnchor="middle" fontSize={4} fill={c.light} fontFamily="monospace">S7-1500</text>
            <circle cx={12} cy={30} r={2.5} fill={led}/>
            <circle cx={18} cy={30} r={2.5} fill="#f59e0b" opacity={status==="WARNING"?1:0.3}/>
            {[0,1,2,3,4].map(i => (
              <rect key={i} x={7} y={36+i*5} width={14} height={3} rx={0.5} fill="#002a2a"/>
            ))}
            {/* IO modules */}
            {[0,1,2].map(m => (
              <g key={m}>
                <rect x={27+m*17} y={8} width={14} height={56} rx={1.5} fill="#0d1a24" stroke="#1e293b"/>
                {[0,1,2,3,4,5,6,7].map(i => (
                  <rect key={i} x={29+m*17} y={11+i*6} width={10} height={4} rx={0.5} fill="#050c14"/>
                ))}
              </g>
            ))}
            <text x={40} y={72} textAnchor="middle" fontSize={4} fill={c.primary} fontFamily="monospace">SIMATIC</text>
          </>
        )}
      </svg>
    );
  }
  
  /** HMI — Siemens KP/TP / Rockwell PanelView */
  export function IconHMI({ vendor = "Siemens", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
    const isRockwell = vendor.toLowerCase().includes("rockwell");
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="HMI Panel">
        {/* Wall mount bracket */}
        <rect x={2}  y={5}  width={6}  height={70} rx={2} fill="#1e293b"/>
        <rect x={72} y={5}  width={6}  height={70} rx={2} fill="#1e293b"/>
        {/* Panel body */}
        <rect x={8} y={8} width={64} height={64} rx={4} fill="#0d1117" stroke={c.primary} strokeWidth={1.2}/>
        {/* Screen area */}
        <rect x={11} y={11} width={54} height={46} rx={2} fill="#000d1a"/>
        <rect x={12} y={12} width={52} height={44} rx={1.5} fill="#001020"/>
        {/* Screen content simulation */}
        <rect x={13} y={13} width={50} height={8} rx={1} fill={c.bg} opacity={0.8}/>
        <text x={38} y={19} textAnchor="middle" fontSize={4.5} fill={c.primary} fontFamily="monospace">PROD LINE 01 — RUN</text>
        {[0,1,2].map(i => (
          <rect key={i} x={14} y={24+i*9} width={48} height={7} rx={1} fill="#020c14" stroke="#1e293b" strokeWidth={0.5}/>
        ))}
        <rect x={16} y={26} width={12} height={3} rx={0.5} fill={c.bg}/>
        <rect x={16} y={35} width={18} height={3} rx={0.5} fill={c.bg}/>
        <rect x={16} y={44} width={8}  height={3} rx={0.5} fill="#f59e0b" opacity={status==="WARNING"?1:0.3}/>
        {/* Bottom buttons */}
        <rect x={11} y={59} width={54} height={10} rx={1} fill="#050c14"/>
        {[0,1,2,3,4].map(i => (
          <rect key={i} x={13+i*11} y={61} width={9} height={6} rx={1} fill="#0d1a24" stroke="#1e293b"/>
        ))}
        {/* Status LED */}
        <circle cx={68} cy={10} r={2.5} fill={led}/>
        {/* Brand label */}
        <text x={38} y={76} textAnchor="middle" fontSize={4} fill={c.primary} fontFamily="monospace">
          {isRockwell ? "PanelView Plus 7" : "Comfort Panel"}
        </text>
      </svg>
    );
  }
  
  /** SCADA Server — rack 1U/2U */
  export function IconSCADA({ vendor = "Siemens", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="SCADA Server">
        {/* Rack rails */}
        <rect x={2} y={5}  width={4} height={70} rx={1} fill="#374151"/>
        <rect x={74} y={5} width={4} height={70} rx={1} fill="#374151"/>
        {/* Server 1U */}
        <rect x={6} y={12} width={68} height={16} rx={2} fill="#0d1520" stroke={c.primary} strokeWidth={1}/>
        {/* Power button */}
        <circle cx={14} cy={20} r={4} fill={c.bg} stroke={c.primary}/>
        <circle cx={14} cy={20} r={2} fill={led}/>
        {/* Drive bays */}
        {[0,1,2,3].map(i => (
          <rect key={i} x={22+i*12} y={14} width={10} height={10} rx={1} fill="#050c14" stroke="#1e293b"/>
        ))}
        {/* Activity LEDs */}
        <circle cx={70} cy={17} r={1.5} fill={led}><animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/></circle>
        <circle cx={70} cy={23} r={1.5} fill={led}><animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite"/></circle>
        {/* Server 2U */}
        <rect x={6} y={30} width={68} height={20} rx={2} fill="#0d1520" stroke={c.dark} strokeWidth={0.8}/>
        <rect x={8}  y={32} width={48} height={8}  rx={1} fill="#050c14"/>
        <rect x={8}  y={42} width={48} height={6}  rx={1} fill="#050c14"/>
        {/* Port panel */}
        <rect x={6} y={52} width={68} height={12} rx={2} fill="#080e18" stroke="#1e293b"/>
        {[0,1,2,3,4,5,6,7].map(i => (
          <rect key={i} x={10+i*8} y={55} width={6} height={6} rx={1} fill="#040a12"/>
        ))}
        {/* Brand text */}
        <text x={40} y={9}  textAnchor="middle" fontSize={4}   fill={c.primary} fontFamily="monospace">{model.split(" ").slice(0,2).join(" ") || "SCADA Server"}</text>
        <text x={40} y={74} textAnchor="middle" fontSize={4.5} fill={c.primary} fontFamily="monospace">{vendor}</text>
      </svg>
    );
  }
  
  /** Switch industrial — Hirschmann / Cisco IE */
  export function IconSwitch({ vendor = "Hirschmann", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="Industrial Switch">
        {/* DIN rail clip */}
        <rect x={28} y={70} width={24} height={6} rx={1} fill="#374151"/>
        {/* Device body */}
        <rect x={4} y={10} width={72} height={58} rx={4} fill="#0a1220" stroke={c.primary} strokeWidth={1.2}/>
        {/* Top label bar */}
        <rect x={4} y={10} width={72} height={12} rx={4} fill={c.bg}/>
        <rect x={4} y={16} width={72} height={6}  rx={0} fill={c.bg}/>
        <text x={40} y={19} textAnchor="middle" fontSize={5} fill={c.primary} fontFamily="monospace" fontWeight="bold">
          {vendor.includes("Cisco") ? "Cisco IE-4000" : "Hirschmann RS20"}
        </text>
        {/* Port row 1 — RJ45 */}
        {[0,1,2,3].map(i => (
          <g key={i}>
            <rect x={8+i*18} y={26} width={14} height={11} rx={1} fill="#040c18" stroke="#1e293b"/>
            <rect x={10+i*18} y={28} width={10} height={7}  rx={0.5} fill="#050f1e"/>
            <circle cx={14+i*18} cy={25} r={1.5} fill={led}><animate attributeName="opacity" values="1;0.3;1" dur={`${0.5+i*0.3}s`} repeatCount="indefinite"/></circle>
          </g>
        ))}
        {/* Port row 2 */}
        {[0,1,2,3].map(i => (
          <g key={i}>
            <rect x={8+i*18} y={40} width={14} height={11} rx={1} fill="#040c18" stroke="#1e293b"/>
            <rect x={10+i*18} y={42} width={10} height={7}  rx={0.5} fill="#050f1e"/>
            <circle cx={14+i*18} cy={39} r={1.5} fill={led} opacity={0.5}/>
          </g>
        ))}
        {/* SFP uplink port */}
        <rect x={60} y={52} width={14} height={10} rx={1} fill={c.bg} stroke={c.primary}/>
        <text x={67} y={59} textAnchor="middle" fontSize={3.5} fill={c.primary} fontFamily="monospace">SFP</text>
        {/* Status LEDs */}
        <circle cx={10} cy={60} r={2.5} fill={led}/>
        <circle cx={16} cy={60} r={2.5} fill="#3b82f6" opacity={0.7}/>
        <circle cx={22} cy={60} r={2.5} fill="#f59e0b" opacity={0.5}/>
        <text x={40} y={76} textAnchor="middle" fontSize={4} fill={c.primary} fontFamily="monospace">{vendor}</text>
      </svg>
    );
  }
  
  /** Firewall — FortiGate / genérico */
  export function IconFirewall({ vendor = "Fortinet", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="Firewall">
        {/* Rack ears */}
        <rect x={1}  y={22} width={5}  height={36} rx={1} fill="#1e293b"/>
        <rect x={74} y={22} width={5}  height={36} rx={1} fill="#1e293b"/>
        {/* 1U body */}
        <rect x={6} y={20} width={68} height={40} rx={3} fill="#0d1117" stroke={c.primary} strokeWidth={1.5}/>
        {/* Left: power + status */}
        <rect x={8} y={24} width={16} height={32} rx={2} fill={c.bg}/>
        <circle cx={16} cy={32} r={5} fill={c.dark} stroke={c.primary}/>
        <circle cx={16} cy={32} r={2.5} fill={led}/>
        <text x={16} y={45} textAnchor="middle" fontSize={3.5} fill={c.primary} fontFamily="monospace">PWR</text>
        <circle cx={16} cy={50} r={2} fill={led}><animate attributeName="opacity" values="1;0.2;1" dur="0.8s" repeatCount="indefinite"/></circle>
        {/* Network ports */}
        {[0,1,2,3,4,5,6].map(i => (
          <g key={i}>
            <rect x={28+i*6} y={26} width={5} height={4} rx={0.5} fill="#040a12" stroke="#1e293b"/>
            <rect x={28+i*6} y={32} width={5} height={4} rx={0.5} fill="#040a12" stroke="#1e293b"/>
            <circle cx={30.5+i*6} cy={25} r={1} fill={i<3?led:"#1e293b"}/>
          </g>
        ))}
        {/* WAN port (labeled) */}
        <rect x={68} y={28} width={5} height={10} rx={1} fill={c.bg} stroke={c.primary}/>
        <text x={70.5} y={35} textAnchor="middle" fontSize={3} fill={c.primary} fontFamily="monospace">W</text>
        {/* Brand */}
        <text x={40} y={14} textAnchor="middle" fontSize={5} fill={c.primary} fontFamily="monospace" fontWeight="bold">
          {vendor.includes("Fortinet") ? "FortiGate" : "Firewall"}
        </text>
        <text x={40} y={68} textAnchor="middle" fontSize={4} fill={c.primary} fontFamily="monospace">{model.split(" ").slice(0,2).join(" ")}</text>
      </svg>
    );
  }
  
  /** eWON gateway (Cosy+ / Flexy) */
  export function IconEWON({ vendor = "HMS", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="eWON Gateway">
        {/* DIN rail */}
        <rect x={20} y={70} width={40} height={5} rx={1} fill="#374151"/>
        {/* Device body */}
        <rect x={18} y={10} width={44} height={58} rx={4} fill="#0a1520" stroke={c.primary} strokeWidth={1.2}/>
        {/* eWON logo area */}
        <rect x={20} y={12} width={40} height={10} rx={2} fill={c.bg}/>
        <text x={40} y={19} textAnchor="middle" fontSize={6} fill={c.primary} fontFamily="monospace" fontWeight="bold">eWON</text>
        {/* Antenna */}
        <line x1={40} y1={10} x2={40} y2={4} stroke={c.primary} strokeWidth={2.5} strokeLinecap="round"/>
        <path d="M33,7 Q40,2 47,7" fill="none" stroke={c.primary} strokeWidth={1.5}/>
        <path d="M36,9 Q40,5 44,9" fill="none" stroke={c.primary} strokeWidth={1}/>
        {/* Status LEDs */}
        <text x={28} y={32} fontSize={3.5} fill="#4b5563" fontFamily="monospace">PWR</text>
        <text x={28} y={38} fontSize={3.5} fill="#4b5563" fontFamily="monospace">VPN</text>
        <text x={28} y={44} fontSize={3.5} fill="#4b5563" fontFamily="monospace">WAN</text>
        <circle cx={46} cy={31} r={3} fill={led}/>
        <circle cx={46} cy={37} r={3} fill={status==="ONLINE"?"#22c55e":"#374151"}/>
        <circle cx={46} cy={43} r={3} fill={status==="ONLINE"?"#3b82f6":"#374151"}/>
        {/* Ethernet ports */}
        <rect x={22} y={50} width={12} height={8} rx={1} fill="#040c18" stroke="#1e293b"/>
        <rect x={36} y={50} width={12} height={8} rx={1} fill="#040c18" stroke="#1e293b"/>
        <text x={28} y={57} textAnchor="middle" fontSize={3} fill="#4b5563" fontFamily="monospace">WAN</text>
        <text x={42} y={57} textAnchor="middle" fontSize={3} fill="#4b5563" fontFamily="monospace">LAN</text>
        <text x={40} y={74} textAnchor="middle" fontSize={4} fill={c.primary} fontFamily="monospace">Cosy+</text>
      </svg>
    );
  }
  
  /** mGuard Phoenix Contact */
  export function IconMGuard({ vendor = "Phoenix Contact", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="mGuard Security Device">
        {/* DIN clip */}
        <rect x={24} y={70} width={32} height={5} rx={1} fill="#374151"/>
        {/* Body */}
        <rect x={20} y={8} width={40} height={60} rx={3} fill="#0a1117" stroke={c.primary} strokeWidth={1.3}/>
        {/* Top label */}
        <rect x={20} y={8} width={40} height={14} rx={3} fill={c.bg}/>
        <rect x={20} y={16} width={40} height={6} fill={c.bg}/>
        <text x={40} y={17} textAnchor="middle" fontSize={4.5} fill={c.primary} fontFamily="monospace" fontWeight="bold">mGuard</text>
        {/* Shield icon */}
        <path d="M38,25 L40,22 L42,25 L42,32 Q40,35 38,32 Z" fill={c.bg} stroke={c.primary} strokeWidth={1}/>
        {/* LEDs */}
        {[["ERR","#ef4444",34],["RUN","#22c55e",40],["VPN","#3b82f6",46]].map(([lbl,clr,y]) => (
          <g key={lbl}>
            <text x={29} y={y} fontSize={3} fill="#4b5563" fontFamily="monospace">{lbl}</text>
            <circle cx={46} cy={y-3.5} r={2.5} fill={lbl==="RUN"?led:lbl==="ERR"&&status==="COMPROMISED"?"#ef4444":"#1e293b"}/>
          </g>
        ))}
        {/* Ports (orange = WAN, green = LAN) */}
        <rect x={24} y={52} width={14} height={8} rx={1} fill="#040c18" stroke="#EE3124"/>
        <rect x={42} y={52} width={14} height={8} rx={1} fill="#040c18" stroke="#22c55e"/>
        <text x={31} y={58} textAnchor="middle" fontSize={3} fill="#EE3124" fontFamily="monospace">WAN</text>
        <text x={49} y={58} textAnchor="middle" fontSize={3} fill="#22c55e" fontFamily="monospace">LAN</text>
        <text x={40} y={74} textAnchor="middle" fontSize={3.5} fill={c.primary} fontFamily="monospace">FL mGuard RS</text>
      </svg>
    );
  }
  
  /** Engineering Workstation — HP / genérico */
  export function IconWorkstation({ vendor = "HP", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="Engineering Workstation">
        {/* Monitor */}
        <rect x={10} y={5} width={60} height={44} rx={3} fill="#0a1117" stroke="#374151" strokeWidth={1}/>
        <rect x={12} y={7} width={56} height={40} rx={2} fill="#050d18"/>
        {/* Screen content (TIA Portal / IDE) */}
        <rect x={13} y={8} width={54} height={6} rx={1} fill="#0d1f2a"/>
        <text x={40} y={12.5} textAnchor="middle" fontSize={4} fill="#3b82f6" fontFamily="monospace">TIA Portal V19</text>
        <rect x={13} y={15} width={14} height={28} rx={1} fill="#080e18"/>
        <rect x={28} y={15} width={38} height={28} rx={1} fill="#040c14"/>
        {[0,1,2,3].map(i => (
          <rect key={i} x={30} y={17+i*6} width={16+i%2*8} height={2} rx={0.5} fill="#1e3a5f"/>
        ))}
        {/* Monitor stand */}
        <rect x={35} y={49} width={10} height={5} rx={1} fill="#1e293b"/>
        <rect x={28} y={54} width={24} height={3} rx={1} fill="#1e293b"/>
        {/* Tower PC */}
        <rect x={22} y={58} width={36} height={18} rx={2} fill="#0a1117" stroke={c.primary} strokeWidth={1}/>
        <circle cx={30} cy={67} r={3} fill="#050d18" stroke={c.primary}/>
        <circle cx={30} cy={67} r={1.5} fill={led}/>
        <rect x={36} y={62} width={8} height={4} rx={0.5} fill="#050d18" stroke="#1e293b"/>
        <rect x={36} y={68} width={8} height={4} rx={0.5} fill="#050d18" stroke="#1e293b"/>
        <text x={55} y={69} textAnchor="middle" fontSize={4} fill={c.primary} fontFamily="monospace">{vendor}</text>
      </svg>
    );
  }
  
  /** CNC — DMG MORI / genérico */
  export function IconCNC({ vendor = "DMG MORI", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="CNC Machine">
        {/* Machine body */}
        <rect x={3} y={10} width={74} height={62} rx={4} fill="#0a1420" stroke={c.primary} strokeWidth={1.2}/>
        {/* Work enclosure window */}
        <rect x={8} y={14} width={48} height={44} rx={3} fill="#040c14" stroke={c.dark}/>
        <rect x={9} y={15} width={46} height={42} rx={2} fill="#020a10"/>
        {/* Spindle */}
        <circle cx={32} cy={36} r={10} fill="#0d1a24" stroke={c.primary}/>
        <circle cx={32} cy={36} r={6}  fill={c.bg}/>
        <circle cx={32} cy={36} r={3}  fill={c.primary} opacity={0.8}/>
        {[0,60,120,180,240,300].map((deg,i) => {
          const r = (deg*Math.PI)/180;
          return <line key={i} x1={32+Math.cos(r)*6} y1={36+Math.sin(r)*6}
                       x2={32+Math.cos(r)*10} y2={36+Math.sin(r)*10}
                       stroke={c.primary} strokeWidth={1.5} opacity={0.6}/>;
        })}
        {/* Work table */}
        <rect x={10} y={48} width={44} height={8} rx={1} fill="#0d1a24" stroke="#1e293b"/>
        {[0,1,2].map(i => (
          <line key={i} x1={15+i*14} y1={48} x2={15+i*14} y2={56} stroke="#1e293b" strokeWidth={0.8}/>
        ))}
        {/* Control panel (right side) */}
        <rect x={58} y={14} width={18} height={44} rx={2} fill="#050c18" stroke={c.dark}/>
        <rect x={60} y={16} width={14} height={10} rx={1} fill="#000d18"/>
        <text x={67} y={23} textAnchor="middle" fontSize={3.5} fill={c.primary} fontFamily="monospace">Sinumerik</text>
        {[0,1,2,3,4].map(i => (
          <rect key={i} x={60} y={30+i*5} width={14} height={3} rx={0.5} fill="#0d1520"/>
        ))}
        <circle cx={67} cy={52} r={3} fill={c.bg} stroke={c.primary}/>
        <circle cx={67} cy={52} r={1.5} fill={led}/>
        {/* Brand */}
        <text x={32} y={66} textAnchor="middle" fontSize={4} fill={c.primary} fontFamily="monospace">{model.includes("NHX") ? model.split(" ").slice(0,2).join(" ") : "CNC"}</text>
        <text x={40} y={8} textAnchor="middle" fontSize={4.5} fill={c.primary} fontFamily="monospace" fontWeight="bold">DMG MORI</text>
      </svg>
    );
  }
  
  /** Robot industrial — FANUC / KUKA */
  export function IconRobot({ vendor = "FANUC", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
    const isKUKA = vendor.toLowerCase().includes("kuka");
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="Industrial Robot">
        {/* Base */}
        <rect x={20} y={64} width={40} height={10} rx={2} fill="#1e293b" stroke="#374151"/>
        <rect x={26} y={58} width={28} height={8} rx={2} fill={c.bg} stroke={c.primary}/>
        {/* Main body */}
        <rect x={28} y={42} width={24} height={18} rx={3} fill={c.bg} stroke={c.primary} strokeWidth={1.2}/>
        <circle cx={40} cy={51} r={6} fill={c.dark} stroke={c.primary}/>
        <circle cx={40} cy={51} r={3} fill={c.primary} opacity={0.8}/>
        {/* Arm link 1 */}
        <rect x={36} y={22} width={8} height={22} rx={3} fill={c.bg} stroke={c.primary}/>
        {/* Elbow joint */}
        <circle cx={40} cy={22} r={6} fill={c.dark} stroke={c.primary}/>
        <circle cx={40} cy={22} r={3} fill={c.primary} opacity={0.6}/>
        {/* Arm link 2 */}
        <line x1={40} y1={16} x2={56} y2={14} stroke={c.primary} strokeWidth={6} strokeLinecap="round"/>
        <line x1={40} y1={16} x2={56} y2={14} stroke={c.bg}      strokeWidth={3.5} strokeLinecap="round"/>
        {/* Wrist */}
        <circle cx={56} cy={14} r={5} fill={c.dark} stroke={c.primary}/>
        {/* Tool / end effector */}
        <rect x={54} y={6} width={5} height={10} rx={1.5} fill={c.primary} opacity={0.8}/>
        {/* Status LED on base */}
        <circle cx={32} cy={54} r={2.5} fill={led}/>
        {/* Controller cabinet (small) */}
        <rect x={4} y={44} width={16} height={26} rx={2} fill="#0a1117" stroke={c.dark}/>
        <rect x={6} y={46} width={12} height={8}  rx={1} fill="#050c14"/>
        <circle cx={12} cy={62} r={3} fill={c.bg} stroke={c.primary}/>
        <circle cx={12} cy={62} r={1.5} fill={led}/>
        {/* Brand */}
        <text x={40} y={78} textAnchor="middle" fontSize={5} fill={c.primary} fontFamily="monospace" fontWeight="bold">
          {isKUKA ? "KUKA" : "FANUC"}
        </text>
      </svg>
    );
  }
  
  /** Injection Molder — Engel */
  export function IconMolder({ vendor = "Engel", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="Injection Molder">
        {/* Machine base */}
        <rect x={2} y={52} width={76} height={20} rx={2} fill="#0a1220" stroke="#374151"/>
        {/* Clamping unit */}
        <rect x={4} y={22} width={30} height={32} rx={3} fill={c.bg} stroke={c.primary} strokeWidth={1.2}/>
        {/* Tie bars */}
        {[28,38].map(y => (
          <line key={y} x1={34} y1={y} x2={76} y2={y} stroke="#374151" strokeWidth={3} strokeLinecap="round"/>
        ))}
        {/* Injection unit */}
        <rect x={46} y={14} width={30} height={42} rx={3} fill="#0a1220" stroke={c.dark} strokeWidth={1}/>
        {/* Hopper */}
        <path d="M55,14 L65,14 L62,4 L58,4 Z" fill={c.bg} stroke={c.primary} strokeWidth={0.8}/>
        {/* Screw */}
        <rect x={48} y={26} width={26} height={8} rx={1} fill="#050c14" stroke="#1e293b"/>
        {/* Control panel */}
        <rect x={4} y={24} width={18} height={20} rx={2} fill="#050c14"/>
        <rect x={6} y={26} width={14} height={10} rx={1} fill="#000d18"/>
        <circle cx={13} cy={42} r={3} fill={c.bg} stroke={c.primary}/>
        <circle cx={13} cy={42} r={1.5} fill={led}/>
        {/* Brand */}
        <text x={40} y={10} textAnchor="middle" fontSize={5} fill={c.primary} fontFamily="monospace" fontWeight="bold">engel</text>
        <text x={40} y={72} textAnchor="middle" fontSize={3.5} fill={c.primary} fontFamily="monospace">{model.split(" ").slice(0,2).join(" ")}</text>
      </svg>
    );
  }
  
  /** Sensor de temperatura */
  export function IconTempSensor({ vendor = "Siemens", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="Temperature Transmitter">
        {/* Thermowell/probe */}
        <rect x={37} y={52} width={6} height={22} rx={2} fill="#374151"/>
        <rect x={38} y={72} width={4} height={4}  rx={2} fill="#1e293b"/>
        {/* Terminal head */}
        <rect x={24} y={22} width={32} height={32} rx={5} fill="#0a1220" stroke={c.primary} strokeWidth={1.3}/>
        {/* Display */}
        <rect x={27} y={26} width={26} height={12} rx={2} fill="#000d18"/>
        <text x={40} y={30} textAnchor="middle" fontSize={3.5} fill="#4b5563" fontFamily="monospace">TEMP</text>
        <text x={40} y={35} textAnchor="middle" fontSize={6} fill={c.primary} fontFamily="monospace" fontWeight="bold">68.4</text>
        <text x={54} y={35} fontSize={5} fill={c.primary} fontFamily="monospace">°C</text>
        {/* Connection terminals */}
        <circle cx={32} cy={44} r={2} fill={c.dark} stroke={c.primary}/>
        <circle cx={40} cy={44} r={2} fill={c.dark} stroke={c.primary}/>
        <circle cx={48} cy={44} r={2} fill={c.dark} stroke={c.primary}/>
        {/* Status */}
        <circle cx={40} cy={14} r={5} fill={c.bg} stroke={c.primary}/>
        <circle cx={40} cy={14} r={2.5} fill={led}/>
        {/* Label */}
        <text x={40} y={9} textAnchor="middle" fontSize={3.5} fill={c.primary} fontFamily="monospace">{vendor.split(" ")[0]}</text>
      </svg>
    );
  }
  
  /** Sensor de presión */
  export function IconPressSensor({ vendor = "Emerson", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="Pressure Transmitter">
        {/* Process connection */}
        <rect x={36} y={60} width={8} height={14} rx={2} fill="#374151"/>
        <rect x={32} y={57} width={16} height={5} rx={1} fill="#4b5563"/>
        {/* Diaphragm housing */}
        <circle cx={40} cy={44} r={14} fill="#0a1220" stroke={c.primary} strokeWidth={1.3}/>
        <circle cx={40} cy={44} r={10} fill={c.bg}/>
        {/* Gauge arc */}
        <path d="M32,50 A10,10 0 1,1 48,50" fill="none" stroke="#1e293b" strokeWidth={2}/>
        <path d="M32,50 A10,10 0 0,1 46,37" fill="none" stroke={c.primary} strokeWidth={2}/>
        <line x1={40} y1={44} x2={46} y2={38} stroke={c.light} strokeWidth={1.5} strokeLinecap="round"/>
        <circle cx={40} cy={44} r={2} fill={c.primary}/>
        {/* Electronics housing */}
        <rect x={26} y={18} width={28} height={20} rx={3} fill="#0a1220" stroke={c.dark}/>
        <text x={40} y={27} textAnchor="middle" fontSize={3.5} fill="#4b5563" fontFamily="monospace">PRESS</text>
        <text x={40} y={33} textAnchor="middle" fontSize={5} fill={c.primary} fontFamily="monospace" fontWeight="bold">3.82</text>
        {/* Status */}
        <circle cx={40} cy={10} r={5} fill={c.bg} stroke={c.primary}/>
        <circle cx={40} cy={10} r={2.5} fill={led}/>
        <text x={40} y={8} textAnchor="middle" fontSize={3.5} fill={c.primary} fontFamily="monospace">{vendor.split(" ")[0]}</text>
      </svg>
    );
  }
  
  /** Válvula de control */
  export function IconValve({ vendor = "Fisher", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="Control Valve">
        {/* Actuator (top) */}
        <rect x={24} y={4} width={32} height={28} rx={5} fill="#0a1220" stroke={c.primary} strokeWidth={1.2}/>
        <rect x={28} y={8} width={24} height={16} rx={3} fill={c.bg}/>
        <circle cx={40} cy={16} r={5} fill={c.dark} stroke={c.primary}/>
        <circle cx={40} cy={16} r={2} fill={led}/>
        {/* Stem */}
        <rect x={38} y={32} width={4} height={10} rx={1} fill="#374151"/>
        {/* Valve body */}
        <path d="M10,46 L38,42 L38,56 L10,52 Z" fill={c.bg} stroke={c.primary} strokeWidth={1}/>
        <path d="M42,42 L70,46 L70,52 L42,56 Z" fill={c.bg} stroke={c.primary} strokeWidth={1}/>
        <circle cx={40} cy={49} r={10} fill={c.dark} stroke={c.primary} strokeWidth={1.2}/>
        <circle cx={40} cy={49} r={5}  fill={c.bg}/>
        {/* Flow pipes */}
        <rect x={2}  y={47} width={10} height={5} rx={1} fill="#1e293b"/>
        <rect x={68} y={47} width={10} height={5} rx={1} fill="#1e293b"/>
        {/* Position indicator */}
        <rect x={56} y={30} width={14} height={10} rx={2} fill="#050c14" stroke={c.dark}/>
        <text x={63} y={37} textAnchor="middle" fontSize={4} fill={c.primary} fontFamily="monospace">50%</text>
        {/* Label */}
        <text x={40} y={72} textAnchor="middle" fontSize={4.5} fill={c.primary} fontFamily="monospace">Fisher DVC</text>
      </svg>
    );
  }
  
  /** Motor industrial */
  export function IconMotor({ vendor = "ABB", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="Industrial Motor">
        {/* Motor body */}
        <rect x={8} y={20} width={52} height={38} rx={6} fill="#0a1220" stroke={c.primary} strokeWidth={1.2}/>
        {/* Cooling fins */}
        {[0,1,2,3,4,5,6,7,8].map(i => (
          <line key={i} x1={10+i*6} y1={20} x2={10+i*6} y2={58} stroke={c.dark} strokeWidth={2} opacity={0.6}/>
        ))}
        {/* Front plate */}
        <circle cx={60} cy={39} r={14} fill={c.bg} stroke={c.primary} strokeWidth={1}/>
        <circle cx={60} cy={39} r={9} fill="#040c14"/>
        <circle cx={60} cy={39} r={5} fill={c.dark}/>
        {/* Shaft */}
        <rect x={72} y={37} width={8} height={4} rx={1.5} fill="#374151"/>
        {/* Terminal box */}
        <rect x={22} y={14} width={20} height={8} rx={2} fill="#050c14" stroke={c.dark}/>
        {[0,1,2].map(i => (
          <circle key={i} cx={28+i*6} cy={18} r={2} fill={c.dark} stroke={c.primary}/>
        ))}
        {/* Status LED */}
        <circle cx={16} cy={30} r={3} fill={led}/>
        {/* RPM badge */}
        <rect x={10} y={42} width={20} height={10} rx={2} fill="#000d18"/>
        <text x={20} y={49} textAnchor="middle" fontSize={4} fill={c.primary} fontFamily="monospace">1450</text>
        <text x={20} y={54} textAnchor="middle" fontSize={3} fill="#4b5563" fontFamily="monospace">RPM</text>
        {/* Brand */}
        <text x={32} y={72} textAnchor="middle" fontSize={5} fill={c.primary} fontFamily="monospace" fontWeight="bold">{vendor}</text>
      </svg>
    );
  }
  
  /** Variador de frecuencia / Drive */
  export function IconDrive({ vendor = "SEW", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="Variable Frequency Drive">
        {/* DIN rail */}
        <rect x={10} y={72} width={60} height={4} rx={1} fill="#374151"/>
        {/* Body */}
        <rect x={12} y={8} width={56} height={62} rx={4} fill="#0a1220" stroke={c.primary} strokeWidth={1.2}/>
        {/* Top: brand bar */}
        <rect x={12} y={8} width={56} height={12} rx={4} fill={c.bg}/>
        <rect x={12} y={14} width={56} height={6} fill={c.bg}/>
        <text x={40} y={17} textAnchor="middle" fontSize={6} fill={c.primary} fontFamily="monospace" fontWeight="bold">{vendor}</text>
        {/* Display */}
        <rect x={16} y={22} width={48} height={18} rx={2} fill="#000d18"/>
        <text x={40} y={30} textAnchor="middle" fontSize={3.5} fill="#4b5563" fontFamily="monospace">FREQ OUTPUT</text>
        <text x={40} y={37} textAnchor="middle" fontSize={8} fill={c.primary} fontFamily="monospace" fontWeight="bold">50.0</text>
        <text x={57} y={37} fontSize={4} fill={c.primary} fontFamily="monospace">Hz</text>
        {/* Control buttons */}
        {[["RUN","#22c55e",44],["STOP","#ef4444",52],["PROG","#3b82f6",60]].map(([lbl,clr,y]) => (
          <g key={lbl}>
            <rect x={16} y={y} width={14} height={6} rx={1.5} fill={clr} opacity={0.15} stroke={clr} strokeWidth={0.5}/>
            <text x={23} y={y+4.5} textAnchor="middle" fontSize={3.5} fill={clr} fontFamily="monospace">{lbl}</text>
          </g>
        ))}
        {/* Terminals */}
        <rect x={34} y={44} width={30} height={22} rx={1} fill="#040c14"/>
        {[0,1,2,3,4].map(i => (
          <rect key={i} x={36+i*5} y={46} width={4} height={18} rx={0.5} fill="#050e1a" stroke="#1e293b"/>
        ))}
        {/* Status */}
        <circle cx={62} cy={26} r={3} fill={led}/>
      </svg>
    );
  }
  
  /** Vision system — Cognex */
  export function IconVision({ vendor = "Cognex", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="Vision System">
        {/* Camera body */}
        <rect x={16} y={18} width={48} height={38} rx={5} fill="#0a1220" stroke={c.primary} strokeWidth={1.2}/>
        {/* Lens barrel */}
        <circle cx={40} cy={37} r={16} fill={c.bg} stroke={c.primary} strokeWidth={1}/>
        <circle cx={40} cy={37} r={12} fill="#030c18"/>
        <circle cx={40} cy={37} r={8}  fill={c.dark}/>
        <circle cx={40} cy={37} r={5}  fill={c.primary} opacity={0.6}/>
        <circle cx={40} cy={37} r={2}  fill={c.light}/>
        {/* LED ring for illumination */}
        {[0,45,90,135,180,225,270,315].map((deg,i) => {
          const r = (deg*Math.PI)/180;
          const x = 40 + Math.cos(r)*13;
          const y = 37 + Math.sin(r)*13;
          return <circle key={i} cx={x} cy={y} r={1.5} fill="#ffffff" opacity={0.6}/>;
        })}
        {/* IO connector */}
        <rect x={16} y={46} width={10} height={10} rx={1} fill="#040c14" stroke="#1e293b"/>
        {/* Cable */}
        <rect x={58} y={32} width={6} height={8} rx={1} fill="#040c14" stroke="#1e293b"/>
        {/* Mount hole top */}
        <circle cx={28} cy={19} r={2} fill="#050c14" stroke="#374151"/>
        <circle cx={52} cy={19} r={2} fill="#050c14" stroke="#374151"/>
        {/* Status */}
        <circle cx={64} cy={22} r={3} fill={led}/>
        <text x={40} y={12} textAnchor="middle" fontSize={4.5} fill={c.primary} fontFamily="monospace" fontWeight="bold">Cognex</text>
        <text x={40} y={68} textAnchor="middle" fontSize={3.5} fill={c.primary} fontFamily="monospace">{model.split(" ").slice(0,2).join(" ")}</text>
      </svg>
    );
  }
  
  /** NI PXI Test System */
  export function IconTester({ vendor = "National Instruments", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="Test System">
        {/* Chassis */}
        <rect x={4} y={8} width={72} height={60} rx={3} fill="#0a1220" stroke={c.primary} strokeWidth={1.2}/>
        {/* Top bar */}
        <rect x={4} y={8} width={72} height={14} rx={3} fill={c.bg}/>
        <rect x={4} y={16} width={72} height={6} fill={c.bg}/>
        <text x={40} y={18} textAnchor="middle" fontSize={5} fill={c.primary} fontFamily="monospace" fontWeight="bold">NI PXIe</text>
        {/* Module slots */}
        {[0,1,2,3,4,5].map(i => (
          <rect key={i} x={6+i*12} y={24} width={10} height={38} rx={1} fill={i===0?c.bg:"#050c14"} stroke={i===0?c.primary:"#1e293b"}/>
        ))}
        {/* Controller module (slot 0) */}
        <text x={11} y={30} textAnchor="middle" fontSize={3} fill={c.primary} fontFamily="monospace">CTRL</text>
        <rect x={7} y={32} width={8} height={6} rx={0.5} fill="#000d18"/>
        <circle cx={11} cy={42} r={2} fill={led}/>
        {/* USB/Display ports on chassis front */}
        <rect x={74} y={24} width={4} height={18} rx={1} fill="#040c14"/>
        {/* Status */}
        <text x={40} y={72} textAnchor="middle" fontSize={3.5} fill={c.primary} fontFamily="monospace">National Instruments</text>
      </svg>
    );
  }
  
  /** Conveyor Drive / Belt */
  export function IconConveyor({ vendor = "SEW", model = "", status = "ONLINE", size = 80 }) {
    const c = getVendorColors(vendor);
    const led = statusLED(status);
  
    return (
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="Conveyor">
        {/* Belt */}
        <rect x={4} y={32} width={72} height={16} rx={8} fill="#1e293b" stroke="#374151" strokeWidth={1}/>
        <ellipse cx={12} cy={40} rx={8} ry={10} fill={c.bg} stroke={c.primary}/>
        <ellipse cx={68} cy={40} rx={8} ry={10} fill={c.bg} stroke={c.primary}/>
        {/* Belt surface */}
        <rect x={12} y={34} width={56} height={12} fill="#0d1520"/>
        {/* Belt ribs */}
        {[0,1,2,3,4,5,6].map(i => (
          <line key={i} x1={16+i*8} y1={34} x2={16+i*8} y2={46} stroke="#1e3a5f" strokeWidth={1}/>
        ))}
        {/* Drive motor (right) */}
        <rect x={58} y={24} width={18} height={12} rx={2} fill={c.bg} stroke={c.primary}/>
        <text x={67} y={32} textAnchor="middle" fontSize={3.5} fill={c.primary} fontFamily="monospace">DRIVE</text>
        {/* Support legs */}
        <line x1={12} y1={50} x2={12} y2={68} stroke="#374151" strokeWidth={3}/>
        <line x1={40} y1={50} x2={40} y2={68} stroke="#374151" strokeWidth={3}/>
        <line x1={68} y1={50} x2={68} y2={68} stroke="#374151" strokeWidth={3}/>
        {/* Status */}
        <circle cx={62} cy={26} r={2} fill={led}/>
        <text x={40} y={76} textAnchor="middle" fontSize={4.5} fill={c.primary} fontFamily="monospace">{vendor}</text>
      </svg>
    );
  }
  
  /* ═══════════════════════════════════════════════════════════════
     DISPATCHER PRINCIPAL
     Devuelve el icono correcto según Type y Vendor del Excel
  ═══════════════════════════════════════════════════════════════ */
  export function EquipmentIcon({ asset, size = 80 }) {
    const { Type = "generic", Vendor = "", Model = "", Status = "ONLINE" } = asset;
    const type = Type.toLowerCase();
  
    const props = { vendor: Vendor, model: Model, status: Status, size };
  
    if (type === "plc")                              return <IconPLC {...props}/>;
    if (type === "hmi")                              return <IconHMI {...props}/>;
    if (type === "scada")                            return <IconSCADA {...props}/>;
    if (type === "switch")                           return <IconSwitch {...props}/>;
    if (type === "firewall")                         return <IconFirewall {...props}/>;
    if (type === "gateway" || type === "ewon")       return <IconEWON {...props}/>;
    if (type === "mguard" || type === "security")    return <IconMGuard {...props}/>;
    if (type === "workstation")                      return <IconWorkstation {...props}/>;
    if (type === "cnc")                              return <IconCNC {...props}/>;
    if (type === "robot")                            return <IconRobot {...props}/>;
    if (type === "molder" || type === "injection")   return <IconMolder {...props}/>;
    if (type === "sensor" && Model.toLowerCase().includes("pres")) return <IconPressSensor {...props}/>;
    if (type === "sensor")                           return <IconTempSensor {...props}/>;
    if (type === "valve")                            return <IconValve {...props}/>;
    if (type === "motor")                            return <IconMotor {...props}/>;
    if (type === "drive" || type === "conveyor")     return type === "conveyor" ? <IconConveyor {...props}/> : <IconDrive {...props}/>;
    if (type === "vision")                           return <IconVision {...props}/>;
    if (type === "tester")                           return <IconTester {...props}/>;
  
    // Fallback — generic device
    const c = getVendorColors(Vendor);
    return (
      <svg viewBox="0 0 80 80" width={size} height={size}>
        <rect x={8} y={8} width={64} height={64} rx={6} fill="#0a1220" stroke={c.primary} strokeWidth={1.2}/>
        <text x={40} y={44} textAnchor="middle" fontSize={8} fill={c.primary} fontFamily="monospace">{Type?.slice(0,3).toUpperCase()}</text>
        <text x={40} y={72} textAnchor="middle" fontSize={4} fill={c.primary} fontFamily="monospace">{Vendor?.split(" ")[0]}</text>
      </svg>
    );
  }