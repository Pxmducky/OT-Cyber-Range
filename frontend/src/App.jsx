import { useEffect, useState } from "react";

import {
  Activity,
  AlertTriangle,
  Cpu,
  Factory,
  Gauge,
  Network,
  Radio,
  Server,
  Shield,
  Terminal,
  Boxes,
  GitBranch,
} from "lucide-react";

import "./App.css";

import PhysicalPlant from "./components/PhysicalPlant";
import PurduePage from "./components/PurduePage";
import SIEMPage from "./components/SIEMPage";

const API_URL = "http://127.0.0.1:8000";


function App() {

  const [plant, setPlant] = useState(null);
  const [activePage, setActivePage] = useState("plant");
  const [connected, setConnected] = useState(false);


  /*
   * =========================================================
   * WEBSOCKET - PLANT STATE
   * =========================================================
   */

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


      socket.onmessage = (event) => {

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


      socket.onerror = (error) => {

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

      clearTimeout(
        reconnectTimer
      );

      if (socket) {

        socket.close();

      }

    };

  }, []);


  /*
   * =========================================================
   * CURRENT PLANT DATA
   * =========================================================
   */

  const process =
    plant?.process || null;


  const plc =
    plant?.plc || null;


  const events =
    plant?.events || [];


  const equipment =
    plant?.equipment || [];


  /*
   * =========================================================
   * APPLICATION
   * =========================================================
   */

  return (

    <div className="app">


      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="sidebar">


        {/* BRAND */}

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


        {/* OPERATIONS */}

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


        {/* SECURITY */}

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

        </div>


        {/* CONNECTION */}

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


      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="main">


        {/* ===================================================
            TOPBAR
        =================================================== */}

        <header className="topbar">

          <div>

            <div className="breadcrumb">

              OT CYBER RANGE /{" "}

              {activePage.toUpperCase()}

            </div>


            <h1>

              {activePage === "plant"
                ? "Production Line 01"
                : activePage === "inventory"
                  ? "OT Asset Inventory"
                  : activePage === "purdue"
                    ? "Purdue Architecture"
                    : activePage === "siem"
                      ? "Security Operations Center"
                      : activePage === "attacker"
                        ? "Attacker Workstation"
                        : activePage}

            </h1>

          </div>


          <div className="header-right">


            {/* NETWORK STATUS */}

            <div className="network-status">

              <span />

              OT NETWORK

              <strong>
                OPERATIONAL
              </strong>

            </div>


            {/* CLOCK */}

            <div className="system-time">

              {new Date().toLocaleTimeString(
                "en-GB"
              )}

            </div>

          </div>

        </header>


        {/* ===================================================
            PAGE CONTENT
        =================================================== */}


        {activePage === "plant" && (

          <PlantPage
            plant={plant}
            process={process}
            plc={plc}
            events={events}
            equipment={equipment}
          />

        )}


        {activePage === "inventory" && (

          <InventoryPage />

        )}


{activePage === "purdue" && (

<PurduePage
  equipment={equipment}
/>

)}


{activePage === "siem" && (
  <SIEMPage
    events={events}
    equipment={equipment}
    process={process}
  />
)}


        {activePage === "attacker" && (

          <PlaceholderPage
            page="attacker"
          />

        )}

      </main>

    </div>

  );

}


/*
 * ===========================================================
 * NAVIGATION BUTTON
 * ===========================================================
 */

function NavButton({
  icon,
  label,
  active,
  onClick
}) {

  return (

    <button
      className={
        active
          ? "nav-button active"
          : "nav-button"
      }
      onClick={onClick}
    >

      {icon}

      <span>
        {label}
      </span>

    </button>

  );

}


/*
 * ===========================================================
 * PLANT PAGE
 * ===========================================================
 */

function PlantPage({
  plant,
  process,
  plc,
  events,
  equipment
}) {


  if (!plant || !process || !plc) {

    return (

      <div className="loading">

        <Activity size={25} />

        Connecting to OT simulation...

      </div>

    );

  }


  return (

    <section className="content">


      {/* =====================================================
          PROCESS HEADER
      ===================================================== */}

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
            plant.plant.status === "RUNNING"
              ? "plant-status running"
              : "plant-status stopped"
          }
        >

          <span />

          <div>

            <strong>

              {plant.plant.status ===
              "RUNNING"
                ? "PRODUCTION RUNNING"
                : "PRODUCTION STOPPED"}

            </strong>

            <small>
              {plant.plant.line}
            </small>

          </div>

        </div>

      </div>


      {/* =====================================================
          KPI GRID
      ===================================================== */}

      <div className="kpi-grid">


        <KPI
          label="PRODUCTION"
          value={
            `${Number(
              process.production_rate ?? 0
            ).toFixed(0)}%`
          }
          status={
            process.production_rate > 80
              ? "NOMINAL"
              : "DEGRADED"
          }
          icon={<Activity />}
        />


        <KPI
          label="TEMPERATURE"
          value={
            `${Number(
              process.temperature ?? 0
            ).toFixed(1)}°C`
          }
          status="NORMAL"
          icon={<Gauge />}
        />


        <KPI
          label="PRESSURE"
          value={
            `${Number(
              process.pressure ?? 0
            ).toFixed(2)} bar`
          }
          status="NORMAL"
          icon={<Radio />}
        />


        <KPI
          label="MOTOR SPEED"
          value={
            `${Number(
              process.motor_speed ?? 0
            ).toFixed(0)} RPM`
          }
          status={
            process.motor_speed > 1000
              ? "NOMINAL"
              : "WARNING"
          }
          icon={<Cpu />}
        />

      </div>


      {/* =====================================================
          PHYSICAL PLANT
      ===================================================== */}

      <PhysicalPlant
       plant={plant}
       equipment={equipment}
       events={events}
       />


      {/* =====================================================
          LOWER GRID
      ===================================================== */}

      <div className="lower-grid">


        {/* ===================================================
            EVENTS
        =================================================== */}

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


        {/* ===================================================
            NETWORK
        =================================================== */}

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

  );

}


/*
 * ===========================================================
 * KPI
 * ===========================================================
 */

function KPI({
  label,
  value,
  status,
  icon
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


/*
 * ===========================================================
 * EVENT ROW
 * ===========================================================
 */

function EventRow({
  event
}) {

  const critical =
    event.severity === "CRITICAL";


  const high =
    event.severity === "HIGH";


  return (

    <div className="event-row">

      <div className="event-time">

        {event.timestamp
          ?.split("T")[1]
          ?.split(".")[0] || "--:--:--"}

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

        {critical || high
          ? (
            <AlertTriangle size={13} />
          )
          : (
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


/*
 * ===========================================================
 * NETWORK ROW
 * ===========================================================
 */

function NetworkRow({
  name,
  vlan,
  network
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


/*
 * ===========================================================
 * INVENTORY PAGE
 * ===========================================================
 */

function InventoryPage() {

  const [assets, setAssets] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);


  /*
   * GET INVENTORY
   */

  useEffect(() => {

    setLoading(true);


    fetch(
      `${API_URL}/api/inventory`
    )
      .then(response => {

        if (!response.ok) {

          throw new Error(
            `HTTP ${response.status}`
          );

        }

        return response.json();

      })
      .then(data => {

        setAssets(data);

      })
      .catch(error => {

        console.error(
          "Inventory error:",
          error
        );

      })
      .finally(() => {

        setLoading(false);

      });

  }, []);


  /*
   * FILTER
   */

  const filteredAssets =
    assets.filter(asset => {

      const value =
        search.toLowerCase();


      return (

        String(
          asset.asset_id || ""
        )
          .toLowerCase()
          .includes(value)

        ||

        String(
          asset.name || ""
        )
          .toLowerCase()
          .includes(value)

        ||

        String(
          asset.ip_address || ""
        )
          .toLowerCase()
          .includes(value)

        ||

        String(
          asset.type || ""
        )
          .toLowerCase()
          .includes(value)

        ||

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
        asset.status === "ONLINE"
    ).length;


  return (

    <section className="content">


      {/* =====================================================
          HEADER
      ===================================================== */}

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

              {assets.length}
              {" "}
              ASSETS DISCOVERED

            </strong>

            <small>
              OT Manufacturing Plant
            </small>

          </div>

        </div>

      </div>


      {/* =====================================================
          TOOLBAR
      ===================================================== */}

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


      {/* =====================================================
          TABLE
      ===================================================== */}

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

            <Activity
              size={22}
            />

            Loading OT inventory...

          </div>

        )}


        {!loading &&
          filteredAssets.length === 0 && (

            <div className="inventory-empty">

              No assets found.

            </div>

          )}


        {!loading &&
          filteredAssets.map(
            asset => (

              <div
                className="inventory-row"
                key={asset.asset_id}
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


/*
 * ===========================================================
 * PLACEHOLDER
 * ===========================================================
 */

function PlaceholderPage({
  page
}) {

  const titles = {

    purdue:
      "Purdue Architecture",

    siem:
      "Security Information & Event Management",

    attacker:
      "Attacker Workstation",

  };


  const descriptions = {

    purdue:
      "Industrial network segmentation and Purdue model visualization.",

    siem:
      "Security events, alerts, detection timeline and OT monitoring.",

    attacker:
      "Isolated Linux attacker workstation for simulated OT security scenarios.",

  };


  const icons = {

    purdue:
      <GitBranch size={40} />,

    siem:
      <Shield size={40} />,

    attacker:
      <Terminal size={40} />,

  };


  return (

    <div className="placeholder">

      {icons[page] || (
        <Server size={40} />
      )}


      <div className="eyebrow">
        MODULE
      </div>


      <h2>
        {titles[page] || page}
      </h2>


      <p>
        {descriptions[page] ||
          "Module connected to the OT Cyber Range engine."}
      </p>

    </div>

  );

}


export default App;


