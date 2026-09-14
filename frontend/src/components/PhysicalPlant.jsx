import {
  Cpu,
  Factory,
  Monitor,
  Router,
  Settings,
  Radio,
  Gauge,
  X,
} from "lucide-react";

import { useState } from "react";

import EquipmentInterface from "./EquipmentInterface";


function PhysicalPlant({
  plant,
  equipment,
  events = [],
}) {
  

  /*
   * =========================================================
   * STATE
   * =========================================================
   */

  const [selected, setSelected] =
    useState(null);

  const [interfaceAsset, setInterfaceAsset] =
    useState(null);


  /*
   * =========================================================
   * ASSETS
   * =========================================================
   */

  const getAsset = (id) =>
    equipment.find(
      asset => asset.asset_id === id
    );


  const plc =
    getAsset("PLC-001");

  const hmi =
    getAsset("HMI-001");

  const scada =
    getAsset("SCADA-001");

  const gateway =
    getAsset("GW-001");

  const engineering =
    getAsset("ENG-001");

  const cnc =
    getAsset("CNC-001");

  const motor =
    getAsset("M-001");

  const temp =
    getAsset("TT-001");

  const pressure =
    getAsset("PT-001");

  const valve =
    getAsset("V-001");


  const process =
    plant?.process;


  /*
   * =========================================================
   * EQUIPMENT INTERFACE
   * =========================================================
   */

  if (interfaceAsset) {

    return (

      <EquipmentInterface
  asset={interfaceAsset}
  plant={plant}
  process={process}
  events={events}
  onBack={() => setInterfaceAsset(null)}
/>

    );

  }


  /*
   * =========================================================
   * PHYSICAL PLANT
   * =========================================================
   */

  return (

    <section className="physical-page">


      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="physical-header">

        <div>

          <div className="eyebrow">
            PHYSICAL ENVIRONMENT
          </div>

          <h2>
            Production Line 01
          </h2>

        </div>


        <div className="physical-status">

          <span />

          LIVE INDUSTRIAL ENVIRONMENT

        </div>

      </div>


      {/* =====================================================
          FACTORY
      ===================================================== */}

      <div className="factory-scene">


        {/* ===================================================
            BACKGROUND STRUCTURE
        =================================================== */}

        <div className="factory-ceiling" />

        <div className="factory-beam beam-one" />

        <div className="factory-beam beam-two" />


        {/* ===================================================
            PRODUCTION FLOOR
        =================================================== */}

        <div className="production-floor">


          {/* =================================================
              SCADA
          ================================================= */}

          <EquipmentHotspot
            asset={scada}
            icon={
              <Monitor size={24} />
            }
            className="spot-scada"
            onClick={() =>
              setSelected(scada)
            }
          />


          {/* =================================================
              ENGINEERING
          ================================================= */}

          <EquipmentHotspot
            asset={engineering}
            icon={
              <Monitor size={24} />
            }
            className="spot-engineering"
            onClick={() =>
              setSelected(engineering)
            }
          />


          {/* =================================================
              PLC
          ================================================= */}

          <EquipmentHotspot
            asset={plc}
            icon={
              <Cpu size={25} />
            }
            className="spot-plc"
            onClick={() =>
              setSelected(plc)
            }
          />


          {/* =================================================
              HMI
          ================================================= */}

          <EquipmentHotspot
            asset={hmi}
            icon={
              <Monitor size={24} />
            }
            className="spot-hmi"
            onClick={() =>
              setSelected(hmi)
            }
          />


          {/* =================================================
              GATEWAY
          ================================================= */}

          <EquipmentHotspot
            asset={gateway}
            icon={
              <Router size={24} />
            }
            className="spot-gateway"
            onClick={() =>
              setSelected(gateway)
            }
          />


          {/* =================================================
              MOTOR
          ================================================= */}

          <EquipmentHotspot
            asset={motor}
            icon={
              <Settings size={27} />
            }
            className={
              process?.motor_speed < 500
                ? "spot-motor alarm"
                : "spot-motor"
            }
            onClick={() =>
              setSelected(motor)
            }
          />


          {/* =================================================
              CNC
          ================================================= */}

          <EquipmentHotspot
            asset={cnc}
            icon={
              <Factory size={28} />
            }
            className={
              process?.production_running
                ? "spot-cnc"
                : "spot-cnc alarm"
            }
            onClick={() =>
              setSelected(cnc)
            }
          />


          {/* =================================================
              TEMPERATURE SENSOR
          ================================================= */}

          <SensorHotspot
            asset={temp}
            value={
              process?.temperature !== undefined
                ? `${process.temperature.toFixed(1)}°C`
                : "--"
            }
            icon={
              <Radio size={18} />
            }
            className="spot-temperature"
            onClick={() =>
              setSelected(temp)
            }
          />


          {/* =================================================
              PRESSURE SENSOR
          ================================================= */}

          <SensorHotspot
            asset={pressure}
            value={
              process?.pressure !== undefined
                ? `${process.pressure.toFixed(2)} bar`
                : "--"
            }
            icon={
              <Gauge size={18} />
            }
            className="spot-pressure"
            onClick={() =>
              setSelected(pressure)
            }
          />


          {/* =================================================
              VALVE
          ================================================= */}

          <SensorHotspot
            asset={valve}
            value={
              process?.valve_position !== undefined
                ? `${process.valve_position.toFixed(0)}%`
                : "--"
            }
            icon={
              <Settings size={18} />
            }
            className="spot-valve"
            onClick={() =>
              setSelected(valve)
            }
          />


          {/* =================================================
              INDUSTRIAL PIPING
          ================================================= */}

          <div className="pipe pipe-main" />

          <div className="pipe pipe-secondary" />

          <div className="pipe pipe-vertical" />


          {/* =================================================
              CONNECTION LINES
          ================================================= */}

          <div className="connection connection-plc-hmi" />

          <div className="connection connection-plc-motor" />

          <div className="connection connection-plc-cnc" />


          {/* =================================================
              PRODUCTION AREA
          ================================================= */}

          <div className="production-zone">

            <div className="zone-label">
              PRODUCTION CELL A
            </div>


            <div className="machine-body">

              <div className="machine-light" />


              <div className="machine-window">

                <div className="machine-spindle" />

                <div className="machine-workpiece" />

              </div>


              <div className="machine-control">

                <div />
                <div />
                <div />
                <div />
                <div />
                <div />

              </div>

            </div>

          </div>


          {/* =================================================
              FLOOR MARKINGS
          ================================================= */}

          <div className="floor-line floor-one" />

          <div className="floor-line floor-two" />


        </div>


        {/* ===================================================
            NETWORK LEGEND
        =================================================== */}

        <div className="physical-legend">

          <div className="legend-title">
            OT NETWORKS
          </div>


          <LegendItem
            label="VLAN 440"
            description="PLC / Field"
          />


          <LegendItem
            label="VLAN 902"
            description="HMI"
          />


          <LegendItem
            label="VLAN 903"
            description="Gateway"
          />


          <LegendItem
            label="VLAN 904"
            description="SCADA / Servers"
          />


          <LegendItem
            label="VLAN 800"
            description="Machines"
          />


          <LegendItem
            label="VLAN 901"
            description="Engineering"
          />

        </div>


        {/* ===================================================
            PRODUCTION STATUS
        =================================================== */}

        <div className="physical-production">

          <div className="production-status-label">
            PRODUCTION
          </div>


          <strong>

            {process?.production_rate !== undefined
              ? process.production_rate.toFixed(0)
              : "0"}%

          </strong>


          <div className="production-bar">

            <div
              style={{
                width:
                  `${process?.production_rate || 0}%`
              }}
            />

          </div>


          <span>

            {process?.production_running
              ? "LINE RUNNING"
              : "LINE STOPPED"}

          </span>

        </div>


      </div>


      {/* =====================================================
          EQUIPMENT DETAILS
      ===================================================== */}

      {selected && (

        <EquipmentDetails
          asset={selected}
          process={process}
          onClose={() =>
            setSelected(null)
          }
          onOpenInterface={() => {

            setInterfaceAsset(
              selected
            );

            setSelected(null);

          }}
        />

      )}


    </section>

  );

}


/*
 * ===========================================================
 * EQUIPMENT HOTSPOT
 * ===========================================================
 */

function EquipmentHotspot({
  asset,
  icon,
  className,
  onClick,
}) {

  if (!asset) {
    return null;
  }


  const isOffline =
    asset.status === "OFFLINE";


  return (

    <button
      className={
        `physical-equipment ${className}`
      }
      onClick={onClick}
      type="button"
    >

      <div className="equipment-marker">

        {icon}


        <span
          className={
            isOffline
              ? "marker-status offline"
              : "marker-status"
          }
        />

      </div>


      <div className="physical-label">

        <strong>
          {asset.asset_id}
        </strong>

        <span>
          {asset.type}
        </span>

      </div>

    </button>

  );

}


/*
 * ===========================================================
 * SENSOR HOTSPOT
 * ===========================================================
 */

function SensorHotspot({
  asset,
  value,
  icon,
  className,
  onClick,
}) {

  if (!asset) {
    return null;
  }


  return (

    <button
      className={
        `physical-sensor ${className}`
      }
      onClick={onClick}
      type="button"
    >

      <div className="sensor-icon">

        {icon}

      </div>


      <strong>
        {asset.asset_id}
      </strong>


      <span>
        {value}
      </span>

    </button>

  );

}


/*
 * ===========================================================
 * EQUIPMENT DETAILS
 * ===========================================================
 */

function EquipmentDetails({
  asset,
  process,
  onClose,
  onOpenInterface,
}) {


  const getValue = () => {


    if (asset.asset_id === "M-001") {

      return process?.motor_speed !== undefined
        ? `${process.motor_speed.toFixed(0)} RPM`
        : "--";

    }


    if (asset.asset_id === "TT-001") {

      return process?.temperature !== undefined
        ? `${process.temperature.toFixed(1)} °C`
        : "--";

    }


    if (asset.asset_id === "PT-001") {

      return process?.pressure !== undefined
        ? `${process.pressure.toFixed(2)} bar`
        : "--";

    }


    if (asset.asset_id === "V-001") {

      return process?.valve_position !== undefined
        ? `${process.valve_position.toFixed(0)} %`
        : "--";

    }


    if (asset.asset_id === "CNC-001") {

      return process?.production_running
        ? "PRODUCING"
        : "STOPPED";

    }


    if (asset.asset_id === "PLC-001") {

      return "RUN";

    }


    if (asset.asset_id === "HMI-001") {

      return "OPERATIONAL";

    }


    if (asset.asset_id === "SCADA-001") {

      return "MONITORING";

    }


    if (asset.asset_id === "GW-001") {

      return "CONNECTED";

    }


    return asset.status;

  };


  return (

    <div className="equipment-overlay">


      <div className="equipment-detail-panel">


        {/* CLOSE */}

        <button
          className="close-detail"
          onClick={onClose}
          type="button"
          aria-label="Close equipment details"
        >

          <X size={18} />

        </button>


        {/* HEADER */}

        <div className="eyebrow">
          OT ASSET
        </div>


        <h2>
          {asset.asset_id}
        </h2>


        <p className="detail-name">
          {asset.name}
        </p>


        {/* STATUS */}

        <div className="detail-status">

          <span />

          {asset.status}

        </div>


        {/* INFORMATION */}

        <div className="detail-grid">


          <DetailItem
            label="TYPE"
            value={asset.type}
          />


          <DetailItem
            label="MANUFACTURER"
            value={asset.manufacturer}
          />


          <DetailItem
            label="MODEL"
            value={asset.model}
          />


          <DetailItem
            label="IP ADDRESS"
            value={asset.ip_address}
          />


          <DetailItem
            label="VLAN"
            value={asset.vlan}
          />


          <DetailItem
            label="NETWORK"
            value={asset.network}
          />

        </div>


        {/* CURRENT VALUE */}

        <div className="live-value">

          <span>
            CURRENT VALUE
          </span>


          <strong>
            {getValue()}
          </strong>

        </div>


        {/* OPEN INTERFACE */}

        <button
          className="open-interface-button"
          onClick={onOpenInterface}
          type="button"
        >

          OPEN EQUIPMENT INTERFACE

        </button>


      </div>

    </div>

  );

}


/*
 * ===========================================================
 * DETAIL ITEM
 * ===========================================================
 */

function DetailItem({
  label,
  value,
}) {

  return (

    <div className="detail-item">

      <span>
        {label}
      </span>


      <strong>
        {value}
      </strong>

    </div>

  );

}


/*
 * ===========================================================
 * LEGEND
 * ===========================================================
 */

function LegendItem({
  label,
  description,
}) {

  return (

    <div className="legend-item">

      <span />


      <div>

        <strong>
          {label}
        </strong>

        <small>
          {description}
        </small>

      </div>

    </div>

  );

}


export default PhysicalPlant;