"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleDot,
  Clock,
  Cpu,
  GitBranch,
  Network,
  Play,
  RotateCcw,
  Route as RouteIcon,
  Signal,
  Sparkles,
  Waypoints,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSimulation } from "@/components/simulation-provider";
import { TopologyCanvas } from "@/components/topology-canvas";
import { routeLinkIds } from "@/lib/topology";

type BadgeKind =
  | "active"
  | "available"
  | "congested"
  | "live"
  | "neutral"
  | "rerouted"
  | "warning";

function Badge({
  kind,
  children,
}: {
  kind: BadgeKind;
  children: React.ReactNode;
}) {
  return (
    <span className={`status-badge badge-${kind}`}>
      <i />
      {children}
    </span>
  );
}
function PanelHead({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-header">
      <div>
        <h2>{title}</h2>
        {detail && <span>{detail}</span>}
      </div>
      {action}
    </div>
  );
}
function RouteLine({
  route,
  muted = false,
}: {
  route: string[];
  muted?: boolean;
}) {
  return route.length ? (
    <span className={`route-line ${muted ? "route-subdued" : ""}`}>
      {route.map((name, i) => (
        <span className="route-stop" key={`${name}-${i}`}>
          {i > 0 && <i />}
          <b>{name}</b>
        </span>
      ))}
    </span>
  ) : (
    <span className="route-empty">No route selected yet</span>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "green",
  note = "—",
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  tone?: string;
  note?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon tone-${tone}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        <span className="stat-trend">{note}</span>
        <span>current run</span>
      </div>
    </div>
  );
}
function Stats({ includeRates = false }: { includeRates?: boolean }) {
  const { stats } = useSimulation();
  return (
    <div className={`stats-grid ${includeRates ? "stats-six" : ""}`}>
      <Stat
        label="Total packets"
        value={stats.total.toLocaleString()}
        icon={Signal}
        note={stats.total ? "RUN TOTAL" : "READY TO SEND"}
      />
      <Stat
        label="Delivered"
        value={stats.delivered.toLocaleString()}
        icon={Check}
        tone="blue"
        note={
          stats.total
            ? `${((stats.delivered / stats.total) * 100).toFixed(1)}% delivered`
            : "—"
        }
      />
      <Stat
        label="Dropped"
        value={stats.dropped.toLocaleString()}
        icon={ArrowDownRight}
        tone="red"
        note={
          stats.total
            ? `${((stats.dropped / stats.total) * 100).toFixed(1)}% packet loss`
            : "—"
        }
      />
      <Stat
        label="Rerouted"
        value={stats.rerouted.toLocaleString()}
        icon={ArrowUpRight}
        tone="blue"
        note={stats.rerouted ? "PATH RECOVERED" : "—"}
      />
      {includeRates && (
        <>
          <Stat
            label="Delivery rate"
            value={
              stats.total
                ? `${((stats.delivered / stats.total) * 100).toFixed(1)}%`
                : "—"
            }
            icon={Check}
            note="DELIVERED / TOTAL"
          />
          <Stat
            label="Loss rate"
            value={
              stats.total
                ? `${((stats.dropped / stats.total) * 100).toFixed(1)}%`
                : "—"
            }
            icon={ArrowDownRight}
            tone="red"
            note="DROPPED / TOTAL"
          />
        </>
      )}
    </div>
  );
}
function TopologyPanel({
  compact = false,
  tall = false,
}: {
  compact?: boolean;
  tall?: boolean;
}) {
  const { topology, status, activePackets, congestedLinkId, currentRoute } =
    useSimulation();
  return (
    <section className={`panel topology-panel ${tall ? "topology-tall" : ""}`}>
      <PanelHead
        title="Interactive Network Topology"
        detail={`${topology.routers.length} Active Routers · ${topology.links.length} Connected Links · Drag nodes or zoom to explore`}
        action={
          <div className="graph-legend">
            <span><i className="legend-source" />Source</span>
            <span><i className="legend-destination" />Destination</span>
            <span><i className="legend-active" />Active Route</span>
            <span><i className="legend-congested" />Congested</span>
            <span><i className="legend-rerouted" />Rerouted</span>
          </div>
        }
      />
      <TopologyCanvas compact={compact} tall={tall} />
      <div className="graph-footer">
        <span>
          <CircleDot size={13} className="text-cyan-400" />
          {currentRoute.length ? "DYNAMIC DIJKSTRA PATH ACTIVE" : "NETWORK CONNECTED"}
        </span>
        <span>
          {congestedLinkId ? (
            <b className="congestion-text">CONGESTION DETECTED: {congestedLinkId}</b>
          ) : (
            "LINK COST & UTILIZATION READOUT"
          )}
        </span>
      </div>
    </section>
  );
}

export function DashboardPage() {
  const {
    config,
    status,
    topology,
    routes,
    currentRoute,
    initialRoute,
    stats,
  } = useSimulation();
  const load = Math.round(
    (topology.links.reduce(
      (sum, link) => sum + link.traffic / link.capacity,
      0,
    ) /
      topology.links.length) *
      100,
  );
  const congested = topology.links.some((link) => link.state === "congested");
  const currentCost = currentRoute.length
    ? topology.links
        .filter((link) => routeLinkIds(currentRoute).includes(link.id))
        .reduce((sum, link) => sum + link.cost, 0)
    : (routes[0]?.cost ?? 0);
  return (
    <>
      <div className="overview-strip">
        <div className="overview-item">
          <span className="overview-icon">
            <Network size={17} />
          </span>
          <div>
            <small>NETWORK STATUS</small>
            <strong>
              <Badge kind="active">ACTIVE</Badge>
            </strong>
          </div>
        </div>
        <div className="overview-item">
          <span className="overview-icon">
            <Activity size={17} />
          </span>
          <div>
            <small>TRAFFIC LEVEL</small>
            <strong>
              {load}%{" "}
              <span className="overview-caption">average utilization</span>
            </strong>
          </div>
        </div>
        <div className="overview-item">
          <span className="overview-icon">
            <Zap size={17} />
          </span>
          <div>
            <small>CONGESTION</small>
            <strong>
              <Badge kind={congested ? "congested" : "neutral"}>
                {congested ? "Link saturated" : "No congestion"}
              </Badge>
            </strong>
          </div>
        </div>
        <div className="overview-item">
          <span className="overview-icon">
            <CircleDot size={17} />
          </span>
          <div>
            <small>SIMULATION</small>
            <strong>
              <Badge kind={status === "running" ? "live" : "neutral"}>
                {status.toUpperCase()}
              </Badge>
            </strong>
          </div>
        </div>
      </div>
      <Stats includeRates />
      <div className="dashboard-grid">
        <TopologyPanel compact />
        <aside className="panel route-panel">
          <PanelHead
            title="Active route"
            detail={`${config.source} to ${config.destination}`}
            action={
              <span className="route-quick-icon">
                <RouteIcon size={16} />
              </span>
            }
          />
          <div className="route-callout">
            <div className="route-callout-label">
              {status === "completed" ? "REROUTED PATH" : "CURRENT PATH"}
            </div>
            <RouteLine
              route={
                currentRoute.length ? currentRoute : (routes[0]?.routers ?? [])
              }
            />
          </div>
          {status === "completed" && (
            <div className="route-previous">
              <span>INITIAL PATH</span>
              <RouteLine route={initialRoute} muted />
            </div>
          )}
          <div className="route-detail-list">
            <div>
              <span>Route cost</span>
              <strong>
                {currentCost} <small>units</small>
              </strong>
            </div>
            <div>
              <span>Hop count</span>
              <strong>
                {Math.max(
                  0,
                  (currentRoute.length || routes[0]?.routers.length || 1) - 1,
                )}{" "}
                <small>hops</small>
              </strong>
            </div>
            <div>
              <span>Packets delivered</span>
              <strong>
                {stats.delivered} <small>/ {stats.total}</small>
              </strong>
            </div>
          </div>
          <Link className="text-link" href="/route-analysis">
            Explore route options <ArrowRight size={15} />
          </Link>
        </aside>
      </div>
      <div className="bottom-actions">
        <div>
          <span className="bottom-check">
            <Check size={13} />
          </span>
          All {topology.routers.length} routers reachable
          <i />
          Backend topology active
        </div>
        <Link href="/traffic" className="button button-secondary">
          Configure traffic <ArrowRight size={15} />
        </Link>
      </div>
    </>
  );
}

export function TrafficPage() {
  const {
    config,
    updateConfig,
    topology,
    status,
    generateNetwork,
    startSimulation,
    reset,
  } = useSimulation();
  const routers = Array.from(
    { length: config.routerCount },
    (_, i) => `R${i + 1}`,
  );
  return (
    <div className="traffic-layout">
      <section className="panel config-panel">
        <PanelHead
          title="Traffic profile"
          detail="Set the conditions for your network run."
        />
        <div className="form-grid">
          <label className="field-block">
            <span>NUMBER OF ROUTERS</span>
            <div className="input-wrap numeric-input">
              <Network size={15} />
              <input
                type="number"
                min={3}
                max={16}
                value={config.routerCount}
                onChange={(e) =>
                  updateConfig({ routerCount: Number(e.target.value) })
                }
              />
              <small>ROUTERS</small>
            </div>
          </label>
          <div className="field-pair">
            <label className="field-block">
              <span>SOURCE ROUTER</span>
              <div className="input-wrap select-wrap">
                <select
                  value={config.source}
                  onChange={(e) => updateConfig({ source: e.target.value })}
                >
                  {routers
                    .filter((r) => r !== config.destination)
                    .map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                </select>
                <ChevronDown size={15} />
              </div>
            </label>
            <label className="field-block">
              <span>DESTINATION ROUTER</span>
              <div className="input-wrap select-wrap">
                <select
                  value={config.destination}
                  onChange={(e) =>
                    updateConfig({ destination: e.target.value })
                  }
                >
                  {routers
                    .filter((r) => r !== config.source)
                    .map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                </select>
                <ChevronDown size={15} />
              </div>
            </label>
          </div>
          <label className="field-block">
            <span>NUMBER OF PACKETS</span>
            <div className="input-wrap numeric-input">
              <Signal size={15} />
              <input
                type="number"
                min={10}
                max={10000}
                step={10}
                value={config.packets}
                onChange={(e) =>
                  updateConfig({
                    packets: Math.max(10, Number(e.target.value)),
                  })
                }
              />
              <small>PACKETS</small>
            </div>
          </label>
          <div className="field-pair">
            <label className="field-block">
              <span>PACKET SIZE</span>
              <div className="input-wrap numeric-input">
                <input
                  type="number"
                  min={64}
                  max={9000}
                  step={64}
                  value={config.packetSize}
                  onChange={(e) =>
                    updateConfig({
                      packetSize: Math.max(64, Number(e.target.value)),
                    })
                  }
                />
                <small>BYTES</small>
              </div>
            </label>
            <label className="field-block">
              <span>TRAFFIC RATE</span>
              <div className="input-wrap numeric-input">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={config.rate}
                  onChange={(e) =>
                    updateConfig({ rate: Math.max(1, Number(e.target.value)) })
                  }
                />
                <small>PKT / SEC</small>
              </div>
            </label>
          </div>
        </div>
        <div className="form-note">
          <Cpu size={16} />
          <span>
            Congestion threshold and run duration are tuned automatically.
          </span>
        </div>
        <div className="form-actions">
          <button className="button button-secondary" onClick={generateNetwork}>
            <Waypoints size={16} />
            Generate network
          </button>
          <button
            className="button button-primary"
            onClick={startSimulation}
            disabled={status === "running"}
          >
            <Play size={15} fill="currentColor" />
            {status === "running" ? "Simulation running" : "Start simulation"}
          </button>
        </div>
        <button className="reset-button" onClick={reset}>
          <RotateCcw size={14} />
          Reset / new topology
        </button>
      </section>
      <div className="traffic-side">
        <TopologyPanel compact />
        <section className="panel traffic-summary">
          <PanelHead title="Run summary" detail="Current configuration" />
          <div className="summary-row">
            <span>Source → destination</span>
            <strong>
              {config.source} <ArrowRight size={13} /> {config.destination}
            </strong>
          </div>
          <div className="summary-row">
            <span>Payload size</span>
            <strong>
              {((config.packets * config.packetSize) / 1048576).toFixed(2)}{" "}
              <small>MB total</small>
            </strong>
          </div>
          <div className="summary-row">
            <span>Network links</span>
            <strong>
              {topology.links.length} <small>bidirectional</small>
            </strong>
          </div>
          <div className="summary-row">
            <span>Topology state</span>
            <Badge kind="active">CONNECTED</Badge>
          </div>
        </section>
      </div>
    </div>
  );
}

export function SimulationPage() {
  const {
    status,
    startSimulation,
    reset,
    config,
    currentRoute,
    initialRoute,
    activePackets,
    congestedLinkId,
    rerouteCount,
  } = useSimulation();
  return (
    <div className="simulation-command-center">
      <div className="simulation-toolbar panel">
        <div className="simulation-run-state">
          <span className={`run-indicator ${status}`}>
            <i />
          </span>
          <div>
            <strong>
              {status === "running"
                ? "Simulation Live & Transmitting"
                : status === "completed"
                  ? "Simulation Complete"
                  : "Simulation Ready"}
            </strong>
            <small>
              {config.packets} packets · Route: {config.source} → {config.destination}
            </small>
          </div>
        </div>
        <div className="simulation-actions">
          <button className="button button-secondary" onClick={reset}>
            <RotateCcw size={14} />
            New Topology
          </button>
          <button
            className="button button-primary"
            onClick={startSimulation}
            disabled={status === "running"}
          >
            <Play size={14} fill="currentColor" />
            {status === "running" ? "Transmitting..." : "Start Simulation"}
          </button>
        </div>
      </div>
      <div className="simulation-layout">
        <div className="simulation-main">
          <TopologyPanel tall />
          <section className="panel packet-rail">
            <div className="packet-rail-head">
              <div>
                <h2>Live Packet Route Telemetry</h2>
                <span>DYNAMIC DIJKSTRA PATHWAY TRACE</span>
              </div>
              <Badge
                kind={
                  status === "running"
                    ? "live"
                    : status === "completed"
                      ? "active"
                      : "neutral"
                }
              >
                {status === "running"
                  ? "TRANSMITTING"
                  : status === "completed"
                    ? "DELIVERED"
                    : "STANDBY"}
              </Badge>
            </div>
            <div className="packet-flow-track">
              <RouteLine
                route={currentRoute.length ? currentRoute : initialRoute}
              />
              <AnimatePresence>
                {status === "running" &&
                  Array.from({ length: Math.min(8, activePackets || 3) }, (_, i) => (
                    <motion.i
                      key={i}
                      className={`packet-dot packet-${i % 4}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 1, 0], x: [0, 100, 260, 480] }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 3.6,
                        delay: i * 0.35,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  ))}
              </AnimatePresence>
            </div>
            <div className="packet-legend">
              <span>
                <i className="packet-normal" />
                Normal Link
              </span>
              <span>
                <i className="packet-active" />
                Active Flow
              </span>
              <span>
                <i className="packet-rerouted" />
                Dijkstra Rerouted
              </span>
              <span>
                <i className="packet-dropped" />
                Dropped
              </span>
            </div>
          </section>
        </div>
        <aside className="simulation-aside">
          <section className="panel simulation-stats">
            <PanelHead title="Live Telemetry Counters" detail="Updates during the run" />
            <Stats />
            <div className="live-counter">
              <span>Packets in Flight</span>
              <strong>{activePackets.toString().padStart(2, "0")}</strong>
            </div>
            <div className="live-counter">
              <span>Dynamic Reroutes</span>
              <strong>{rerouteCount.toString().padStart(2, "0")}</strong>
            </div>
          </section>
          <section className="panel route-state-panel">
            <PanelHead title="Active Path State" />
            <div className="route-state-block">
              <span className="route-state-tag">INITIAL PATH</span>
              <RouteLine route={initialRoute} muted />
            </div>
            <div className="route-transition">
              <i />
              <span className={rerouteCount > 0 ? "transition-active" : ""} />
            </div>
            <div className="route-state-block">
              <span className="route-state-tag">CURRENT ROUTE</span>
              <RouteLine route={currentRoute} />
            </div>
            <AnimatePresence>
              {congestedLinkId && (
                <motion.div
                  className="congestion-callout"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Zap size={15} />
                  <span>
                    <strong>CONGESTION DETECTED</strong>
                    <small>
                      Link {congestedLinkId.replace("-", " ↔ ")} reached capacity
                    </small>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
          <Link
            href="/results"
            className="button button-secondary results-link"
          >
            View Run Results <ArrowRight size={15} />
          </Link>
        </aside>
      </div>
      <div className="simulation-footnote">
        <span>FASTAPI SIMULATION ENGINE</span>
        <i />
        Real-time telemetry and dynamic Dijkstra rerouting from backend.
      </div>
    </div>
  );
}

export function RouteAnalysisPage() {
  const {
    topology,
    config,
    routes,
    currentRoute,
    initialRoute,
    status,
    congestedLinkId,
  } = useSimulation();
  const active = currentRoute.join("-") || routes[0]?.routers.join("-");
  const initial = initialRoute.join("-");
  const traffic = (route: string[]) => {
    const ids = routeLinkIds(route);
    const links = topology.links.filter((l) => ids.includes(l.id));
    return links.length
      ? Math.round(
          (links.reduce((sum, l) => sum + l.traffic / l.capacity, 0) /
            links.length) *
            100,
        )
      : 0;
  };
  return (
    <>
      <div className="route-summary-grid">
        <section className="panel route-summary-card">
          <span>SOURCE</span>
          <strong>{config.source}</strong>
          <small>Source router</small>
        </section>
        <div className="route-summary-connector">
          <i />
          <ArrowRight size={17} />
          <i />
        </div>
        <section className="panel route-summary-card">
          <span>DESTINATION</span>
          <strong>{config.destination}</strong>
          <small>Destination router</small>
        </section>
        <div className="route-summary-note">
          <RouteIcon size={17} />
          <div>
            <strong>{routes.length} available paths</strong>
            <small>{topology.links.length} links in topology</small>
          </div>
        </div>
      </div>
      <section className="panel route-table-panel">
        <PanelHead
          title="Available paths"
          detail="Cost, hop count, and mean link utilization."
        />
        <div className="route-table-wrap">
          <table className="route-table">
            <thead>
              <tr>
                <th>ROUTE</th>
                <th>COST</th>
                <th>HOPS</th>
                <th>TRAFFIC</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route, i) => {
                const key = route.routers.join("-");
                const current = key === active;
                const blocked = routeLinkIds(route.routers).includes(
                  congestedLinkId ?? "",
                );
                const rate = traffic(route.routers);
                const rerouted = current && initial && key !== initial;
                const state = blocked
                  ? "Congested"
                  : rerouted
                    ? "Rerouted"
                    : current && status === "completed"
                      ? "Active"
                      : current
                        ? "Selected"
                        : rate > 68
                          ? "Elevated"
                          : "Available";
                return (
                  <tr
                    key={`${key}-${i}`}
                    className={current ? "row-current" : ""}
                  >
                    <td>
                      <span className="table-route">
                        <RouteLine route={route.routers} />
                      </span>
                      {key === initial && (
                        <span className="table-route-tag">INITIAL</span>
                      )}
                    </td>
                    <td>{route.cost}</td>
                    <td>{route.routers.length - 1}</td>
                    <td>
                      <div className="traffic-cell">
                        <div className="traffic-track">
                          <i style={{ width: `${Math.max(4, rate)}%` }} />
                        </div>
                        <span>{rate}%</span>
                      </div>
                    </td>
                    <td>
                      <Badge
                        kind={
                          state === "Congested"
                            ? "congested"
                            : state === "Rerouted"
                              ? "rerouted"
                              : state === "Elevated"
                                ? "warning"
                                : state === "Active" || state === "Selected"
                                  ? "active"
                                  : "available"
                        }
                      >
                        {state}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {routes.length === 0 && (
            <div className="empty-state">
              <Network size={22} />
              <strong>No route available</strong>
              <span>Generate a connected network to refresh path options.</span>
            </div>
          )}
        </div>
      </section>
      <div className="route-analysis-foot">
        <span>
          <i className="legend-green" />
          Current path
        </span>
        <span>
          <i className="legend-red" />
          Congested segment
        </span>
        <span>Path cost is the sum of link costs.</span>
      </div>
    </>
  );
}

type ChartPoint = {
  time: string;
  delivered: number;
  loss: number;
  load: number;
  congestion: number;
};

function formatTelemetryChartData(
  history: Array<{
    time: string;
    delivered: number;
    loss: number;
    load: number;
    congestion: number;
  }>,
  deliveryRate: number,
  lossRate: number,
  averageLoad: number,
  congestionEvents: number,
): ChartPoint[] {
  if (history && history.length > 0) {
    return history.map((pt, index) => ({
      time: pt.time || `00:0${index}`,
      delivered: Math.round(pt.delivered),
      loss: Math.round(pt.loss),
      load: Math.round(pt.load),
      congestion: pt.congestion,
    }));
  }
  return [
    { time: "00:00", delivered: 0, loss: 0, load: 0, congestion: 0 },
    {
      time: "00:01",
      delivered: Math.round(deliveryRate),
      loss: Math.round(lossRate),
      load: Math.round(averageLoad),
      congestion: congestionEvents,
    },
  ];
}

function Chart({
  title,
  detail,
  dataKey,
  color,
  unit,
  data,
}: {
  title: string;
  detail: string;
  dataKey: string;
  color: string;
  unit: string;
  data: ChartPoint[];
}) {
  return (
    <section className="panel chart-panel">
      <PanelHead
        title={title}
        detail={detail}
        action={
          <span className="chart-live">
            <i style={{ background: color }} />
            BACKEND TELEMETRY
          </span>
        }
      />
      <div className="chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 12, right: 8, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id={`fill-${dataKey}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="#27302a"
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8fa6c1", fontSize: 10 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8fa6c1", fontSize: 10 }}
              tickFormatter={(value: number) => `${value}${unit}`}
            />
            <Tooltip
              contentStyle={{
                background: "#0b1f3a",
                border: "1px solid #31577f",
                borderRadius: 8,
                color: "#dcebff",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#fill-${dataKey})`}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function ResultsPage() {
  const {
    stats,
    status,
    config,
    initialRoute,
    currentRoute,
    routes,
    rerouteCount,
    topology,
    congestedLinkId,
    telemetryHistory,
  } = useSimulation();
  const delivery = stats.total ? (stats.delivered / stats.total) * 100 : 0;
  const loss = stats.total ? (stats.dropped / stats.total) * 100 : 0;
  const reroutedRate = stats.total ? (stats.rerouted / stats.total) * 100 : 0;
  const currentCost = currentRoute.length
    ? topology.links
        .filter((link) => routeLinkIds(currentRoute).includes(link.id))
        .reduce((sum, link) => sum + link.cost, 0)
    : (routes[0]?.cost ?? 0);
  const congestionEvents =
    status === "completed" && congestedLinkId ? 1 : 0;
  const averageLoad = Math.round(
    (topology.links.reduce(
      (sum, link) => sum + link.traffic / link.capacity,
      0,
    ) /
      topology.links.length) *
      100,
  );
  const chartData = formatTelemetryChartData(
    telemetryHistory,
    delivery,
    loss,
    averageLoad,
    congestionEvents,
  );
  return (
    <>
      <div className="results-summary panel">
        <div className="results-summary-copy">
          <span className="eyebrow">SIMULATION REPORT / FASTAPI</span>
          <h2>
            {status === "completed"
              ? "Run completed successfully"
              : "Ready for your next run"}
          </h2>
          <p>
            {status === "completed"
              ? `Analyzed ${stats.total} packets across ${config.source} to ${config.destination}.`
              : "Start a traffic simulation to populate run-specific metrics."}
          </p>
        </div>
        <div
          className="delivery-gauge"
          style={{ "--gauge-value": `${delivery}%` } as React.CSSProperties}
        >
          <span>
            {delivery.toFixed(1)}
            <small>%</small>
          </span>
          <small>DELIVERY</small>
        </div>
      </div>
      <div className="results-subheading">Packet statistics</div>
      <div className="results-packet-grid">
        <div className="result-metric">
          <span>TOTAL PACKETS</span>
          <strong>{stats.total.toLocaleString()}</strong>
        </div>
        <div className="result-metric">
          <span>DELIVERED</span>
          <strong className="packet-delivered">
            {stats.delivered.toLocaleString()}
          </strong>
        </div>
        <div className="result-metric">
          <span>DROPPED RATE</span>
          <strong className="metric-value-loss">
            {loss.toFixed(1)}%
          </strong>
          <div className="result-support">
            {stats.dropped.toLocaleString()}
            {" "}packets dropped
          </div>
        </div>
        <div className="result-metric">
          <span>REROUTED RATE</span>
          <strong className="metric-value-rerouted">
            {reroutedRate.toFixed(1)}%
          </strong>
          <div className="result-support">
            {stats.rerouted.toLocaleString()}
            {" "}packets rerouted
          </div>
        </div>
      </div>
      <div className="results-subheading">Performance</div>
      <div className="results-metric-grid">
        <div className="result-metric">
          <span>PACKET DELIVERY RATE</span>
          <strong>
            {delivery.toFixed(1)}
            <small>%</small>
          </strong>
          <div className="result-meter">
            <i style={{ width: `${delivery}%` }} />
          </div>
        </div>
        <div className="result-metric">
          <span>PACKET LOSS RATE</span>
          <strong>
            {loss.toFixed(1)}
            <small>%</small>
          </strong>
          <div className="result-meter loss-meter">
            <i style={{ width: `${loss}%` }} />
          </div>
        </div>
        <div className="result-metric">
          <span>AVERAGE ROUTE COST</span>
          <strong>
            {currentCost}
            <small>units</small>
          </strong>
          <div className="result-support">
            Current route across {routes.length} paths
          </div>
        </div>
        <div className="result-metric">
          <span>CONGESTION EVENTS</span>
          <strong>
            {congestionEvents.toString().padStart(2, "0")}
            <small>events</small>
          </strong>
          <div className="result-support">
            {rerouteCount} successful reroutes
          </div>
        </div>
      </div>
      {status === "completed" ? (
        <div className="results-charts">
          <Chart
            title="Packet delivery"
            detail="Cumulative delivery rate"
            dataKey="delivered"
            color="#00d084"
            unit="%"
            data={chartData}
          />
          <Chart
            title="Packet loss"
            detail="Cumulative loss rate"
            dataKey="loss"
            color="#ff3b4e"
            unit="%"
            data={chartData}
          />
          <Chart
            title="Traffic & load"
            detail="Network utilization"
            dataKey="load"
            color="#1683ff"
            unit="%"
            data={chartData}
          />
          <Chart
            title="Congestion events"
            detail="Detected link saturation"
            dataKey="congestion"
            color="#ffb020"
            unit=""
            data={chartData}
          />
        </div>
      ) : (
        <div className="results-chart-empty">
          Complete a simulation to view run charts.
        </div>
      )}
      {stats.total > 0 && (
        <section className="panel route-summary-results">
          <PanelHead
            title="Route summary"
            detail="Path before and after congestion management."
          />
          <div className="route-compare">
            <div>
              <span>INITIAL ROUTE</span>
              <RouteLine route={initialRoute} muted />
            </div>
            <ArrowRight className="compare-arrow" size={18} />
            <div>
              <span>FINAL ROUTE</span>
              <RouteLine route={currentRoute} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
