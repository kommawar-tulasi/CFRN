import type { BackendTopology } from "./api";

export type Router = { id: string; label: string; x: number; y: number };
export type Link = {
  id: string;
  source: string;
  target: string;
  cost: number;
  bandwidth: number;
  capacity: number;
  traffic: number;
  state: "normal" | "active" | "congested" | "rerouted";
  utilization?: number;
};
export type Topology = { routers: Router[]; links: Link[] };
export type Route = { routers: string[]; cost: number };

const edgeId = (a: string, b: string) => [a, b].sort().join("-");
export const topologySignature = (links: Link[]) => links.map((link) => link.id).sort().join("|");

export function backendTopologyToFrontend(
  backendTopology: BackendTopology,
  activeRoute?: string[],
  congestedLinks?: string[],
  initialRoute?: string[],
  reroutedLinks?: string[],
): Topology {
  const count = Math.max(1, backendTopology.routers.length);
  const routers: Router[] = backendTopology.routers.map((r, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return {
      id: r.id,
      label: r.id,
      x: 360 + Math.cos(angle) * 280,
      y: 275 + Math.sin(angle) * 205,
    };
  });

  const activeLinkIds = activeRoute ? routeLinkIds(activeRoute) : [];
  const congestedSet = new Set(congestedLinks ?? []);

  const isRerouted = Boolean(
    (initialRoute &&
      activeRoute &&
      initialRoute.length > 0 &&
      activeRoute.length > 0 &&
      activeRoute.join("-") !== initialRoute.join("-")) ||
    (reroutedLinks &&
      reroutedLinks.length > 0 &&
      activeRoute &&
      reroutedLinks.includes(activeRoute.join("-")))
  );

  const links: Link[] = backendTopology.links.map((link) => {
    const isCongested = link.congested || congestedSet.has(link.id);
    const isActive = activeLinkIds.includes(link.id);
    const isRerouteLink = isRerouted && isActive;

    let state: "normal" | "active" | "congested" | "rerouted" = "normal";
    if (isCongested) {
      state = "congested";
    } else if (isRerouteLink) {
      state = "rerouted";
    } else if (isActive) {
      state = "active";
    }

    return {
      id: link.id,
      source: link.source,
      target: link.target,
      cost: link.cost,
      bandwidth: link.capacity,
      capacity: link.capacity,
      traffic: link.traffic ?? 0,
      state,
      utilization: link.utilization ?? 0,
    };
  });

  return { routers, links };
}

export function createDeterministicTopology(count: number): Topology {
  const size = Math.max(3, Math.min(count, 16));
  const names = Array.from({ length: size }, (_, i) => `R${i + 1}`);
  const links: Link[] = [];
  for (let i = 0; i < size; i++) {
    const next = (i + 1) % size;
    const a = names[i];
    const b = names[next];
    links.push({
      id: edgeId(a, b),
      source: a,
      target: b,
      cost: 5,
      bandwidth: 1024,
      capacity: 5120,
      traffic: 0,
      state: "normal",
      utilization: 0,
    });
  }
  const routers = names.map((id, i) => {
    const angle = (i / size) * Math.PI * 2 - Math.PI / 2;
    return { id, label: id, x: 360 + Math.cos(angle) * 280, y: 275 + Math.sin(angle) * 205 };
  });
  return { routers, links };
}


export function findRoutes(topology: Topology, source: string, destination: string, excluded: string[] = []): Route[] {
  const graph = new Map<string, Array<{ router: string; cost: number }>>();
  topology.routers.forEach(({ id }) => graph.set(id, []));
  topology.links.filter(({ id }) => !excluded.includes(id)).forEach((link) => {
    graph.get(link.source)?.push({ router: link.target, cost: link.cost });
    graph.get(link.target)?.push({ router: link.source, cost: link.cost });
  });
  const routes: Route[] = [];
  const visit = (at: string, path: string[], cost: number) => {
    if (routes.length >= 80) return;
    if (at === destination) { routes.push({ routers: path, cost }); return; }
    for (const next of graph.get(at) ?? []) if (!path.includes(next.router)) visit(next.router, [...path, next.router], cost + next.cost);
  };
  visit(source, [source], 0);
  return routes.sort((a, b) => a.cost - b.cost).slice(0, 12);
}

export function findShortestRoute(topology: Topology, source: string, destination: string, excluded: string[] = []): Route | null {
  const distance = new Map(topology.routers.map(({ id }) => [id, Infinity]));
  const previous = new Map<string, string>();
  const unvisited = new Set(distance.keys());
  distance.set(source, 0);

  while (unvisited.size > 0) {
    let current: string | undefined;
    for (const router of unvisited) {
      if (current === undefined || (distance.get(router) ?? Infinity) < (distance.get(current) ?? Infinity)) current = router;
    }
    if (current === undefined || !Number.isFinite(distance.get(current))) break;
    if (current === destination) break;
    unvisited.delete(current);
    for (const link of topology.links) {
      if (excluded.includes(link.id)) continue;
      const neighbor = link.source === current ? link.target : link.target === current ? link.source : null;
      if (!neighbor || !unvisited.has(neighbor)) continue;
      const candidate = (distance.get(current) ?? Infinity) + link.cost;
      if (candidate < (distance.get(neighbor) ?? Infinity)) {
        distance.set(neighbor, candidate);
        previous.set(neighbor, current);
      }
    }
  }

  if (!Number.isFinite(distance.get(destination))) return null;
  const path = [destination];
  while (path[0] !== source) {
    const parent = previous.get(path[0]);
    if (!parent) return null;
    path.unshift(parent);
  }
  return { routers: path, cost: distance.get(destination) ?? 0 };
}

export function routeLinkIds(route: string[]) { return route.slice(1).map((id, i) => edgeId(route[i], id)); }