import React from "react";
import {
  ArrowLeft,
  Cpu,
  Monitor,
  Network,
  Activity,
  Factory,
  Settings,
  Gauge,
  Thermometer,
  Droplets,
  Power,
  CheckCircle2,
  AlertTriangle,
  Server,
  Radio,
  RotateCw,
  Cable,
  Wifi,
  Database,
} from "lucide-react";


/* =========================================================
   COMMON
========================================================= */

function StatusBadge({ status = "ONLINE" }) {
  const normalized = String(status).toUpperCase();

  const label =
    normalized === "COMPROMISED"
      ? "COMPROMISED"
      : normalized === "WARNING"
      ? "WARNING"
      : normalized === "OFFLINE"
      ? "OFFLINE"
      : "ONLINE";

  return (
    <span className={`industrial-status ${normalized.toLowerCase()}`}>
      <span />
      {label}
    </span>
  );
}


function EquipmentHeader({ asset, onBack }) {
  return (
    <div className="industrial-header">

      <button
        type="button"
        className="industrial-back"
        onClick={onBack}
      >
        <ArrowLeft size={17} />
        BACK TO PLANT
      </button>

      <div className="industrial-header-title">

        <div className="industrial-device-icon">
          {asset?.asset_id === "PLC-001" && <Cpu />}
          {asset?.asset_id === "HMI-001" && <Monitor />}
          {asset?.asset_id === "SCADA-001" && <Database />}
          {asset?.asset_id === "GW-001" && <Network />}
          {asset?.asset_id === "ENG-001" && <Settings />}
          {asset?.asset_id === "CNC-001" && <Factory />}
          {asset?.asset_id === "M-001" && <RotateCw />}
          {asset?.asset_id === "TT-001" && <Thermometer />}
          {asset?.asset_id === "PT-001" && <Gauge />}
          {asset?.asset_id === "V-001" && <Settings />}
        </div>

        <div>
          <strong>{asset?.asset_id}</strong>
          <span>{asset?.name}</span>
        </div>

      </div>

      <StatusBadge status={asset?.status} />

    </div>
  );
}


function IndustrialPanel({ title, children, className = "" }) {
  return (
    <section className={`industrial-panel ${className}`}>

      <div className="industrial-panel-title">
        <span>{title}</span>
      </div>

      <div className="industrial-panel-body">
        {children}
      </div>

    </section>
  );
}


function ValueRow({ label, value, unit = "" }) {
  return (
    <div className="industrial-value-row">
      <span>{label}</span>
      <strong>
        {value ?? "--"} {unit}
      </strong>
    </div>
  );
}


/* =========================================================
   PLC
========================================================= */


function PLCInterface({ asset, plant, process }) {

  const plc = plant?.plc;

  const temperature =
    plc?.registers?.temperature ??
    process?.temperature ??
    68.4;

  const pressure =
    plc?.registers?.pressure ??
    process?.pressure ??
    3.8;

  const motorSpeed =
    plc?.registers?.motor_speed ??
    process?.motor_speed ??
    1450;

  const valve =
    plc?.registers?.valve_position ??
    process?.valve_position ??
    50;

  const cpuState = plc?.cpu_state || "RUN";

  const [commandStatus, setCommandStatus] =
    React.useState("");

  const [commandError, setCommandError] =
    React.useState("");

  const sendPLCCommand = async (command) => {

    setCommandStatus(
      `SENDING ${command}...`
    );

    setCommandError("");

    let endpoint;

    switch (command) {

      case "RUN":
        endpoint =
          "http://127.0.0.1:8000/api/plc/run";
        break;

      case "STOP":
        endpoint =
          "http://127.0.0.1:8000/api/plc/stop";
        break;

      case "RESET":
        endpoint =
          "http://127.0.0.1:8000/api/plc/reset";
        break;

      default:
        return;
    }

    try {

      const response =
        await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
        });

      if (!response.ok) {

        throw new Error(
          `HTTP ${response.status}`
        );

      }

      await response.json();

      setCommandStatus(
        `${command} COMMAND SENT`
      );

      setTimeout(() => {
        setCommandStatus("");
      }, 2500);

    } catch (error) {

      console.error(
        "PLC command error:",
        error
      );

      setCommandStatus("");

      setCommandError(
        `COMMAND FAILED: ${error.message}`
      );

    }
  };

  const inputs = plc?.inputs || {
    "I0.0": true,
    "I0.1": true,
    "I0.2": false,
    "I0.3": true,
    "I0.4": false,
    "I0.5": true,
  };

  const outputs = plc?.outputs || {
    "Q0.0": true,
    "Q0.1": true,
    "Q0.2": true,
    "Q0.3": false,
    "Q0.4": false,
    "Q0.5": true,
  };

  return (

    <div className="plc-interface">

      <div className="plc-top-strip">
        SIMATIC S7-1500
        <span>
          {cpuState === "RUN"
            ? "ONLINE"
            : "STOP"}
        </span>
      </div>


      {/* PLC HARDWARE */}

      <IndustrialPanel
        title="CPU / CONTROLLER"
        className="plc-hardware"
      >

        <div className="plc-rack">

          <div className="plc-module cpu-module">

            <div className="module-brand">
              SIEMENS
            </div>

            <div className="module-model">
              CPU 1516-3 PN/DP
            </div>

            <div className="cpu-display">
              {cpuState}
            </div>

            <div className="led-stack">

              <div>
                <i
                  className={
                    cpuState === "RUN"
                      ? "led-green"
                      : "led-off"
                  }
                />
                RUN
              </div>

              <div>
                <i
                  className={
                    cpuState === "STOP"
                      ? "led-red"
                      : "led-off"
                  }
                />
                STOP
              </div>

              <div>
                <i className="led-green" />
                LINK
              </div>

              <div>
                <i className="led-off" />
                ERROR
              </div>

            </div>

            <div className="ethernet-port">
              PN
            </div>

          </div>


          <div className="plc-module io-module">

            <div className="module-title">
              DI 16x24VDC
            </div>

            <div className="module-led-grid">

              {Object.entries(inputs).map(
                ([name, active]) => (

                  <div key={name}>

                    <i
                      className={
                        active
                          ? "led-green"
                          : "led-off"
                      }
                    />

                    <span>
                      {name}
                    </span>

                  </div>

                )
              )}

            </div>

          </div>


          <div className="plc-module io-module">

            <div className="module-title">
              DO 16x24VDC
            </div>

            <div className="module-led-grid">

              {Object.entries(outputs).map(
                ([name, active]) => (

                  <div key={name}>

                    <i
                      className={
                        active
                          ? "led-green"
                          : "led-off"
                      }
                    />

                    <span>
                      {name}
                    </span>

                  </div>

                )
              )}

            </div>

          </div>

        </div>

      </IndustrialPanel>


      <div className="plc-grid">


        {/* CPU DIAGNOSTICS */}

        <IndustrialPanel title="CPU DIAGNOSTICS">

          <div className="plc-state">

            <div className="big-led">

              <i
                className={
                  cpuState === "RUN"
                    ? "led-green"
                    : "led-red"
                }
              />

            </div>

            <div>

              <span>
                OPERATING STATE
              </span>

              <strong>
                {cpuState}
              </strong>

            </div>

          </div>


          <ValueRow
            label="Order Number"
            value="6ES7 516-3AN02-0AB0"
          />

          <ValueRow
            label="Firmware"
            value="V2.9"
          />

          <ValueRow
            label="Cycle Time"
            value="4.8"
            unit="ms"
          />

          <ValueRow
            label="Communication"
            value="OK"
          />

        </IndustrialPanel>


        {/* PROCESS IMAGE */}

        <IndustrialPanel title="PROCESS IMAGE / TAGS">

          <ValueRow
            label="Temperature"
            value={Number(
              temperature
            ).toFixed(1)}
            unit="°C"
          />

          <ValueRow
            label="Pressure"
            value={Number(
              pressure
            ).toFixed(2)}
            unit="bar"
          />

          <ValueRow
            label="Motor Speed"
            value={Number(
              motorSpeed
            ).toFixed(0)}
            unit="RPM"
          />

          <ValueRow
            label="Valve Position"
            value={Number(
              valve
            ).toFixed(0)}
            unit="%"
          />

        </IndustrialPanel>


        {/* NETWORK */}

        <IndustrialPanel title="PROFINET / NETWORK">

          <ValueRow
            label="IP Address"
            value={asset?.ip_address}
          />

          <ValueRow
            label="VLAN"
            value={asset?.vlan}
          />

          <ValueRow
            label="Network"
            value={asset?.network}
          />

          <ValueRow
            label="Protocol"
            value="PROFINET / TCP"
          />

          <ValueRow
            label="Connection"
            value="CONNECTED"
          />

        </IndustrialPanel>


        {/* DIAGNOSTICS */}

        <IndustrialPanel title="DIAGNOSTIC BUFFER">

          <div className="diagnostic-line">

            <span className="diag-time">
              13:42:07
            </span>

            <span>
              CPU cycle completed
            </span>

          </div>

          <div className="diagnostic-line">

            <span className="diag-time">
              13:42:06
            </span>

            <span>
              I/O update completed
            </span>

          </div>

          <div className="diagnostic-line">

            <span className="diag-time">
              13:42:05
            </span>

            <span>
              Communication OK
            </span>

          </div>

        </IndustrialPanel>


        {/* PLC OPERATOR CONTROL */}

        <IndustrialPanel
          title="PLC OPERATOR CONTROL"
        >

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "10px",
            }}
          >

            <button
              type="button"
              className="hmi-green"
              onClick={() =>
                sendPLCCommand("RUN")
              }
              disabled={cpuState === "RUN"}
            >
              RUN
            </button>


            <button
              type="button"
              className="hmi-red"
              onClick={() =>
                sendPLCCommand("STOP")
              }
              disabled={cpuState === "STOP"}
            >
              STOP
            </button>


            <button
              type="button"
              onClick={() =>
                sendPLCCommand("RESET")
              }
            >
              RESET
            </button>

          </div>


          {(commandStatus ||
            commandError) && (

            <div
              style={{
                marginTop: "8px",
                padding: "8px 10px",
                fontSize: "11px",
                fontFamily: "monospace",
                border:
                  "1px solid rgba(255,255,255,0.15)",
                background:
                  "rgba(0,0,0,0.25)",
              }}
            >

              {commandError
                ? commandError
                : commandStatus}

            </div>

          )}

        </IndustrialPanel>

      </div>

    </div>
  );
}



/* =========================================================
   HMI
========================================================= */


function HMIInterface({ asset, process }) {

  const temperature =
    process?.temperature ?? 68.4;

  const pressure =
    process?.pressure ?? 3.8;

  const motorSpeed =
    process?.motor_speed ?? 1450;

  const valve =
    process?.valve_position ?? 50;

  const running =
    process?.production_running !== false;

  const [commandStatus, setCommandStatus] =
    React.useState("");

  const [commandError, setCommandError] =
    React.useState("");


  /*
   * =========================================================
   * HMI COMMANDS
   * =========================================================
   */

  const sendCommand = async (command) => {

    setCommandStatus(
      `SENDING ${command}...`
    );

    setCommandError("");

    let endpoint;

    switch (command) {

      case "START":
        endpoint =
          "http://127.0.0.1:8000/api/hmi/start";
        break;

      case "STOP":
        endpoint =
          "http://127.0.0.1:8000/api/hmi/stop";
        break;

      case "RESET":
        endpoint =
          "http://127.0.0.1:8000/api/hmi/reset";
        break;

      default:
        return;
    }


    try {

      const response =
        await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
        });


      if (!response.ok) {

        throw new Error(
          `HTTP ${response.status}`
        );

      }


      await response.json();


      setCommandStatus(
        `${command} COMMAND SENT`
      );


      /*
       * Quitamos el mensaje después de unos segundos
       */

      setTimeout(() => {

        setCommandStatus("");

      }, 2500);


    } catch (error) {

      console.error(
        "HMI command error:",
        error
      );


      setCommandStatus("");


      setCommandError(
        `COMMAND FAILED: ${error.message}`
      );

    }

  };


  return (

    <div className="hmi-interface">

      <div className="hmi-bezel">


        <div className="hmi-brand">
          SIEMENS
        </div>


        <div className="hmi-model">
          SIMATIC HMI
        </div>


        {/* =================================================
            SCREEN
        ================================================= */}

        <div className="hmi-screen-real">


          {/* HEADER */}

          <div className="hmi-screen-header">

            <strong>
              PRODUCTION LINE 01
            </strong>

            <span>
              {new Date().toLocaleTimeString(
                "en-GB"
              )}
            </span>

          </div>


          {/* STATUS */}

          <div className="hmi-status-bar">

            <span>
              MAIN SCREEN
            </span>


            <strong
              className={
                running
                  ? "hmi-run"
                  : "hmi-stop"
              }
            >

              {running
                ? "RUNNING"
                : "STOPPED"}

            </strong>

          </div>


          {/* =================================================
              PROCESS DIAGRAM
          ================================================= */}

          <div className="hmi-process-diagram">


            <div className="hmi-tank">

              <div
                className="tank-liquid"
                style={{
                  height:
                    `${running ? 72 : 72}%`
                }}
              />

              <span>
                PROCESS
              </span>

              <strong>
                72%
              </strong>

            </div>


            <div className="hmi-pipe horizontal" />


            <div className="hmi-pump">

              <div
                className={
                  running
                    ? "pump-circle"
                    : "pump-circle stopped"
                }
              >

                <RotateCw
                  size={24}
                />

              </div>

              <span>
                P-01
              </span>

            </div>


            <div className="hmi-pipe horizontal" />


            <div
              className={
                running
                  ? "hmi-machine"
                  : "hmi-machine stopped"
              }
            >

              <Factory
                size={32}
              />

              <span>
                MACHINE
              </span>

            </div>


            <div className="hmi-valve-symbol">

              <span>
                V-01
              </span>

              <div className="valve-shape">
                ◆
              </div>

              <strong>
                {Number(valve).toFixed(0)}%
              </strong>

            </div>

          </div>


          {/* =================================================
              PROCESS VALUES
          ================================================= */}

          <div className="hmi-values">


            <div>

              <span>
                TEMP
              </span>

              <strong>
                {Number(
                  temperature
                ).toFixed(1)}
              </strong>

              <small>
                °C
              </small>

            </div>


            <div>

              <span>
                PRESS
              </span>

              <strong>
                {Number(
                  pressure
                ).toFixed(2)}
              </strong>

              <small>
                bar
              </small>

            </div>


            <div>

              <span>
                SPEED
              </span>

              <strong>
                {Number(
                  motorSpeed
                ).toFixed(0)}
              </strong>

              <small>
                RPM
              </small>

            </div>


            <div>

              <span>
                VALVE
              </span>

              <strong>
                {Number(
                  valve
                ).toFixed(0)}
              </strong>

              <small>
                %
              </small>

            </div>

          </div>


          {/* =================================================
              ALARM
          ================================================= */}

          <div className="hmi-alarm">

            <AlertTriangle
              size={16}
            />

            <span>
              ALARM STATUS
            </span>

            <strong>

              {running
                ? "NO ACTIVE ALARMS"
                : "PROCESS STOPPED"}

            </strong>

          </div>


          {/* =================================================
              COMMAND STATUS
          ================================================= */}

          {(commandStatus ||
            commandError) && (

            <div
              style={{
                marginTop: "8px",
                padding: "6px 10px",
                fontSize: "11px",
                fontFamily:
                  "monospace",
                border:
                  "1px solid rgba(255,255,255,0.15)",
                background:
                  "rgba(0,0,0,0.25)",
              }}
            >

              {commandError
                ? commandError
                : commandStatus}

            </div>

          )}


          {/* =================================================
              OPERATOR BUTTONS
          ================================================= */}

          <div className="hmi-buttons">


            <button
              type="button"
              className="hmi-green"
              onClick={() =>
                sendCommand("START")
              }
              disabled={running}
            >

              START

            </button>


            <button
              type="button"
              className="hmi-red"
              onClick={() =>
                sendCommand("STOP")
              }
              disabled={!running}
            >

              STOP

            </button>


            <button
              type="button"
              onClick={() =>
                sendCommand("RESET")
              }
            >

              RESET

            </button>


            <button
              type="button"
              onClick={() => {

                setCommandStatus(
                  "MANUAL MODE NOT AVAILABLE"
                );

                setTimeout(() => {

                  setCommandStatus("");

                }, 2500);

              }}
            >

              MANUAL

            </button>


          </div>


        </div>


        {/* =================================================
            PHYSICAL HMI BUTTONS
        ================================================= */}

        <div className="hmi-physical-buttons">

          <button type="button">
            F1
          </button>

          <button type="button">
            F2
          </button>

          <button type="button">
            F3
          </button>

          <button type="button">
            F4
          </button>

          <button type="button">
            F5
          </button>

          <button type="button">
            F6
          </button>

        </div>


        <div className="hmi-bottom-label">
          6AV2 124-0MC01-0AX0
        </div>


      </div>


      {/* =================================================
          HMI INFORMATION
      ================================================= */}

      <div className="hmi-info">


        <IndustrialPanel
          title="HMI COMMUNICATION"
        >

          <ValueRow
            label="IP Address"
            value={asset?.ip_address}
          />

          <ValueRow
            label="VLAN"
            value={asset?.vlan}
          />

          <ValueRow
            label="Connection"
            value="PLC-001"
          />

          <ValueRow
            label="Protocol"
            value="PROFINET"
          />

        </IndustrialPanel>


        <IndustrialPanel
          title="OPERATOR SESSION"
        >

          <ValueRow
            label="User"
            value="OPERATOR-01"
          />

          <ValueRow
            label="Access Level"
            value="OPERATOR"
          />

          <ValueRow
            label="Mode"
            value="AUTO"
          />

        </IndustrialPanel>


      </div>


    </div>

  );
}


/* =========================================================
   SCADA
========================================================= */

function SCADAInterface({ asset, process, events = [] }) {

  const temperature = process?.temperature ?? 68.4;
  const pressure = process?.pressure ?? 3.8;
  const rpm = process?.motor_speed ?? 1450;

  return (

    <div className="classic-interface">

      <IndustrialPanel title="SCADA SUPERVISORY CONTROL">

        <div className="scada-process">

          <div>
            <span>TT-001</span>
            <strong>{Number(temperature).toFixed(1)} °C</strong>
          </div>

          <div>
            <span>PT-001</span>
            <strong>{Number(pressure).toFixed(2)} bar</strong>
          </div>

          <div>
            <span>M-001</span>
            <strong>{Number(rpm).toFixed(0)} RPM</strong>
          </div>

        </div>

      </IndustrialPanel>

      <IndustrialPanel title="ALARM / EVENT LIST">

        {events.length === 0 ? (
          <div className="empty-industrial">
            <CheckCircle2 size={18} />
            NO ACTIVE ALARMS
          </div>
        ) : (
          events.slice(0, 8).map((event, index) => (
            <div className="diagnostic-line" key={index}>
              <span>{event?.severity || "INFO"}</span>
              <span>{event?.message || "System event"}</span>
            </div>
          ))
        )}

      </IndustrialPanel>

      <IndustrialPanel title="SERVER INFORMATION">

        <ValueRow label="Server" value={asset?.name} />
        <ValueRow label="IP Address" value={asset?.ip_address} />
        <ValueRow label="VLAN" value={asset?.vlan} />
        <ValueRow label="Historian" value="CONNECTED" />
        <ValueRow label="OPC" value="CONNECTED" />

      </IndustrialPanel>

    </div>
  );
}


/* =========================================================
   GATEWAY
========================================================= */

function GatewayInterface({ asset }) {

  return (

    <div className="classic-interface">

      <IndustrialPanel title="eWON FLEXY / REMOTE GATEWAY">

        <div className="gateway-real-status">

          <div className="gateway-icon">
            <Wifi size={42} />
          </div>

          <div>
            <span>REMOTE CONNECTION</span>
            <strong>CONNECTED</strong>
          </div>

        </div>

      </IndustrialPanel>

      <div className="interface-grid-2">

        <IndustrialPanel title="WAN">

          <ValueRow label="Connection" value="CONNECTED" />
          <ValueRow label="VPN" value="ACTIVE" />
          <ValueRow label="Signal" value="92%" />

        </IndustrialPanel>

        <IndustrialPanel title="LAN / OT">

          <ValueRow label="IP Address" value={asset?.ip_address} />
          <ValueRow label="VLAN" value={asset?.vlan} />
          <ValueRow label="Network" value={asset?.network} />

        </IndustrialPanel>

      </div>

    </div>
  );
}


/* =========================================================
   ENGINEERING
========================================================= */

function EngineeringInterface({ asset }) {

  return (

    <div className="engineering-interface">

      <div className="engineering-bar">
        TIA PORTAL
        <span>ONLINE</span>
      </div>

      <div className="engineering-body">

        <aside>

          <strong>PROJECT TREE</strong>

          <p>▾ Production_Line_01</p>
          <p>　▾ PLC_01</p>
          <p>　　CPU 1516</p>
          <p>　　Program Blocks</p>
          <p>　　　OB1</p>
          <p>　　　DB_Process</p>
          <p>　　Technology Objects</p>

        </aside>

        <main>

          <div className="engineering-monitor">

            <span>ONLINE MONITORING</span>

            <div>
              MOTOR_SPEED := {1450};
            </div>

            <div>
              VALVE_POSITION := {50};
            </div>

            <div>
              PROCESS_STATUS := RUNNING;
            </div>

          </div>

        </main>

      </div>

      <IndustrialPanel title="ENGINEERING STATION">

        <ValueRow label="IP Address" value={asset?.ip_address} />
        <ValueRow label="VLAN" value={asset?.vlan} />
        <ValueRow label="PLC Connection" value="ONLINE" />

      </IndustrialPanel>

    </div>
  );
}


/* =========================================================
   CNC
========================================================= */

function CNCInterface({ asset, process }) {

  const rpm = process?.motor_speed ?? 1450;
  const running = process?.production_running !== false;

  return (

    <div className="cnc-interface">

      <div className="cnc-display">

        <span>HAAS VF-2</span>

        <strong>
          {running ? "MACHINE READY" : "MACHINE STOPPED"}
        </strong>

        <div className="cnc-rpm">
          {Number(rpm).toFixed(0)}
          <small> RPM</small>
        </div>

      </div>

      <div className="interface-grid-2">

        <IndustrialPanel title="MACHINE STATUS">

          <ValueRow label="Mode" value="AUTO" />
          <ValueRow label="Spindle" value={running ? "RUNNING" : "STOPPED"} />
          <ValueRow label="Program" value="O01234" />
          <ValueRow label="Coolant" value="ON" />

        </IndustrialPanel>

        <IndustrialPanel title="NETWORK">

          <ValueRow label="IP Address" value={asset?.ip_address} />
          <ValueRow label="VLAN" value={asset?.vlan} />
          <ValueRow label="Network" value={asset?.network} />

        </IndustrialPanel>

      </div>

    </div>
  );
}


/* =========================================================
   MOTOR
========================================================= */


function MotorInterface({ asset, process }) {

  const rpm = process?.motor_speed ?? 1450;

  const [speedInput, setSpeedInput] =
    React.useState(
      Number(rpm).toFixed(0)
    );

  const [commandStatus, setCommandStatus] =
    React.useState("");

  const [commandError, setCommandError] =
    React.useState("");


  /*
   * =========================================================
   * MOTOR COMMAND
   * =========================================================
   */

  const changeMotorSpeed = async (speed) => {

    const numericSpeed =
      Number(speed);

    if (
      Number.isNaN(numericSpeed) ||
      numericSpeed < 0 ||
      numericSpeed > 2000
    ) {

      setCommandError(
        "INVALID SPEED: USE 0-2000 RPM"
      );

      setCommandStatus("");

      return;
    }


    setCommandStatus(
      `SETTING SPEED TO ${numericSpeed} RPM...`
    );

    setCommandError("");


    try {

      const response =
        await fetch(
          `http://127.0.0.1:8000/api/plant/motor?speed=${numericSpeed}`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );


      if (!response.ok) {

        throw new Error(
          `HTTP ${response.status}`
        );

      }


      await response.json();


      setCommandStatus(
        `MOTOR SPEED SET TO ${numericSpeed} RPM`
      );


      setTimeout(() => {

        setCommandStatus("");

      }, 3000);


    } catch (error) {

      console.error(
        "Motor command error:",
        error
      );


      setCommandStatus("");

      setCommandError(
        `COMMAND FAILED: ${error.message}`
      );

    }

  };


  /*
   * =========================================================
   * APPLY SPEED
   * =========================================================
   */

  const handleApplySpeed = () => {

    changeMotorSpeed(
      speedInput
    );

  };


  /*
   * =========================================================
   * STOP MOTOR
   * =========================================================
   */

  const handleMotorStop = () => {

    setSpeedInput("0");

    changeMotorSpeed(0);

  };


  /*
   * =========================================================
   * SYNCHRONIZE INPUT WITH PROCESS
   * =========================================================
   */

  React.useEffect(() => {

    setSpeedInput(
      Number(rpm).toFixed(0)
    );

  }, [rpm]);


  return (

    <div className="classic-interface">


      {/* =====================================================
          MOTOR / DRIVE
      ===================================================== */}

      <IndustrialPanel title="MOTOR / DRIVE">

        <div className="motor-real">

          <RotateCw
            size={65}
          />


          <div>

            <span>
              ACTUAL SPEED
            </span>

            <strong>
              {Number(rpm).toFixed(0)}
            </strong>

            <small>
              RPM
            </small>

          </div>

        </div>

      </IndustrialPanel>


      {/* =====================================================
          DRIVE PARAMETERS
      ===================================================== */}

      <IndustrialPanel title="DRIVE PARAMETERS">

        <ValueRow
          label="Speed"
          value={
            Number(rpm).toFixed(0)
          }
          unit="RPM"
        />


        <ValueRow
          label="Frequency"
          value={
            (
              Number(rpm) / 30
            ).toFixed(1)
          }
          unit="Hz"
        />


        <ValueRow
          label="Load"
          value={
            Math.min(
              100,
              Number(rpm) / 18
            ).toFixed(0)
          }
          unit="%"
        />


        <ValueRow
          label="Drive State"
          value={
            Number(rpm) > 0
              ? "RUN"
              : "STOP"
          }
        />

      </IndustrialPanel>


      {/* =====================================================
          OPERATOR CONTROL
      ===================================================== */}

      <IndustrialPanel title="OPERATOR CONTROL">

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >


          {/* SPEED INPUT */}

          <div>

            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "12px",
                fontFamily:
                  "monospace",
              }}
            >
              TARGET SPEED
            </label>


            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}
            >

              <input
                type="number"
                min="0"
                max="2000"
                step="50"
                value={speedInput}
                onChange={(event) =>
                  setSpeedInput(
                    event.target.value
                  )
                }
                style={{
                  width: "120px",
                  padding: "8px",
                  fontFamily:
                    "monospace",
                  boxSizing:
                    "border-box",
                }}
              />


              <span>
                RPM
              </span>


              <button
                type="button"
                onClick={
                  handleApplySpeed
                }
              >
                APPLY
              </button>

            </div>

          </div>


          {/* STOP */}

          <div>

            <button
              type="button"
              className="hmi-red"
              onClick={
                handleMotorStop
              }
              disabled={
                Number(rpm) === 0
              }
            >
              STOP MOTOR
            </button>

          </div>


          {/* COMMAND STATUS */}

          {(commandStatus ||
            commandError) && (

            <div
              style={{
                padding:
                  "8px 10px",
                fontSize: "11px",
                fontFamily:
                  "monospace",
                border:
                  "1px solid rgba(255,255,255,0.15)",
                background:
                  "rgba(0,0,0,0.25)",
              }}
            >

              {commandError
                ? commandError
                : commandStatus}

            </div>

          )}

        </div>

      </IndustrialPanel>


      {/* =====================================================
          MOTOR INFORMATION
      ===================================================== */}

      <IndustrialPanel title="MOTOR INFORMATION">

        <ValueRow
          label="Asset ID"
          value={
            asset?.asset_id ||
            "M-001"
          }
        />


        <ValueRow
          label="IP Address"
          value={
            asset?.ip_address ||
            "172.16.100.20"
          }
        />


        <ValueRow
          label="VLAN"
          value={
            asset?.vlan ||
            440
          }
        />


        <ValueRow
          label="Manufacturer"
          value={
            asset?.manufacturer ||
            "Siemens"
          }
        />


        <ValueRow
          label="Model"
          value={
            asset?.model ||
            "SIMOTICS"
          }
        />


        <ValueRow
          label="Nominal Speed"
          value={
            asset?.properties
              ?.nominal_speed ||
            1450
          }
          unit="RPM"
        />

      </IndustrialPanel>


    </div>
  );
}



/* =========================================================
   SENSORS
========================================================= */

function TemperatureInterface({ asset, process }) {

  const value = process?.temperature ?? 68.4;

  return (

    <div className="classic-interface">

      <IndustrialPanel title="TEMPERATURE TRANSMITTER">

        <div className="sensor-real">

          <Thermometer size={55} />

          <strong>
            {Number(value).toFixed(1)} °C
          </strong>

          <span>
            PROCESS VALUE
          </span>

        </div>

      </IndustrialPanel>

      <IndustrialPanel title="DEVICE INFORMATION">

        <ValueRow label="Range" value="0 – 150" unit="°C" />
        <ValueRow label="Signal" value="4-20 mA" />
        <ValueRow label="IP Address" value={asset?.ip_address} />
        <ValueRow label="VLAN" value={asset?.vlan} />

      </IndustrialPanel>

    </div>
  );
}


function PressureInterface({ asset, process }) {

  const value = process?.pressure ?? 3.8;

  return (

    <div className="classic-interface">

      <IndustrialPanel title="PRESSURE TRANSMITTER">

        <div className="sensor-real">

          <Gauge size={55} />

          <strong>
            {Number(value).toFixed(2)} bar
          </strong>

          <span>
            PROCESS PRESSURE
          </span>

        </div>

      </IndustrialPanel>

      <IndustrialPanel title="DEVICE INFORMATION">

        <ValueRow label="Range" value="0 – 10" unit="bar" />
        <ValueRow label="Signal" value="4-20 mA" />
        <ValueRow label="IP Address" value={asset?.ip_address} />
        <ValueRow label="VLAN" value={asset?.vlan} />

      </IndustrialPanel>

    </div>
  );
}


/* =========================================================
   VALVE
========================================================= */


function ValveInterface({ asset, process }) {

  const position =
    process?.valve_position ?? 50;

  const [positionInput, setPositionInput] =
    React.useState(
      Number(position).toFixed(0)
    );

  const [commandStatus, setCommandStatus] =
    React.useState("");

  const [commandError, setCommandError] =
    React.useState("");


  /*
   * =========================================================
   * VALVE COMMAND
   * =========================================================
   */

  const changeValvePosition = async (
    newPosition
  ) => {

    const numericPosition =
      Number(newPosition);


    if (
      Number.isNaN(numericPosition) ||
      numericPosition < 0 ||
      numericPosition > 100
    ) {

      setCommandError(
        "INVALID POSITION: USE 0-100%"
      );

      setCommandStatus("");

      return;
    }


    setCommandStatus(
      `SETTING VALVE TO ${numericPosition}%...`
    );

    setCommandError("");


    try {

      const response =
        await fetch(
          `http://127.0.0.1:8000/api/plant/valve?position=${numericPosition}`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );


      if (!response.ok) {

        throw new Error(
          `HTTP ${response.status}`
        );

      }


      await response.json();


      setCommandStatus(
        `VALVE POSITION SET TO ${numericPosition}%`
      );


      setTimeout(() => {

        setCommandStatus("");

      }, 3000);


    } catch (error) {

      console.error(
        "Valve command error:",
        error
      );


      setCommandStatus("");

      setCommandError(
        `COMMAND FAILED: ${error.message}`
      );

    }

  };


  /*
   * =========================================================
   * APPLY POSITION
   * =========================================================
   */

  const handleApplyPosition = () => {

    changeValvePosition(
      positionInput
    );

  };


  /*
   * =========================================================
   * OPEN
   * =========================================================
   */

  const handleOpen = () => {

    setPositionInput("100");

    changeValvePosition(100);

  };


  /*
   * =========================================================
   * CLOSE
   * =========================================================
   */

  const handleClose = () => {

    setPositionInput("0");

    changeValvePosition(0);

  };


  /*
   * =========================================================
   * SYNCHRONIZE INPUT WITH PROCESS
   * =========================================================
   */

  React.useEffect(() => {

    setPositionInput(
      Number(position).toFixed(0)
    );

  }, [position]);


  /*
   * =========================================================
   * VALVE STATUS
   * =========================================================
   */

  const valveAlarm =
    Number(position) < 10 ||
    Number(position) > 90;


  return (

    <div className="classic-interface">


      {/* =====================================================
          CONTROL VALVE
      ===================================================== */}

      <IndustrialPanel title="CONTROL VALVE">

        <div className="valve-real">

          <div className="valve-symbol-real">
            ◆
          </div>


          <strong>
            {Number(position).toFixed(0)}%
          </strong>


          <span>
            VALVE POSITION
          </span>

        </div>

      </IndustrialPanel>


      {/* =====================================================
          ACTUATOR
      ===================================================== */}

      <IndustrialPanel title="ACTUATOR">

        <ValueRow
          label="Position"
          value={
            Number(position).toFixed(0)
          }
          unit="%"
        />


        <ValueRow
          label="Mode"
          value="AUTO"
        />


        <ValueRow
          label="Command"
          value={
            valveAlarm
              ? "OUT OF RANGE"
              : "NORMAL"
          }
        />


        <ValueRow
          label="Fault"
          value={
            valveAlarm
              ? "PROCESS ALARM"
              : "NONE"
          }
        />

      </IndustrialPanel>


      {/* =====================================================
          OPERATOR CONTROL
      ===================================================== */}

      <IndustrialPanel title="OPERATOR CONTROL">

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >


          {/* POSITION */}

          <div>

            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "12px",
                fontFamily:
                  "monospace",
              }}
            >
              TARGET POSITION
            </label>


            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}
            >

              <input
                type="number"
                min="0"
                max="100"
                step="5"
                value={positionInput}
                onChange={(event) =>
                  setPositionInput(
                    event.target.value
                  )
                }
                style={{
                  width: "100px",
                  padding: "8px",
                  fontFamily:
                    "monospace",
                  boxSizing:
                    "border-box",
                }}
              />


              <span>
                %
              </span>


              <button
                type="button"
                onClick={
                  handleApplyPosition
                }
              >
                APPLY
              </button>

            </div>

          </div>


          {/* QUICK COMMANDS */}

          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >

            <button
              type="button"
              onClick={handleOpen}
            >
              OPEN
            </button>


            <button
              type="button"
              className="hmi-red"
              onClick={handleClose}
            >
              CLOSE
            </button>

          </div>


          {/* STATUS */}

          {(commandStatus ||
            commandError) && (

            <div
              style={{
                padding:
                  "8px 10px",
                fontSize: "11px",
                fontFamily:
                  "monospace",
                border:
                  "1px solid rgba(255,255,255,0.15)",
                background:
                  "rgba(0,0,0,0.25)",
              }}
            >

              {commandError
                ? commandError
                : commandStatus}

            </div>

          )}

        </div>

      </IndustrialPanel>


      {/* =====================================================
          NETWORK
      ===================================================== */}

      <IndustrialPanel title="NETWORK">

        <ValueRow
          label="IP Address"
          value={
            asset?.ip_address
          }
        />


        <ValueRow
          label="VLAN"
          value={
            asset?.vlan
          }
        />


        <ValueRow
          label="Asset ID"
          value={
            asset?.asset_id ||
            "V-001"
          }
        />


        <ValueRow
          label="Connection"
          value="CONNECTED"
        />


        <ValueRow
          label="Protocol"
          value="PROFINET"
        />

      </IndustrialPanel>


    </div>
  );
}



/* =========================================================
   MAIN
========================================================= */

export default function EquipmentInterface({
  asset,
  plant,
  process,
  events = [],
  onBack,
}) {

  if (!asset) {
    return null;
  }

  let content;

  switch (asset.asset_id) {

    case "PLC-001":
      content = (
        <PLCInterface
          asset={asset}
          plant={plant}
          process={process}
        />
      );
      break;

    case "HMI-001":
      content = (
        <HMIInterface
          asset={asset}
          process={process}
        />
      );
      break;

    case "SCADA-001":
      content = (
        <SCADAInterface
          asset={asset}
          process={process}
          events={events}
        />
      );
      break;

    case "GW-001":
      content = <GatewayInterface asset={asset} />;
      break;

    case "ENG-001":
      content = <EngineeringInterface asset={asset} />;
      break;

    case "CNC-001":
      content = (
        <CNCInterface
          asset={asset}
          process={process}
        />
      );
      break;

    case "M-001":
      content = (
        <MotorInterface
          asset={asset}
          process={process}
        />
      );
      break;

    case "TT-001":
      content = (
        <TemperatureInterface
          asset={asset}
          process={process}
        />
      );
      break;

    case "PT-001":
      content = (
        <PressureInterface
          asset={asset}
          process={process}
        />
      );
      break;

    case "V-001":
      content = (
        <ValveInterface
          asset={asset}
          process={process}
        />
      );
      break;

    default:
      content = (
        <IndustrialPanel title="EQUIPMENT INFORMATION">

          <ValueRow label="Asset ID" value={asset.asset_id} />
          <ValueRow label="Type" value={asset.type} />
          <ValueRow label="Manufacturer" value={asset.manufacturer} />
          <ValueRow label="Model" value={asset.model} />
          <ValueRow label="IP Address" value={asset.ip_address} />
          <ValueRow label="VLAN" value={asset.vlan} />

        </IndustrialPanel>
      );
  }

  return (

    <div className="equipment-interface">

      <EquipmentHeader
        asset={asset}
        onBack={onBack}
      />

      {content}

    </div>

  );
}