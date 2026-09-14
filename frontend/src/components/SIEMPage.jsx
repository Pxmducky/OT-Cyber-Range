import React, { useMemo, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Server,
  Network,
  Clock3,
  Search,
  ChevronRight,
  X,
  Crosshair,
  Radio,
  Factory,
} from "lucide-react";


/* =========================================================
   HELPERS
========================================================= */

function normalizeSeverity(event) {
  const value = String(
    event?.severity ||
    event?.level ||
    event?.priority ||
    "INFO"
  ).toUpperCase();

  if (
    value.includes("CRITICAL") ||
    value.includes("CRIT")
  ) {
    return "CRITICAL";
  }

  if (
    value.includes("HIGH") ||
    value.includes("ERROR")
  ) {
    return "HIGH";
  }

  if (
    value.includes("MEDIUM") ||
    value.includes("WARN")
  ) {
    return "MEDIUM";
  }

  return "LOW";
}


function eventType(event) {
  return String(
    event?.event_type ||
    event?.type ||
    event?.event ||
    "SYSTEM_EVENT"
  ).toUpperCase();
}


function eventMessage(event) {
  return (
    event?.message ||
    event?.description ||
    event?.detail ||
    eventType(event)
  );
}


function eventSource(event) {
  return (
    event?.source ||
    event?.source_ip ||
    event?.src ||
    event?.asset_id ||
    "SYSTEM"
  );
}


function eventTarget(event) {
  return (
    event?.target ||
    event?.target_ip ||
    event?.dst ||
    event?.asset_id ||
    "OT ENVIRONMENT"
  );
}


function eventTime(event) {
  return (
    event?.timestamp ||
    event?.time ||
    event?.created_at ||
    new Date().toISOString()
  );
}


function formatTime(value) {
  try {
    return new Date(value).toLocaleTimeString(
      "en-US",
      {
        hour12: false,
      }
    );
  } catch {
    return "--:--:--";
  }
}


/* =========================================================
   SEVERITY
========================================================= */

function SeverityBadge({ severity }) {

  return (
    <span
      className={`siem-severity ${severity.toLowerCase()}`}
    >
      <span />
      {severity}
    </span>
  );
}


/* =========================================================
   KPI CARD
========================================================= */

function KPICard({
  label,
  value,
  subtitle,
  icon: Icon,
  severity,
}) {

  return (
    <div className={`siem-kpi ${severity || ""}`}>

      <div className="siem-kpi-icon">
        <Icon size={19} />
      </div>

      <div className="siem-kpi-content">

        <span>{label}</span>

        <strong>{value}</strong>

        <small>{subtitle}</small>

      </div>

    </div>
  );
}


/* =========================================================
   EVENT DETAIL
========================================================= */

function EventDetail({
  event,
  onClose,
}) {

  if (!event) {
    return null;
  }

  const severity = normalizeSeverity(event);

  return (

    <aside className="siem-detail">

      <div className="siem-detail-header">

        <div>

          <span>SECURITY EVENT</span>

          <strong>
            {eventType(event)}
          </strong>

        </div>

        <button
          type="button"
          onClick={onClose}
          className="siem-close"
        >
          <X size={18} />
        </button>

      </div>


      <div className="siem-detail-severity">
        <SeverityBadge severity={severity} />
      </div>


      <div className="siem-detail-message">

        <AlertTriangle size={20} />

        <div>
          <span>EVENT DESCRIPTION</span>

          <strong>
            {eventMessage(event)}
          </strong>
        </div>

      </div>


      <div className="siem-detail-section">

        <h4>EVENT DETAILS</h4>

        <div className="siem-detail-row">
          <span>Timestamp</span>
          <strong>{formatTime(eventTime(event))}</strong>
        </div>

        <div className="siem-detail-row">
          <span>Event Type</span>
          <strong>{eventType(event)}</strong>
        </div>

        <div className="siem-detail-row">
          <span>Source</span>
          <strong>{eventSource(event)}</strong>
        </div>

        <div className="siem-detail-row">
          <span>Target</span>
          <strong>{eventTarget(event)}</strong>
        </div>

        <div className="siem-detail-row">
          <span>Protocol</span>
          <strong>
            {event?.protocol || "OT / INTERNAL"}
          </strong>
        </div>

      </div>


      <div className="siem-detail-section">

        <h4>OT SECURITY CONTEXT</h4>

        <div className="siem-technique">

          <Crosshair size={17} />

          <div>

            <span>DETECTION SOURCE</span>

            <strong>
              OT MONITORING ENGINE
            </strong>

          </div>

        </div>

        <div className="siem-technique">

          <Radio size={17} />

          <div>

            <span>NETWORK ZONE</span>

            <strong>
              OT / INDUSTRIAL NETWORK
            </strong>

          </div>

        </div>

      </div>

    </aside>
  );
}


/* =========================================================
   MAIN SIEM
========================================================= */

export default function SIEMPage({
  events = [],
  equipment = [],
  process = null,
}) {

  const [selectedEvent, setSelectedEvent] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [severityFilter, setSeverityFilter] =
    useState("ALL");


  /* -------------------------------------------------------
     NORMALIZE EVENTS
  ------------------------------------------------------- */

  const normalizedEvents = useMemo(() => {

    return events.map((event, index) => ({

      ...event,

      _id:
        event?.id ||
        `${eventType(event)}-${index}`,

      _severity:
        normalizeSeverity(event),

      _type:
        eventType(event),

      _message:
        eventMessage(event),

      _source:
        eventSource(event),

      _target:
        eventTarget(event),

      _time:
        eventTime(event),

    }));

  }, [events]);


  /* -------------------------------------------------------
     FILTER
  ------------------------------------------------------- */

  const filteredEvents = useMemo(() => {

    const query =
      search.trim().toLowerCase();

    return normalizedEvents.filter((event) => {

      const matchesSeverity =
        severityFilter === "ALL" ||
        event._severity === severityFilter;

      if (!matchesSeverity) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        event._type,
        event._message,
        event._source,
        event._target,
        event?.asset_id,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);

    });

  }, [
    normalizedEvents,
    search,
    severityFilter,
  ]);


  /* -------------------------------------------------------
     KPI
  ------------------------------------------------------- */

  const criticalCount =
    normalizedEvents.filter(
      e => e._severity === "CRITICAL"
    ).length;

  const highCount =
    normalizedEvents.filter(
      e => e._severity === "HIGH"
    ).length;

  const mediumCount =
    normalizedEvents.filter(
      e => e._severity === "MEDIUM"
    ).length;

  const monitoredAssets =
    equipment.length;


  const productionRunning =
    process?.production_running !== false;


  return (

    <div className="siem-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="siem-header">

        <div className="siem-brand">

          <div className="siem-shield">
            <ShieldCheck size={25} />
          </div>

          <div>

            <strong>
              OT SECURITY OPERATIONS CENTER
            </strong>

            <span>
              INDUSTRIAL CYBERSECURITY MONITORING
            </span>

          </div>

        </div>


        <div className="siem-live">

          <span />

          LIVE MONITORING

        </div>

      </header>


      {/* =================================================
          KPI
      ================================================= */}

      <section className="siem-kpis">

        <KPICard
          label="CRITICAL"
          value={criticalCount}
          subtitle="Immediate attention"
          icon={ShieldAlert}
          severity="critical"
        />

        <KPICard
          label="HIGH"
          value={highCount}
          subtitle="Security alerts"
          icon={AlertTriangle}
          severity="high"
        />

        <KPICard
          label="MEDIUM"
          value={mediumCount}
          subtitle="Events requiring review"
          icon={Activity}
          severity="medium"
        />

        <KPICard
          label="ASSETS MONITORED"
          value={monitoredAssets}
          subtitle="Industrial assets"
          icon={Server}
        />

        <KPICard
          label="PRODUCTION"
          value={productionRunning ? "RUNNING" : "STOPPED"}
          subtitle="Current process state"
          icon={Factory}
          severity={
            productionRunning
              ? "healthy"
              : "critical"
          }
        />

      </section>


      {/* =================================================
          NETWORK STATUS
      ================================================= */}

      <section className="siem-status-bar">

        <div>

          <Network size={16} />

          <span>
            OT NETWORK
          </span>

          <strong>
            MONITORED
          </strong>

        </div>

        <div>

          <Server size={16} />

          <span>
            ASSETS
          </span>

          <strong>
            {equipment.length}
          </strong>

        </div>

        <div>

          <Activity size={16} />

          <span>
            EVENTS
          </span>

          <strong>
            {normalizedEvents.length}
          </strong>

        </div>

        <div>

          <Clock3 size={16} />

          <span>
            SYSTEM
          </span>

          <strong>
            ONLINE
          </strong>

        </div>

      </section>


      {/* =================================================
          BODY
      ================================================= */}

      <section className="siem-content">

        <div className="siem-events-panel">


          {/* EVENT TOOLBAR */}

          <div className="siem-toolbar">

            <div>

              <strong>
                SECURITY EVENTS
              </strong>

              <span>
                Real-time OT event stream
              </span>

            </div>


            <div className="siem-controls">

              <div className="siem-search">

                <Search size={15} />

                <input
                  value={search}
                  onChange={
                    e => setSearch(e.target.value)
                  }
                  placeholder="Search events..."
                />

              </div>


              <select
                value={severityFilter}
                onChange={
                  e =>
                    setSeverityFilter(
                      e.target.value
                    )
                }
              >

                <option value="ALL">
                  ALL SEVERITIES
                </option>

                <option value="CRITICAL">
                  CRITICAL
                </option>

                <option value="HIGH">
                  HIGH
                </option>

                <option value="MEDIUM">
                  MEDIUM
                </option>

                <option value="LOW">
                  LOW
                </option>

              </select>

            </div>

          </div>


          {/* EVENT TABLE */}

          <div className="siem-table">

            <div className="siem-table-head">

              <span>TIME</span>
              <span>SEVERITY</span>
              <span>EVENT</span>
              <span>SOURCE</span>
              <span>TARGET</span>
              <span />

            </div>


            {filteredEvents.length === 0 ? (

              <div className="siem-empty">

                <ShieldCheck size={25} />

                <strong>
                  NO EVENTS DETECTED
                </strong>

                <span>
                  The OT monitoring engine is currently
                  operating normally.
                </span>

              </div>

            ) : (

              filteredEvents
                .slice()
                .reverse()
                .map(event => (

                  <button
                    type="button"
                    key={event._id}
                    className="siem-event-row"
                    onClick={() =>
                      setSelectedEvent(event)
                    }
                  >

                    <span className="siem-time">
                      {formatTime(event._time)}
                    </span>

                    <span>
                      <SeverityBadge
                        severity={event._severity}
                      />
                    </span>

                    <span className="siem-event-name">

                      <strong>
                        {event._type}
                      </strong>

                      <small>
                        {event._message}
                      </small>

                    </span>

                    <span className="siem-source">
                      {event._source}
                    </span>

                    <span className="siem-target">
                      {event._target}
                    </span>

                    <ChevronRight
                      size={15}
                      className="siem-arrow"
                    />

                  </button>

                ))

            )}

          </div>

        </div>


        {/* =================================================
            DETAIL PANEL
        ================================================= */}

        {selectedEvent && (

          <EventDetail
            event={selectedEvent}
            onClose={() =>
              setSelectedEvent(null)
            }
          />

        )}

      </section>


      {/* =================================================
          TIMELINE
      ================================================= */}

      <section className="siem-timeline-panel">

        <div className="siem-section-title">

          <div>

            <strong>
              OT SECURITY TIMELINE
            </strong>

            <span>
              Recent activity across the industrial environment
            </span>

          </div>

        </div>


        <div className="siem-timeline">

          {normalizedEvents
            .slice()
            .reverse()
            .slice(0, 10)
            .map(event => (

              <button
                type="button"
                className="siem-timeline-item"
                key={`timeline-${event._id}`}
                onClick={() =>
                  setSelectedEvent(event)
                }
              >

                <div className="timeline-dot">
                  <span />
                </div>

                <div className="timeline-time">
                  {formatTime(event._time)}
                </div>

                <div className="timeline-content">

                  <strong>
                    {event._type}
                  </strong>

                  <span>
                    {event._message}
                  </span>

                </div>

                <SeverityBadge
                  severity={event._severity}
                />

              </button>

            ))}

          {normalizedEvents.length === 0 && (

            <div className="timeline-empty">
              Waiting for OT security events...
            </div>

          )}

        </div>

      </section>

    </div>
  );
}