import {
    Shield,
    Server,
    Monitor,
    Cpu,
    Settings,
    Radio,
    Router,
    Factory,
    Network,
    Lock,
    Database,
  } from "lucide-react";
  
  
  function PurduePage({ equipment }) {
  
    const getAsset = (id) =>
      equipment?.find(
        asset => asset.asset_id === id
      );
  
  
    const scada = getAsset("SCADA-001");
    const hmi = getAsset("HMI-001");
    const plc = getAsset("PLC-001");
    const engineering = getAsset("ENG-001");
    const gateway = getAsset("GW-001");
    const motor = getAsset("M-001");
    const cnc = getAsset("CNC-001");
    const temp = getAsset("TT-001");
    const pressure = getAsset("PT-001");
    const valve = getAsset("V-001");
  
  
    return (
  
      <section className="content purdue-page">
  
  
        {/* =====================================================
            HEADER
        ===================================================== */}
  
        <div className="process-heading">
  
          <div>
  
            <div className="eyebrow">
              INDUSTRIAL NETWORK ARCHITECTURE
            </div>
  
            <h2>
              Purdue Model
            </h2>
  
          </div>
  
  
          <div className="purdue-security-status">
  
            <span />
  
            NETWORK SEGMENTATION ACTIVE
  
          </div>
  
        </div>
  
  
        {/* =====================================================
            ARCHITECTURE
        ===================================================== */}
  
        <div className="purdue-architecture">
  
  
          {/* ===================================================
              LEVEL 4
          =================================================== */}
  
          <PurdueLevel
            level="LEVEL 4"
            title="ENTERPRISE / IT"
            description="Enterprise Information Systems"
            colorClass="level-enterprise"
          >
  
            <ArchitectureNode
              icon={<Server />}
              title="IT NETWORK"
              subtitle="Enterprise Services"
              vlan="CORPORATE"
            />
  
          </PurdueLevel>
  
  
          <PurdueConnection />
  
  
          {/* ===================================================
              FIREWALL
          =================================================== */}
  
          <ArchitectureFirewall
            name="IT / OT FIREWALL"
          />
  
  
          <PurdueConnection />
  
  
          {/* ===================================================
              LEVEL 3.5
          =================================================== */}
  
          <PurdueLevel
            level="LEVEL 3.5"
            title="OT DMZ"
            description="Industrial Demilitarized Zone"
            colorClass="level-dmz"
          >
  
            <ArchitectureNode
              icon={<Shield />}
              title="OT DMZ"
              subtitle="Controlled Services"
              vlan="DMZ"
            />
  
            <ArchitectureNode
              icon={<Database />}
              title="BROKER"
              subtitle="Industrial Data Broker"
              vlan="DMZ"
            />
  
            <ArchitectureNode
              icon={<Server />}
              title="OT STORAGE"
              subtitle="Industrial Storage"
              vlan="DMZ"
            />
  
          </PurdueLevel>
  
  
          <PurdueConnection />
  
  
          {/* ===================================================
              OT FIREWALL
          =================================================== */}
  
          <ArchitectureFirewall
            name="OT FIREWALL"
          />
  
  
          <PurdueConnection />
  
  
          {/* ===================================================
              LEVEL 3
          =================================================== */}
  
          <PurdueLevel
            level="LEVEL 3"
            title="SUPERVISORY"
            description="SCADA / Supervisory Control"
            colorClass="level-supervisory"
          >
  
            <ArchitectureNode
              asset={scada}
              icon={<Monitor />}
              title="SCADA-001"
              subtitle="SCADA Server"
              vlan="VLAN 904"
            />
  
          </PurdueLevel>
  
  
          <PurdueConnection />
  
  
          {/* ===================================================
              LEVEL 2
          =================================================== */}
  
          <PurdueLevel
            level="LEVEL 2"
            title="CONTROL"
            description="Operator and Engineering"
            colorClass="level-control"
          >
  
            <ArchitectureNode
              asset={hmi}
              icon={<Monitor />}
              title="HMI-001"
              subtitle="Operator HMI"
              vlan="VLAN 902"
            />
  
            <ArchitectureNode
              asset={engineering}
              icon={<Settings />}
              title="ENG-001"
              subtitle="Engineering Station"
              vlan="VLAN 901"
            />
  
            <ArchitectureNode
              asset={gateway}
              icon={<Router />}
              title="GW-001"
              subtitle="Remote Gateway"
              vlan="VLAN 903"
            />
  
          </PurdueLevel>
  
  
          <PurdueConnection />
  
  
          {/* ===================================================
              LEVEL 1
          =================================================== */}
  
          <PurdueLevel
            level="LEVEL 1"
            title="BASIC CONTROL"
            description="Programmable Control"
            colorClass="level-control"
          >
  
            <ArchitectureNode
              asset={plc}
              icon={<Cpu />}
              title="PLC-001"
              subtitle="Siemens S7-1500"
              vlan="VLAN 440"
              highlighted
            />
  
          </PurdueLevel>
  
  
          <PurdueConnection />
  
  
          {/* ===================================================
              LEVEL 0
          =================================================== */}
  
          <PurdueLevel
            level="LEVEL 0"
            title="FIELD / PROCESS"
            description="Physical Industrial Process"
            colorClass="level-field"
          >
  
            <ArchitectureNode
              asset={temp}
              icon={<Radio />}
              title="TT-001"
              subtitle="Temperature"
              vlan="VLAN 440"
            />
  
            <ArchitectureNode
              asset={pressure}
              icon={<Radio />}
              title="PT-001"
              subtitle="Pressure"
              vlan="VLAN 440"
            />
  
            <ArchitectureNode
              asset={valve}
              icon={<Settings />}
              title="V-001"
              subtitle="Control Valve"
              vlan="VLAN 440"
            />
  
            <ArchitectureNode
              asset={motor}
              icon={<Settings />}
              title="M-001"
              subtitle="Production Motor"
              vlan="VLAN 800"
            />
  
            <ArchitectureNode
              asset={cnc}
              icon={<Factory />}
              title="CNC-001"
              subtitle="Machining Center"
              vlan="VLAN 800"
            />
  
          </PurdueLevel>
  
  
        </div>
  
  
        {/* =====================================================
            VLAN MAP
        ===================================================== */}
  
        <div className="purdue-vlan-panel">
  
          <div className="panel-header">
  
            <div>
  
              <div className="eyebrow">
                NETWORK SEGMENTATION
              </div>
  
              <h3>
                OT VLAN Map
              </h3>
  
            </div>
  
          </div>
  
  
          <div className="purdue-vlan-grid">
  
            <VLANCard
              vlan="VLAN 440"
              name="OT-PLC"
              description="PLC / Field Devices"
              assets={["PLC-001", "TT-001", "PT-001", "V-001"]}
            />
  
            <VLANCard
              vlan="VLAN 901"
              name="OT-ENGINEERING"
              description="Engineering Workstations"
              assets={["ENG-001"]}
            />
  
            <VLANCard
              vlan="VLAN 902"
              name="OT-HMI"
              description="Operator Interfaces"
              assets={["HMI-001"]}
            />
  
            <VLANCard
              vlan="VLAN 903"
              name="OT-GATEWAY"
              description="Remote Access"
              assets={["GW-001"]}
            />
  
            <VLANCard
              vlan="VLAN 904"
              name="OT-SERVERS"
              description="SCADA / Industrial Servers"
              assets={["SCADA-001"]}
            />
  
            <VLANCard
              vlan="VLAN 800"
              name="OT-MACHINES"
              description="Industrial Machinery"
              assets={["M-001", "CNC-001"]}
            />
  
          </div>
  
        </div>
  
  
        {/* =====================================================
            ARCHITECTURE SUMMARY
        ===================================================== */}
  
        <div className="purdue-summary">
  
  
          <SummaryCard
            icon={<Network />}
            value="6"
            label="NETWORK SEGMENTS"
          />
  
  
          <SummaryCard
            icon={<Shield />}
            value="2"
            label="FIREWALL ZONES"
          />
  
  
          <SummaryCard
            icon={<Lock />}
            value="1"
            label="OT DMZ"
          />
  
  
          <SummaryCard
            icon={<Cpu />}
            value={equipment?.length || 0}
            label="OT ASSETS"
          />
  
        </div>
  
  
      </section>
  
    );
  
  }
  
  
  /*
   * ===========================================================
   * PURDUE LEVEL
   * ===========================================================
   */
  
  function PurdueLevel({
    level,
    title,
    description,
    colorClass,
    children,
  }) {
  
    return (
  
      <div
        className={`purdue-level ${colorClass}`}
      >
  
  
        <div className="purdue-level-header">
  
          <div className="purdue-level-number">
  
            {level}
  
          </div>
  
  
          <div>
  
            <strong>
              {title}
            </strong>
  
            <span>
              {description}
            </span>
  
          </div>
  
        </div>
  
  
        <div className="purdue-level-assets">
  
          {children}
  
        </div>
  
      </div>
  
    );
  
  }
  
  
  /*
   * ===========================================================
   * ARCHITECTURE NODE
   * ===========================================================
   */
  
  function ArchitectureNode({
    asset,
    icon,
    title,
    subtitle,
    vlan,
    highlighted,
  }) {
  
    return (
  
      <div
        className={
          highlighted
            ? "architecture-node highlighted"
            : "architecture-node"
        }
      >
  
  
        <div className="architecture-node-icon">
  
          {icon}
  
        </div>
  
  
        <div className="architecture-node-info">
  
          <strong>
            {asset?.asset_id || title}
          </strong>
  
          <span>
            {subtitle}
          </span>
  
        </div>
  
  
        <div className="architecture-node-vlan">
  
          {vlan}
  
        </div>
  
  
        {asset && (
  
          <div className="architecture-node-ip">
  
            {asset.ip_address}
  
          </div>
  
        )}
  
  
        <div className="architecture-node-status">
  
          <span />
  
          {asset?.status || "SEGMENTED"}
  
        </div>
  
  
      </div>
  
    );
  
  }
  
  
  /*
   * ===========================================================
   * FIREWALL
   * ===========================================================
   */
  
  function ArchitectureFirewall({
    name,
  }) {
  
    return (
  
      <div className="architecture-firewall">
  
        <div className="firewall-icon">
  
          <Shield />
  
        </div>
  
  
        <div>
  
          <strong>
            {name}
          </strong>
  
          <span>
            TRAFFIC CONTROL
          </span>
  
        </div>
  
  
      </div>
  
    );
  
  }
  
  
  /*
   * ===========================================================
   * CONNECTION
   * ===========================================================
   */
  
  function PurdueConnection() {
  
    return (
  
      <div className="purdue-connection">
  
        <div className="purdue-arrow" />
  
      </div>
  
    );
  
  }
  
  
  /*
   * ===========================================================
   * VLAN CARD
   * ===========================================================
   */
  
  function VLANCard({
    vlan,
    name,
    description,
    assets,
  }) {
  
    return (
  
      <div className="vlan-card">
  
        <div className="vlan-card-header">
  
          <div className="vlan-number">
  
            {vlan}
  
          </div>
  
          <Network size={17} />
  
        </div>
  
  
        <strong>
          {name}
        </strong>
  
  
        <span>
          {description}
        </span>
  
  
        <div className="vlan-assets">
  
          {assets.map(
            asset => (
  
              <span
                key={asset}
              >
                {asset}
              </span>
  
            )
          )}
  
        </div>
  
      </div>
  
    );
  
  }
  
  
  /*
   * ===========================================================
   * SUMMARY
   * ===========================================================
   */
  
  function SummaryCard({
    icon,
    value,
    label,
  }) {
  
    return (
  
      <div className="purdue-summary-card">
  
        <div className="purdue-summary-icon">
  
          {icon}
  
        </div>
  
  
        <strong>
          {value}
        </strong>
  
  
        <span>
          {label}
        </span>
  
      </div>
  
    );
  
  }
  
  
  export default PurduePage;