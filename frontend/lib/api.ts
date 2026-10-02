export interface BackendRouter {
  id: string;
}

export interface BackendLink {
  id: string;
  source: string;
  target: string;
  cost: number;
  capacity: number;
  traffic: number;
  utilization: number;
  congested: boolean;
  effective_cost: number;
}

export interface BackendTopology {
  routers: BackendRouter[];
  links: BackendLink[];
}

export interface BackendTopologyRequest {
  number_of_routers: number;
  packet_size?: number;
}

export interface BackendSimulationConfig {
  number_of_routers: number;
  source: string;
  destination: string;
  number_of_packets: number;
  packet_size: number;
  traffic_rate: number;
  congestion_threshold: number;
}

export interface BackendPacket {
  id: string;
  source: string;
  destination: string;
  current_router: string;
  route: string[];
  route_index: number;
  status: "queued" | "transmitting" | "delivered" | "dropped";
  rerouted: boolean;
  route_history: string[][];
}

export interface BackendMetrics {
  total_packets: number;
  delivered: number;
  dropped: number;
  rerouted: number;
  delivery_rate: number;
  loss_rate: number;
  congestion_events: number;
}

export interface BackendSimulationEvent {
  id: string;
  time: number;
  type: "route_init" | "congestion" | "reroute" | "complete" | string;
  title: string;
  description: string;
  details?: Record<string, unknown>;
}

export interface BackendSimulationState {
  simulation_id: string;
  simulation_status: "running" | "completed" | "failed";
  simulation_time: number;
  config: BackendSimulationConfig;
  routers: BackendRouter[];
  links: BackendLink[];
  packets: BackendPacket[];
  initial_route: string[];
  active_route: string[];
  congested_links: string[];
  rerouted_links: string[];
  metrics: BackendMetrics;
  events?: BackendSimulationEvent[];
  error?: string | null;
}

export interface BackendSimulationStartResponse {
  simulation_id: string;
  initial_state: BackendSimulationState;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorDetail = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.detail || errorText;
      } catch {
        // use raw text
      }
      throw new Error(`API ${res.status}: ${errorDetail}`);
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        throw new Error(`Backend unavailable at ${API_BASE}. Please ensure FastAPI is running on port 8000.`);
      }
      throw err;
    }
    throw new Error(String(err));
  }
}

export const api = {
  generateTopology: async (numberOfRouters: number, packetSize: number = 1024): Promise<BackendTopology> => {
    return request<BackendTopology>("/api/topology/generate", {
      method: "POST",
      body: JSON.stringify({
        number_of_routers: numberOfRouters,
        packet_size: packetSize,
      }),
    });
  },

  startSimulation: async (config: BackendSimulationConfig): Promise<BackendSimulationStartResponse> => {
    return request<BackendSimulationStartResponse>("/api/simulation/start", {
      method: "POST",
      body: JSON.stringify(config),
    });
  },

  getSimulationState: async (simulationId: string): Promise<BackendSimulationState> => {
    return request<BackendSimulationState>(`/api/simulation/${simulationId}`, {
      method: "GET",
      cache: "no-store",
    });
  },

  getSimulationResults: async (simulationId: string): Promise<BackendSimulationState> => {
    return request<BackendSimulationState>(`/api/simulation/${simulationId}/results`, {
      method: "GET",
      cache: "no-store",
    });
  },
};
