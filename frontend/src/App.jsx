
import {
  useEffect,
  useState,
  useRef,
} from "react";

import {
  Activity,
  AlertTriangle,
  Cpu,
  Factory,
  Gauge,
  Network,
  Radio,
  Shield,
  ShieldCheck,
  Terminal,
  Boxes,
  GitBranch,
} from "lucide-react";

import "./App.css";

import ExcelImporter from "./components/ExcelImporter";
import DynamicPlant from "./components/DynamicPlant";
import PurduePage from "./components/PurduePage";
import SIEMPage from "./components/SIEMPage";
import AttackerConsole from "./components/AttackerConsole";
import RecoveryConsole from "./components/RecoveryConsole";

const API_URL = "http://127.0.0.1:8000";

function AlarmBanner({ alarms = [] }) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainRef = useRef(null);

  const activeAlarm = alarms.find(
    alarm =>
      alarm.active === true &&
      alarm.severity === "CRITICAL"
  );

  const startSiren = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

      const context = audioContextRef.current;

      gainRef.current = context.createGain();
      gainRef.current.gain.value = 0.35;
      gainRef.current.connect(context.destination);

      const lfo = context.createOscillator();
      const lfoGain = context.createGain();

      lfo.frequency.value = 0.8;
      lfoGain.gain.value = 280;

      lfo.connect(lfoGain);

      oscillatorRef.current = context.createOscillator();
      oscillatorRef.current.type = "sawtooth";
      oscillatorRef.current.frequency.value = 820;

      lfoGain.connect(
        oscillatorRef.current.frequency
      );

      oscillatorRef.current.connect(
        gainRef.current
      );

      lfo.start();
      oscillatorRef.current.start();
    }

    await audioContextRef.current.resume();

    setAudioEnabled(true);
  };

  const stopSiren = () => {
    if (
      gainRef.current &&
      audioContextRef.current
    ) {
      gainRef.current.gain.setTargetAtTime(
        0.0001,
        audioContextRef.current.currentTime,
        0.05
      );
    }
  };

  useEffect(() => {
    if (
      activeAlarm &&
      audioEnabled &&
      gainRef.current &&
      audioContextRef.current &&
      oscillatorRef.current
    ) {
      const context = audioContextRef.current;
      const gain = gainRef.current;
      const oscillator = oscillatorRef.current;

      gain.gain.setTargetAtTime(
        0.12,
        context.currentTime,
        0.03
      );

      oscillator.frequency.setValueAtTime(
        700,
        context.currentTime
      );

      oscillator.frequency.linearRampToValueAtTime(
        1100,
        context.currentTime + 0.45
      );

      oscillator.frequency.linearRampToValueAtTime(
        700,
        context.currentTime + 0.9
      );
    } else {
      stopSiren();
    }
  }, [activeAlarm, audioEnabled]);

  const acknowledgeAlarm = async () => {
    if (!activeAlarm) {
      return;
    }

    stopSiren();

    await fetch(
      `${API_URL}/api/alarms/acknowledge`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alarm_id: activeAlarm.alarm_id,
        }),
      }
    );
  };

  const resetAlarm = async () => {
    if (!activeAlarm) {
      return;
    }

    stopSiren();

    await fetch(
      `${API_URL}/api/alarms/reset`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alarm_id: activeAlarm.alarm_id,
        }),
      }
    );
  };

  if (!activeAlarm) {
    return (
      <div className="alarm-audio-control">
        {!audioEnabled && (
          <button
            onClick={startSiren}
            className="alarm-enable-button"
          >
            ENABLE ALARM AUDIO
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="critical-alarm-banner">
      <div className="critical-alarm-icon">
        <AlertTriangle size={28} />
      </div>

      <div className="critical-alarm-content">
        <strong>CRITICAL OT ALARM</strong>

        <span>
          {activeAlarm.source}
          {" — "}
          {activeAlarm.message}
        </span>

        <small>
          {activeAlarm.timestamp}
        </small>
      </div>

      <div className="critical-alarm-status">
        <span>
          {audioEnabled
            ? "🔊 SIREN ACTIVE"
            : "AUDIO DISABLED"}
        </span>

        <button onClick={startSiren}>
          ENABLE AUDIO
        </button>

        <button onClick={acknowledgeAlarm}>
          ACKNOWLEDGE
        </button>

        <button onClick={resetAlarm}>
          RESET
        </button>
      </div>
    </div>
  );
}

function App() {
  const [plant, setPlant] = useState(null);
  const [activePage, setActivePage] = useState("plant");
  const [connected, setConnected] = useState(false);
  const [labData, setLabData] = useState(null);
  const [showImporter, setShowImporter] = useState(false);
  const [alarms, setAlarms] = useState([]);

  useEffect(() => {
    let socket;
    let reconnectTimer;

    const connect = () => {
      socket = new WebSocket(
        "ws://127.0.0.1:8000/ws/plant"
      );

      socket.onopen = () => {
        console.log(
          "Connected to OT simulation"
        );

        setConnected(true);
      };

      socket.onmessage = event => {
        try {
          const data = JSON.parse(
            event.data
          );

          setPlant(data);
        } catch (error) {
          console.error(
            "WebSocket data error:",
            error
          );
        }
      };

      socket.onerror = error => {
        console.error(
          "WebSocket error:",
          error
        );
      };

      socket.onclose = () => {
        setConnected(false);

        reconnectTimer = setTimeout(
          connect,
          2000
        );
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);

      if (socket) {
        socket.close();
      }
    };
  }, []);

  useEffect(() => {
    const loadAlarms = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/alarms`
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        setAlarms(
          data.alarms || []
        );
      } catch (error) {
        console.error(
          "Alarm API error:",
          error
        );
      }
    };

    loadAlarms();

    const interval = setInterval(
      loadAlarms,
      500
    );

    return () => {
      clearInterval(interval);
    };
  }, []);

  const process =
    plant?.process || null;

  const plc =
    plant?.plc || null;

  const events =
    plant?.events || [];

  const equipment =
    plant?.equipment || [];

  const importedAssets =
    labData?.assets || [];

  const importedConnections =
    labData?.connections || [];

  const hasCriticalAlarm =
    alarms.some(
      alarm =>
        alarm.active === true &&
        alarm.severity === "CRITICAL"
    );

  return (
    <div
      className={
        hasCriticalAlarm
          ? "app cyber-incident"
          : "app"
      }
    >
      {hasCriticalAlarm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 9998,
            animation:
              "cyber-flash 0.9s ease-in-out infinite",
            border:
              "3px solid rgba(239,68,68,0.8)",
            boxShadow:
              "inset 0 0 60px rgba(239,68,68,0.15)",
          }}
        />
      )}

      <AlarmBanner alarms={alarms} />

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            OT
          </div>

          <div>
            <div className="brand-title">
              CYBER RANGE
            </div>

            <div className="brand-subtitle">
              Industrial Security Lab
            </div>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-label">
            OPERATIONS
          </div>

          <NavButton
            icon={<Factory size={17} />}
            label="Plant"
            active={
              activePage === "plant"
            }
            onClick={() =>
              setActivePage("plant")
            }
          />

          <NavButton
            icon={<GitBranch size={17} />}
            label="Purdue"
            active={
              activePage === "purdue"
            }
            onClick={() =>
              setActivePage("purdue")
            }
          />

          <NavButton
            icon={<Boxes size={17} />}
            label="Inventory"
            active={
              activePage === "inventory"
            }
            onClick={() =>
              setActivePage("inventory")
            }
          />
        </div>

        <div className="nav-section">
          <div className="nav-label">
            SECURITY
          </div>

          <NavButton
            icon={<Shield size={17} />}
            label="SIEM"
            active={
              activePage === "siem"
            }
            onClick={() =>
              setActivePage("siem")
            }
          />

          <NavButton
            icon={<Terminal size={17} />}
            label="Attacker"
            active={
              activePage === "attacker"
            }
            onClick={() =>
              setActivePage("attacker")
            }
          />

          <NavButton
            icon={<ShieldCheck size={17} />}
            label="Recovery"
            active={
              activePage === "recovery"
            }
            badge={
              alarms.some(
                alarm =>
                  alarm.active &&
                  alarm.severity ===
                    "CRITICAL"
              )
                ? alarms.filter(
                    alarm =>
                      alarm.active &&
                      alarm.severity ===
                        "CRITICAL"
                  ).length
                : null
            }
            onClick={() =>
              setActivePage("recovery")
            }
          />
        </div>

        <div className="sidebar-bottom">
          <div
            className={
              connected
                ? "connection online"
                : "connection"
            }
          >
            <span className="connection-dot" />

            <div>
              <strong>
                {connected
                  ? "BACKEND ONLINE"
                  : "CONNECTING..."}
              </strong>

              <small>
                OT simulation engine
              </small>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              OT CYBER RANGE /{" "}
              {activePage.toUpperCase()}
            </div>

            <h1>
              {activePage === "plant"
                ? "Production Line 01"
                : activePage ===
                    "inventory"
                  ? "OT Asset Inventory"
                  : activePage ===
                      "purdue"
                    ? "Purdue Architecture"
                    : activePage ===
                        "siem"
                      ? "Security Operations Center"
                      : activePage ===
                          "attacker"
                        ? "Attacker Workstation"
                        : activePage ===
                            "recovery"
                          ? "Incident Response"
                          : activePage}
            </h1>
          </div>

          <div className="header-right">
            <div className="network-status">
              <span />
              OT NETWORK
              <strong>
                OPERATIONAL
              </strong>
            </div>

            <div className="system-time">
              {new Date().toLocaleTimeString(
                "en-GB"
              )}
            </div>
          </div>
        </header>

        {activePage === "plant" && (
          <section className="content">
            <div className="process-heading">
              <div>
                <div className="eyebrow">
                  INDUSTRIAL PROCESS
                </div>

                <h2>
                  Manufacturing Cell A
                </h2>
              </div>

              <div
                className={
                  plant?.plant?.status ===
                  "RUNNING"
                    ? "plant-status running"
                    : "plant-status stopped"
                }
              >
                <span />

                <div>
                  <strong>
                    {plant?.plant?.status ===
                    "RUNNING"
                      ? "PRODUCTION RUNNING"
                      : "PRODUCTION STOPPED"}
                  </strong>

                  <small>
                    {plant?.plant?.line ||
                      "Production Line 01"}
                  </small>
                </div>
              </div>
            </div>

            <div className="kpi-grid">
              <KPI
                label="PRODUCTION"
                value={`${Number(
                  process?.production_rate ??
                    0
                ).toFixed(0)}%`}
                status={
                  process?.production_rate >
                  80
                    ? "NOMINAL"
                    : "DEGRADED"
                }
                icon={<Activity />}
              />

              <KPI
                label="TEMPERATURE"
                value={`${Number(
                  process?.temperature ??
                    0
                ).toFixed(1)}°C`}
                status="NORMAL"
                icon={<Gauge />}
              />

              <KPI
                label="PRESSURE"
                value={`${Number(
                  process?.pressure ??
                    0
                ).toFixed(2)} bar`}
                status="NORMAL"
                icon={<Radio />}
              />

              <KPI
                label="MOTOR SPEED"
                value={`${Number(
                  process?.motor_speed ??
                    0
                ).toFixed(0)} RPM`}
                status={
                  process?.motor_speed >
                  1000
                    ? "NOMINAL"
                    : "WARNING"
                }
                icon={<Cpu />}
              />
            </div>

            <DynamicPlant
              assets={
                importedAssets.length > 0
                  ? importedAssets
                  : equipment
              }
              connections={
                importedConnections
              }
              events={events}
              alarms={
                plant?.alarms?.active ??
                []
              }
              labData={labData}
            />

            <div
              style={{
                marginTop: "20px",
              }}
            >
              <button
                onClick={() =>
                  setShowImporter(true)
                }
              >
                📂 Importar Excel
              </button>
            </div>

            {showImporter && (
              <ExcelImporter
                onImport={data => {
                  console.log(
                    "Excel imported:",
                    data
                  );

                  setLabData(data);
                  setShowImporter(false);
                }}
                onClose={() =>
                  setShowImporter(false)
                }
              />
            )}

            <div className="lower-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">
                      SECURITY
                    </div>

                    <h3>
                      Recent Events
                    </h3>
                  </div>

                  <div className="event-count">
                    {events.length} EVENTS
                  </div>
                </div>

                <div className="events">
                  {events
                    .slice()
                    .reverse()
                    .slice(0, 6)
                    .map(
                      (event, index) => (
                        <EventRow
                          key={index}
                          event={event}
                        />
                      )
                    )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">
                      NETWORK
                    </div>

                    <h3>
                      OT Communications
                    </h3>
                  </div>
                </div>

                <NetworkRow
                  name="PLC Network"
                  vlan="VLAN 440"
                  network="OT-PLC"
                />

                <NetworkRow
                  name="HMI Network"
                  vlan="VLAN 902"
                  network="OT-HMI"
                />

                <NetworkRow
                  name="Gateway"
                  vlan="VLAN 903"
                  network="OT-GATEWAY"
                />

                <NetworkRow
                  name="OT Servers"
                  vlan="VLAN 904"
                  network="OT-SERVERS"
                />
              </div>
            </div>
          </section>
        )}

        {activePage === "purdue" && (
          <PurduePage
            equipment={equipment}
          />
        )}

        {activePage === "inventory" && (
          <InventoryPage />
        )}

        {activePage === "siem" && (
          <SIEMPage
            events={events}
            equipment={equipment}
            process={process}
          />
        )}

        {activePage === "attacker" && (
          <AttackerConsole
            plant={plant}
            alarms={
              plant?.alarms?.active ??
              []
            }
          />
        )}

        {activePage === "recovery" && (
          <RecoveryConsole
            plant={plant}
            alarms={
              plant?.alarms?.active ??
              []
            }
            equipment={equipment}
          />
        )}
      </main>
    </div>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick,
  badge = null,
}) {
  return (
    <button
      className={
        active
          ? "nav-button active"
          : "nav-button"
      }
      onClick={onClick}
      style={{
        position: "relative",
      }}
    >
      {icon}

      <span>
        {label}
      </span>

      {badge !== null &&
        badge > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: "#ef4444",
              color: "white",
              fontSize: 9,
              fontWeight: 700,
              fontFamily: "monospace",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              animation:
                "pulse-badge 1.2s ease-in-out infinite",
            }}
          >
            {badge > 9
              ? "9+"
              : badge}
          </span>
        )}
    </button>
  );
}

function KPI({
  label,
  value,
  status,
  icon,
}) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span>
          {label}
        </span>

        <div className="kpi-icon">
          {icon}
        </div>
      </div>

      <strong>
        {value}
      </strong>

      <small>
        ● {status}
      </small>
    </div>
  );
}

function EventRow({ event }) {
  const critical =
    event.severity ===
    "CRITICAL";

  const high =
    event.severity === "HIGH";

  return (
    <div className="event-row">
      <div className="event-time">
        {event.timestamp
          ?.split("T")[1]
          ?.split(".")[0] ||
          "--:--:--"}
      </div>

      <div
        className={
          critical
            ? "event-icon critical"
            : high
              ? "event-icon high"
              : "event-icon"
        }
      >
        {critical || high ? (
          <AlertTriangle
            size={13}
          />
        ) : (
          <Activity size={13} />
        )}
      </div>

      <div className="event-content">
        <strong>
          {event.event_type}
        </strong>

        <span>
          {event.message}
        </span>
      </div>

      <div className="event-source">
        {event.source}
      </div>
    </div>
  );
}

function NetworkRow({
  name,
  vlan,
  network,
}) {
  return (
    <div className="network-row">
      <div className="network-name">
        <Network size={15} />

        <div>
          <strong>
            {name}
          </strong>

          <small>
            {network}
          </small>
        </div>
      </div>

      <strong className="vlan">
        {vlan}
      </strong>

      <span className="network-online">
        ● ONLINE
      </span>
    </div>
  );
}

function InventoryPage() {
  const [assets, setAssets] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const loadInventory =
      async () => {
        try {
          setLoading(true);

          const response =
            await fetch(
              `${API_URL}/api/inventory`
            );

          if (!response.ok) {
            throw new Error(
              `HTTP ${response.status}`
            );
          }

          const data =
            await response.json();

          setAssets(data);
        } catch (error) {
          console.error(
            "Inventory error:",
            error
          );
        } finally {
          setLoading(false);
        }
      };

    loadInventory();
  }, []);

  const filteredAssets =
    assets.filter(asset => {
      const value =
        search.toLowerCase();

      return (
        String(
          asset.asset_id || ""
        )
          .toLowerCase()
          .includes(value) ||
        String(
          asset.name || ""
        )
          .toLowerCase()
          .includes(value) ||
        String(
          asset.ip_address || ""
        )
          .toLowerCase()
          .includes(value) ||
        String(
          asset.type || ""
        )
          .toLowerCase()
          .includes(value) ||
        String(
          asset.network || ""
        )
          .toLowerCase()
          .includes(value)
      );
    });

  const onlineAssets =
    assets.filter(
      asset =>
        asset.status ===
        "ONLINE"
    ).length;

  return (
    <section className="content">
      <div className="process-heading">
        <div>
          <div className="eyebrow">
            ASSET MANAGEMENT
          </div>

          <h2>
            OT Asset Inventory
          </h2>
        </div>

        <div className="plant-status running">
          <span />

          <div>
            <strong>
              {assets.length} ASSETS
              DISCOVERED
            </strong>

            <small>
              OT Manufacturing Plant
            </small>
          </div>
        </div>
      </div>

      <div className="inventory-toolbar">
        <input
          type="text"
          placeholder="Search asset, IP, type..."
          value={search}
          onChange={event =>
            setSearch(
              event.target.value
            )
          }
        />

        <div className="inventory-summary">
          <span>
            TOTAL
          </span>

          <strong>
            {assets.length}
          </strong>
        </div>

        <div className="inventory-summary">
          <span>
            ONLINE
          </span>

          <strong>
            {onlineAssets}
          </strong>
        </div>

        <div className="inventory-summary">
          <span>
            DISPLAYED
          </span>

          <strong>
            {filteredAssets.length}
          </strong>
        </div>
      </div>

      <div className="panel inventory-panel">
        <div className="inventory-table-header">
          <span>
            ASSET
          </span>

          <span>
            TYPE
          </span>

          <span>
            IP ADDRESS
          </span>

          <span>
            VLAN
          </span>

          <span>
            NETWORK
          </span>

          <span>
            STATUS
          </span>
        </div>

        {loading && (
          <div className="inventory-empty">
            <Activity size={22} />
            Loading OT inventory...
          </div>
        )}

        {!loading &&
          filteredAssets.length ===
            0 && (
            <div className="inventory-empty">
              No assets found.
            </div>
          )}

        {!loading &&
          filteredAssets.map(
            asset => (
              <div
                className="inventory-row"
                key={
                  asset.asset_id
                }
              >
                <div>
                  <strong>
                    {asset.asset_id}
                  </strong>

                  <small>
                    {asset.name}
                  </small>
                </div>

                <span className="asset-type">
                  {asset.type}
                </span>

                <span className="asset-ip">
                  {asset.ip_address}
                </span>

                <span className="asset-vlan">
                  {asset.vlan}
                </span>

                <span className="asset-network">
                  {asset.network}
                </span>

                <span className="asset-status">
                  <i />
                  {asset.status}
                </span>
              </div>
            )
          )}
      </div>
    </section>
  );
}

export default App;
