import random

from app.models.models import Link, Router, Topology


def generate_topology(number_of_routers: int, packet_size: int = 1024) -> Topology:
    """Generate a connected undirected graph with randomized link properties."""
    if not 3 <= number_of_routers <= 20:
        raise ValueError("number_of_routers must be between 3 and 20")

    router_ids = [f"R{index}" for index in range(1, number_of_routers + 1)]
    connection_order = router_ids.copy()
    random.shuffle(connection_order)

    connections: set[tuple[str, str]] = set()
    for index, router_id in enumerate(connection_order):
        next_router = connection_order[(index + 1) % number_of_routers]
        connections.add(tuple(sorted((router_id, next_router))))

    possible_connections = number_of_routers * (number_of_routers - 1) // 2
    target_links = min(
        possible_connections,
        number_of_routers + random.randint(1, max(1, number_of_routers // 2)),
    )
    while len(connections) < target_links:
        source, target = random.sample(router_ids, 2)
        connections.add(tuple(sorted((source, target))))

    routers = [Router(id=router_id) for router_id in router_ids]
    links = []
    for source, target in sorted(connections):
        cost = random.randint(2, 20)
        capacity = packet_size * random.randint(4, 12)
        links.append(
            Link(
                id=f"{source}-{target}",
                source=source,
                target=target,
                cost=cost,
                capacity=capacity,
            )
        )

    return Topology(routers=routers, links=links)