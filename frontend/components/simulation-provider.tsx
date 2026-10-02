"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  type BackendSimulationEvent,
  type BackendSimulationState,
} from "@/lib/api";
import {
  backendTopologyToFrontend,
  createDeterministicTopology,
  findRoutes,
  type Route,
  type Topology,
} from "@/lib/topology";

export type Config = {
  routerCount: number;
  source: string;
  destination: string;
  packets: number;
  packetSize: number;
  rate: number;
};

export type Stats = {
  total: number;
  delivered: number;
  dropped: number;
  rerouted: number;
};

export type Status = "idle" | "running" | "completed";

export type TelemetryPoint = {
  time: string;
  delivered: number;
  loss: number;
  load: number;
  congestion: number;
};

export type ContextValue = {
  topology: Topology;
  config: Config;
  status: Status;
  stats: Stats;
  currentRoute: string[];
  initialRoute: string[];
  activePackets: number;
  congestedLinkId: string | null;
  congestedLinks: string[];
  reroutedLinks: string[];
  rerouteCount: number;
  routes: Route[];
  simulationId: string | null;
  error: string | null;
  isBackendConnected: boolean;
  telemetryHistory: TelemetryPoint[];
  events: BackendSimulationEvent[];
  updateConfig: (updates: Partial<Config>) => void;
  generateNetwork: () => Promise<void>;
  startSimulation: () => Promise<void>;
  reset: () => Promise<void>;
};

const Context = createContext<ContextValue | null>(null);
const zeroStats: Stats = { total: 0, delivered: 0, dropped: 0, rerouted: 0 };

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config>({
    routerCount: 8,
    source: "R1",
    destination: "R8",
    packets: 100,
    packetSize: 1024,
    rate: 20,
  });

  const [topology, setTopology] = useState<Topology>(() =>
    createDeterministicTopology(8),
  );
  const [status, setStatus] = useState<Status>("idle");
  const [stats, setStats] = useState<Stats>(zeroStats);
  const [currentRoute, setCurrentRoute] = useState<string[]>([]);
  const [initialRoute, setInitialRoute] = useState<string[]>([]);
  const [activePackets, setActivePackets] = useState<number>(0);
  const [congestedLinkId, setCongestedLinkId] = useState<string | null>(null);
  const [congestedLinks, setCongestedLinks] = useState<string[]>([]);
  const [reroutedLinks, setReroutedLinks] = useState<string[]>([]);
  const [rerouteCount, setRerouteCount] = useState<number>(0);
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>([]);
  const [events, setEvents] = useState<BackendSimulationEvent[]>([]);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentSimIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const updateConfig = useCallback((updates: Partial<Config>) => {
    setConfig((old) => {
      const next = { ...old, ...updates };
      if (updates.packets !== undefined) {
        next.packets = Math.max(10, Math.min(10000, Number(updates.packets) || 10));
      }
      if (updates.packetSize !== undefined) {
        next.packetSize = Math.max(64, Math.min(9000, Number(updates.packetSize) || 64));
      }
      if (updates.rate !== undefined) {
        next.rate = Math.max(1, Math.min(500, Number(updates.rate) || 1));
      }
      if (updates.routerCount !== undefined) {
        next.routerCount = Math.max(3, Math.min(16, Number(updates.routerCount) || 3));
        const valid = (router: string) => Number(router.slice(1)) <= next.routerCount;
        if (!valid(next.source)) next.source = "R1";
        if (!valid(next.destination)) next.destination = `R${next.routerCount}`;
        if (next.source === next.destination) {
          next.destination = next.source === "R1" ? `R${next.routerCount}` : "R1";
        }
      }
      return next;
    });
  }, []);

  const generateNetwork = useCallback(async () => {
    stopPolling();
    setStatus("idle");
    setStats(zeroStats);
    setCurrentRoute([]);
    setInitialRoute([]);
    setActivePackets(0);
    setCongestedLinkId(null);
    setCongestedLinks([]);
    setReroutedLinks([]);
    setRerouteCount(0);
    setSimulationId(null);
    currentSimIdRef.current = null;
    setTelemetryHistory([]);
    setEvents([]);

    try {
      const backendTopology = await api.generateTopology(
        config.routerCount,
        config.packetSize,
      );
      const frontendTopology = backendTopologyToFrontend(backendTopology);
      setTopology(frontendTopology);
      setIsBackendConnected(true);
      setError(null);

      const routerIds = backendTopology.routers.map((r) => r.id);
      setConfig((prev) => {
        let newSource = prev.source;
        let newDest = prev.destination;
        if (!routerIds.includes(newSource)) {
          newSource = routerIds[0] ?? "R1";
        }
        if (!routerIds.includes(newDest) || newDest === newSource) {
          newDest = routerIds[routerIds.length - 1] ?? "R2";
        }
        return { ...prev, source: newSource, destination: newDest };
      });
    } catch (err: unknown) {
      setIsBackendConnected(false);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [config.routerCount, config.packetSize, stopPolling]);

  const reset = useCallback(async () => {
    await generateNetwork();
  }, [generateNetwork]);

  const applyBackendState = useCallback((state: BackendSimulationState) => {
    setInitialRoute(state.initial_route);
    setCurrentRoute(state.active_route);
    setStats({
      total: state.metrics.total_packets,
      delivered: state.metrics.delivered,
      dropped: state.metrics.dropped,
      rerouted: state.metrics.rerouted,
    });
    setRerouteCount(state.metrics.rerouted);
    const lastCongested =
      state.congested_links.length > 0
        ? state.congested_links[state.congested_links.length - 1]
        : null;
    setCongestedLinkId(lastCongested);
    setCongestedLinks(state.congested_links ?? []);
    setReroutedLinks(state.rerouted_links ?? []);

    const transmitting = state.packets.filter(
      (p) => p.status === "transmitting",
    ).length;
    setActivePackets(transmitting);

    setTopology(
      backendTopologyToFrontend(
        state,
        state.active_route,
        state.congested_links,
        state.initial_route,
        state.rerouted_links,
      ),
    );

    const timeLabel = `00:${String(Math.round(state.simulation_time)).padStart(2, "0")}`;
    const averageLoad = Math.round(
      state.links.reduce((sum, l) => sum + (l.utilization || 0), 0) /
        Math.max(1, state.links.length),
    );

    setTelemetryHistory((prev) => {
      const nextPoint: TelemetryPoint = {
        time: timeLabel,
        delivered: state.metrics.delivery_rate,
        loss: state.metrics.loss_rate,
        load: averageLoad,
        congestion: state.metrics.congestion_events || state.congested_links.length,
      };
      if (prev.length > 0 && prev[prev.length - 1].time === timeLabel) {
        return [...prev.slice(0, -1), nextPoint];
      }
      return [...prev, nextPoint];
    });

    if (state.events && state.events.length > 0) {
      setEvents(state.events);
    }
  }, []);

  const startSimulation = useCallback(async () => {
    if (status === "running") return;
    stopPolling();
    setError(null);

    try {
      const resp = await api.startSimulation({
        number_of_routers: config.routerCount,
        source: config.source,
        destination: config.destination,
        number_of_packets: config.packets,
        packet_size: config.packetSize,
        traffic_rate: config.rate,
        congestion_threshold: 80,
      });

      const simId = resp.simulation_id;
      setSimulationId(simId);
      currentSimIdRef.current = simId;
      setStatus("running");
      setIsBackendConnected(true);

      const init = resp.initial_state;
      setTelemetryHistory([
        {
          time: "00:00",
          delivered: init.metrics.delivery_rate,
          loss: init.metrics.loss_rate,
          load: Math.round(
            init.links.reduce((sum, l) => sum + (l.utilization || 0), 0) /
              Math.max(1, init.links.length),
          ),
          congestion: init.metrics.congestion_events,
        },
      ]);
      applyBackendState(init);

      pollTimerRef.current = setInterval(async () => {
        if (currentSimIdRef.current !== simId) return;

        try {
          const state = await api.getSimulationState(simId);
          if (currentSimIdRef.current !== simId) return;

          applyBackendState(state);

          if (state.simulation_status === "completed") {
            stopPolling();
            setActivePackets(0);

            try {
              const resultsState = await api.getSimulationResults(simId);
              if (currentSimIdRef.current === simId) {
                applyBackendState(resultsState);
              }
            } catch {
              // state is already updated
            }
            setStatus("completed");
          } else if (state.simulation_status === "failed") {
            stopPolling();
            setActivePackets(0);
            setStatus("idle");
            setError(state.error || "Simulation failed on backend");
          }
        } catch (pollErr: unknown) {
          stopPolling();
          setActivePackets(0);
          setStatus("idle");
          const msg = pollErr instanceof Error ? pollErr.message : String(pollErr);
          setError(msg);
        }
      }, 350);
    } catch (startErr: unknown) {
      setStatus("idle");
      const msg = startErr instanceof Error ? startErr.message : String(startErr);
      setError(msg);
    }
  }, [
    status,
    stopPolling,
    config.routerCount,
    config.source,
    config.destination,
    config.packets,
    config.packetSize,
    config.rate,
    applyBackendState,
  ]);

  useEffect(() => {
    generateNetwork();
    return () => {
      stopPolling();
    };
  }, [generateNetwork, stopPolling]);

  const routes = useMemo(
    () => findRoutes(topology, config.source, config.destination),
    [topology, config.source, config.destination],
  );

  return (
    <Context.Provider
      value={{
        topology,
        config,
        status,
        stats,
        currentRoute,
        initialRoute,
        activePackets,
        congestedLinkId,
        congestedLinks,
        reroutedLinks,
        rerouteCount,
        routes,
        simulationId,
        error,
        isBackendConnected,
        telemetryHistory,
        events,
        updateConfig,
        generateNetwork,
        startSimulation,
        reset,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useSimulation() {
  const value = useContext(Context);
  if (!value) {
    throw new Error("useSimulation must be used inside SimulationProvider");
  }
  return value;
}