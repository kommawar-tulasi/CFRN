"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useSimulation } from "@/components/simulation-provider";
import { routeLinkIds, type Topology } from "@/lib/topology";
import { Maximize2, Minimize2, RotateCcw, Cpu, Zap, Activity, ShieldCheck } from "lucide-react";

type RouterData = {
  label: string;
  role: "SOURCE" | "DESTINATION" | "ROUTER";
  selected: boolean;
  congested: boolean;
  rerouted?: boolean;
  activePacketCount: number;
  connectedLinkCount: number;
};

type Point = { x: number; y: number };
type CanvasSize = { width: number; height: number };
type VisualLayout = {
  positions: Map<string, Point>;
  columns: Map<string, number>;
  height: number;
};

const NODE_WIDTH = 128;
const NODE_HEIGHT = 74;

function routerIdOrder(a: string, b: string) {
  return Number(a.slice(1)) - Number(b.slice(1));
}

function hopDistances(topology: Topology, start: string) {
  const neighbors = new Map(topology.routers.map(({ id }) => [id, [] as string[]]));
  for (const link of topology.links) {
    neighbors.get(link.source)?.push(link.target);
    neighbors.get(link.target)?.push(link.source);
  }
  const distances = new Map(topology.routers.map(({ id }) => [id, Infinity]));
  const queue = [start];
  distances.set(start, 0);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const next of neighbors.get(current) ?? []) {
      if (Number.isFinite(distances.get(next))) continue;
      distances.set(next, (distances.get(current) ?? 0) + 1);
      queue.push(next);
    }
  }
  return { distances, neighbors };
}

function createVisualLayout(
  topology: Topology,
  source: string,
  destination: string,
  width: number,
  minHeight: number
): VisualLayout {
  const fromSource = hopDistances(topology, source).distances;
  const { distances: toDestination, neighbors } = hopDistances(topology, destination);
  const routeDepth = Math.max(1, fromSource.get(destination) ?? 1);
  const columnCapacity = Math.max(3, Math.floor((width - 40) / 180));
  const columnCount = Math.max(3, Math.min(routeDepth + 1, columnCapacity));
  const columns = new Map<string, number>();
  const columnMembers = Array.from({ length: columnCount }, () => [] as string[]);

  for (const router of topology.routers) {
    let column: number;
    if (router.id === source) {
      column = 0;
    } else if (router.id === destination) {
      column = columnCount - 1;
    } else {
      const level = Math.round(
        ((fromSource.get(router.id) ?? 0) - (toDestination.get(router.id) ?? 0) + routeDepth) / 2
      );
      const internalColumns = columnCount - 2;
      const progress = Math.max(0, Math.min(1, (level - 1) / Math.max(1, routeDepth - 1)));
      column = 1 + Math.round(progress * (internalColumns - 1));
    }
    columns.set(router.id, column);
    columnMembers[column].push(router.id);
  }

  columnMembers.forEach((members) => members.sort(routerIdOrder));
  for (let pass = 0; pass < 4; pass += 1) {
    const direction = pass % 2 === 0 ? 1 : -1;
    const start = direction === 1 ? 1 : columnCount - 2;
    const end = direction === 1 ? columnCount - 1 : -1;
    const order = new Map<string, number>();
    columnMembers.forEach((members) => members.forEach((id, index) => order.set(id, index)));

    for (let column = start; column !== end; column += direction) {
      columnMembers[column].sort((a, b) => {
        const score = (id: string) => {
          const adjacent = (neighbors.get(id) ?? []).filter(
            (neighbor) => columns.get(neighbor) !== column
          );
          if (adjacent.length === 0) return order.get(id) ?? 0;
          return (
            adjacent.reduce((sum, neighbor) => sum + (order.get(neighbor) ?? 0), 0) /
            adjacent.length
          );
        };
        return score(a) - score(b) || routerIdOrder(a, b);
      });
      columnMembers[column].forEach((id, index) => order.set(id, index));
    }
  }

  const rowCount = Math.max(...columnMembers.map((members) => members.length), 1);
  const paddingY = NODE_HEIGHT + 24;
  const height = Math.max(minHeight, rowCount * (NODE_HEIGHT + 48) + paddingY * 2);
  const paddingX = NODE_WIDTH / 2 + 32;
  const columnSpacing = Math.max(160, (width - paddingX * 2) / Math.max(1, columnCount - 1));
  const positions = new Map<string, Point>();

  columnMembers.forEach((members, column) => {
    const availableY = Math.max(0, height - paddingY * 2);
    const rowSpacing = members.length > 1 ? availableY / (members.length - 1) : 0;
    members.forEach((id, row) => {
      positions.set(id, {
        x: paddingX + column * columnSpacing - NODE_WIDTH / 2,
        y: (members.length > 1 ? paddingY + row * rowSpacing : height / 2) - NODE_HEIGHT / 2,
      });
    });
  });

  return { positions, columns, height };
}

function RouterNode({ data }: { data: RouterData }) {
  const isSource = data.role === "SOURCE";
  const isDest = data.role === "DESTINATION";
  const isSelected = data.selected;
  const isCongested = data.congested;
  const isRerouted = data.rerouted;

  return (
    <div
      className={`router-node-v2 ${isSource ? "is-source" : ""} ${isDest ? "is-dest" : ""} ${
        isSelected ? (isRerouted ? "is-rerouted" : "is-selected") : ""
      } ${isCongested ? "is-congested" : ""}`}
    >
      {/* 4 Handles for Target connections */}
      <Handle type="target" position={Position.Top} id="target-top" className="node-port port-top" />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className="node-port port-bottom" />
      <Handle type="target" position={Position.Left} id="target-left" className="node-port port-left" />
      <Handle type="target" position={Position.Right} id="target-right" className="node-port port-right" />

      {/* 4 Handles for Source connections */}
      <Handle type="source" position={Position.Top} id="source-top" className="node-port port-top" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="node-port port-bottom" />
      <Handle type="source" position={Position.Left} id="source-left" className="node-port port-left" />
      <Handle type="source" position={Position.Right} id="source-right" className="node-port port-right" />

      <div className="node-header">
        <span className="node-icon">
          <Cpu size={14} />
        </span>
        <span className="node-label">{data.label}</span>
        <span className="node-status-led" />
      </div>

      <div className="node-body">
        <div className="node-role-badge">
          {isSource && <span className="badge-pill pill-source">SRC</span>}
          {isDest && <span className="badge-pill pill-dest">DST</span>}
          {!isSource && !isDest && (
            <span
              className={`badge-pill ${
                isRerouted && isSelected
                  ? "pill-rerouted"
                  : isSelected
                  ? "pill-active"
                  : "pill-idle"
              }`}
            >
              {isRerouted && isSelected ? "REROUTED" : isSelected ? "ACTIVE" : "CORE"}
            </span>
          )}
        </div>

        {data.activePacketCount > 0 && (
          <div className="node-pkt-badge">
            <Zap size={10} />
            <span>{data.activePacketCount} pkts</span>
          </div>
        )}
      </div>

      {isCongested && (
        <div className="node-congested-alert">
          <Activity size={10} />
          <span>Saturated</span>
        </div>
      )}
    </div>
  );
}

function CanvasContent({
  compact,
  isFullscreen,
  onToggleFullscreen,
}: {
  compact: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const {
    topology,
    config,
    currentRoute,
    initialRoute,
    routes,
    status,
    congestedLinkId,
    congestedLinks,
    reroutedLinks,
    rerouteCount,
  } = useSimulation();
  const { fitView } = useReactFlow();

  const activeRoute = currentRoute.length
    ? currentRoute
    : routes[0]?.routers ?? currentRoute;
  const active = routeLinkIds(activeRoute);
  const initialLinkIds = initialRoute.length ? routeLinkIds(initialRoute) : [];

  const isRerouted = Boolean(
    (initialRoute.length > 0 &&
      activeRoute.length > 0 &&
      activeRoute.join("-") !== initialRoute.join("-")) ||
    (reroutedLinks && reroutedLinks.length > 0 && reroutedLinks.includes(activeRoute.join("-"))) ||
    rerouteCount > 0
  );

  // Parse the last alternate route (different from initial) that was actually used during rerouting.
  // Used post-completion to show a purple dashed path even when activeRoute has reverted to initial.
  const lastReroutedPath = useMemo(() => {
    if (
      status !== "completed" ||
      rerouteCount === 0 ||
      !reroutedLinks ||
      reroutedLinks.length === 0
    ) {
      return [] as string[];
    }
    const initialKey = initialRoute.join("-");
    // Prefer the most recent alternate that differs from the initial route
    const lastAlternate = [...reroutedLinks].reverse().find((k) => k !== initialKey);
    const label = lastAlternate ?? reroutedLinks[reroutedLinks.length - 1];
    // Labels are stored as "R1-R3-R8" (router IDs joined with "-")
    return label.split("-").filter(Boolean);
  }, [status, rerouteCount, reroutedLinks, initialRoute]);

  const lastReroutedLinkIds = useMemo(
    () => routeLinkIds(lastReroutedPath),
    [lastReroutedPath]
  );

  // True only post-completion when we have a resolved alternate path to highlight
  const isPostCompletionReroute =
    status === "completed" && rerouteCount > 0 && lastReroutedLinkIds.length > 0;

  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const defaultHeight = isFullscreen
    ? window.innerHeight - 100
    : compact
    ? 380
    : 620;

  const layout = useMemo(
    () =>
      createVisualLayout(
        topology,
        config.source,
        config.destination,
        canvasSize.width || (compact ? 800 : 1200),
        canvasSize.height || defaultHeight
      ),
    [topology, config.source, config.destination, canvasSize, compact, defaultHeight]
  );

  const nodes = useMemo<Node<RouterData>[]>(
    () =>
      topology.routers.map((router) => {
        const isCongested = topology.links.some(
          (l) =>
            (l.source === router.id || l.target === router.id) &&
            (l.state === "congested" ||
              (congestedLinks && congestedLinks.includes(l.id)) ||
              l.id === congestedLinkId)
        );
        const isRouteMember = activeRoute.includes(router.id);
        // Post-completion: also highlight nodes that were on the last rerouted alternate path
        const isOnLastRerouted = isPostCompletionReroute && lastReroutedPath.includes(router.id);

        return {
          id: router.id,
          type: "router",
          position: layout.positions.get(router.id) ?? { x: router.x, y: router.y },
          data: {
            label: router.label,
            role:
              router.id === config.source
                ? "SOURCE"
                : router.id === config.destination
                ? "DESTINATION"
                : "ROUTER",
            selected: isRouteMember || isOnLastRerouted,
            congested: isCongested && !isOnLastRerouted,
            rerouted: (isRerouted && isRouteMember) || isOnLastRerouted,
            activePacketCount: isRouteMember && status === "running" ? 1 : 0,
            connectedLinkCount: topology.links.filter(
              (l) => l.source === router.id || l.target === router.id
            ).length,
          },
        };
      }),
    [
      topology.routers,
      topology.links,
      config.source,
      config.destination,
      activeRoute,
      layout.positions,
      status,
      congestedLinkId,
      congestedLinks,
      isRerouted,
      isPostCompletionReroute,
      lastReroutedPath,
    ]
  );

  const edges = useMemo<Edge[]>(
    () =>
      topology.links.map((link, index) => {
        // Post-completion: last alternate path takes highest visual priority (overrides congested red)
        const isLastReroutedEdge = isPostCompletionReroute && lastReroutedLinkIds.includes(link.id);

        const congested = !isLastReroutedEdge && Boolean(
          link.id === congestedLinkId ||
            link.state === "congested" ||
            (congestedLinks && congestedLinks.includes(link.id))
        );

        // Purple: either the post-completion last alternate, or the live rerouted active path
        const isReroutedEdge =
          isLastReroutedEdge ||
          (!congested && isRerouted && (active.includes(link.id) || link.state === "rerouted"));

        // Normal active route when not rerouted
        const isActiveEdge =
          !congested && !isReroutedEdge && (active.includes(link.id) || link.state === "active");

        // Initial route edges that were bypassed during rerouting
        const isInitialEdge =
          !congested && !isReroutedEdge && isRerouted && initialLinkIds.includes(link.id);

        const edgeClassName = congested
          ? "edge-congested"
          : isReroutedEdge
          ? "edge-rerouted"
          : isActiveEdge
          ? "edge-active"
          : isInitialEdge
          ? "edge-initial"
          : "edge-normal";

        const sourcePoint = layout.positions.get(link.source);
        const targetPoint = layout.positions.get(link.target);

        const dx = (targetPoint?.x ?? 0) - (sourcePoint?.x ?? 0);
        const dy = (targetPoint?.y ?? 0) - (sourcePoint?.y ?? 0);

        let sourceHandle = "source-right";
        let targetHandle = "target-left";

        if (Math.abs(dx) >= Math.abs(dy)) {
          if (dx >= 0) {
            sourceHandle = "source-right";
            targetHandle = "target-left";
          } else {
            sourceHandle = "source-left";
            targetHandle = "target-right";
          }
        } else {
          if (dy >= 0) {
            sourceHandle = "source-bottom";
            targetHandle = "target-top";
          } else {
            sourceHandle = "source-top";
            targetHandle = "target-bottom";
          }
        }

        return {
          id: link.id,
          source: link.source,
          target: link.target,
          sourceHandle,
          targetHandle,
          type: "smoothstep",
          className: edgeClassName,
          pathOptions: { offset: 28 + (index % 3) * 10, borderRadius: 16 },
          animated: (isReroutedEdge || isActiveEdge) && status === "running",
          style: {
            stroke: congested
              ? "#ff2a5f"
              : isReroutedEdge
              ? "#a855f7"
              : isActiveEdge
              ? "#00f0ff"
              : isInitialEdge
              ? "#00f0ff33"
              : "#1e3a5f",
            strokeWidth: congested || isReroutedEdge || isActiveEdge ? 3.5 : 2,
            strokeLinecap: "round",
            strokeDasharray: congested
              ? "6 5"
              : isReroutedEdge
              ? "8 6"
              : isInitialEdge
              ? "4 4"
              : undefined,
            filter: congested
              ? "drop-shadow(0px 0px 8px rgba(255, 42, 95, 0.55))"
              : isReroutedEdge
              ? "drop-shadow(0px 0px 8px rgba(168, 85, 247, 0.6))"
              : isActiveEdge
              ? "drop-shadow(0px 0px 6px rgba(0, 240, 255, 0.45))"
              : undefined,
          },
        };
      }),
    [
      topology.links,
      active,
      initialLinkIds,
      isRerouted,
      status,
      congestedLinkId,
      congestedLinks,
      layout,
      isPostCompletionReroute,
      lastReroutedLinkIds,
    ]
  );

  const handleResetView = useCallback(() => {
    fitView({ padding: 0.18, duration: 400 });
  }, [fitView]);

  return (
    <div
      ref={canvasRef}
      className={`topology-canvas-v2 ${compact ? "canvas-compact" : ""} ${
        isFullscreen ? "canvas-fullscreen" : ""
      }`}
      style={{ height: isFullscreen ? "100vh" : layout.height }}
    >
      <div className="canvas-hud-toolbar">
        <div className="hud-status">
          <span className="hud-badge">
            <ShieldCheck size={13} className="text-emerald-400" />
            <span>{topology.routers.length} ROUTERS ACTIVE</span>
          </span>
          <span className="hud-divider" />
          <span className="hud-badge">
            <Activity size={13} className="text-cyan-400" />
            <span>{topology.links.length} CONNECTED LINKS</span>
          </span>
        </div>

        <div className="hud-actions">
          <button
            type="button"
            className="hud-btn"
            onClick={handleResetView}
            title="Reset Zoom & Pan"
          >
            <RotateCcw size={14} />
            <span>Reset View</span>
          </button>
          <button
            type="button"
            className="hud-btn hud-btn-primary"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
          </button>
        </div>
      </div>

      <ReactFlow
        key={`${topology.links.map(({ id }) => id).sort().join("|")}-${config.source}-${
          config.destination
        }-${Math.round(canvasSize.width)}-${layout.height}-${isFullscreen ? "fs" : "nor"}`}
        nodes={nodes}
        edges={edges}
        nodeTypes={{ router: RouterNode }}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1.15 }}
        minZoom={0.35}
        maxZoom={2.0}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background color="#0f2942" gap={28} size={1.2} />
        <Controls showInteractive={true} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}

export function TopologyCanvas({
  compact = false,
  tall = false,
}: {
  compact?: boolean;
  tall?: boolean;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  return (
    <ReactFlowProvider>
      <div className={isFullscreen ? "topology-fullscreen-overlay" : ""}>
        <CanvasContent
          compact={compact}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>
    </ReactFlowProvider>
  );
}

