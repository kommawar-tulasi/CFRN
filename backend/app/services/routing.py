import heapq

from app.models.models import Link, Router


def find_shortest_path(
    routers: list[Router],
    links: list[Link],
    source: str,
    destination: str,
) -> dict[str, object] | None:
    """Return the lowest-effective-cost path in the current undirected graph."""
    router_ids = {router.id for router in routers}
    if source not in router_ids or destination not in router_ids:
        return None
    if source == destination:
        return {"path": [source], "cost": 0.0}

    adjacency: dict[str, list[tuple[str, float]]] = {
        router_id: [] for router_id in router_ids
    }
    for link in links:
        if link.source not in router_ids or link.target not in router_ids:
            continue
        adjacency[link.source].append((link.target, link.effective_cost))
        adjacency[link.target].append((link.source, link.effective_cost))

    distances = {router_id: float("inf") for router_id in router_ids}
    previous: dict[str, str] = {}
    distances[source] = 0.0
    queue: list[tuple[float, str]] = [(0.0, source)]

    while queue:
        current_cost, current = heapq.heappop(queue)
        if current_cost != distances[current]:
            continue
        if current == destination:
            break
        for neighbor, edge_cost in adjacency[current]:
            candidate = current_cost + edge_cost
            if candidate < distances[neighbor]:
                distances[neighbor] = candidate
                previous[neighbor] = current
                heapq.heappush(queue, (candidate, neighbor))

    if distances[destination] == float("inf"):
        return None

    path = [destination]
    while path[-1] != source:
        parent = previous.get(path[-1])
        if parent is None:
            return None
        path.append(parent)
    path.reverse()
    return {"path": path, "cost": distances[destination]}