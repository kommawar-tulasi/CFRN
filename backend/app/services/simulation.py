from contextlib import nullcontext
from _thread import RLock as RLockType
from time import sleep
from uuid import uuid4

from app.models.models import (
    Link,
    Packet,
    PacketStatus,
    Router,
    SimulationConfig,
    SimulationEvent,
    SimulationResult,
    SimulationState,
    Topology,
)
from app.services.routing import find_shortest_path


def create_initial_state(
    config: SimulationConfig,
    topology: Topology,
    simulation_id: str | None = None,
) -> SimulationState:
    initial_result = find_shortest_path(
        topology.routers, topology.links, config.source, config.destination
    )
    initial_route = initial_result["path"] if initial_result else []
    initial_cost = float(initial_result["cost"]) if initial_result else 0.0
    packets = [
        Packet(
            id=f"P{index + 1:05d}",
            source=config.source,
            destination=config.destination,
            current_router=config.source,
            route=list(initial_route),
        )
        for index in range(config.number_of_packets)
    ]
    initial_events: list[SimulationEvent] = []
    if initial_route:
        initial_events.append(
            SimulationEvent(
                id=str(uuid4())[:8],
                time=0.0,
                type="route_init",
                title="Dijkstra Shortest Path Computed",
                description=f"Optimal initial route: {' ➔ '.join(initial_route)} (Cost: {initial_cost:.1f})",
                details={"route": list(initial_route), "cost": initial_cost},
            )
        )
    return SimulationState(
        simulation_id=simulation_id or str(uuid4()),
        simulation_status="running",
        config=config,
        routers=topology.routers,
        links=topology.links,
        packets=packets,
        initial_route=list(initial_route),
        active_route=list(initial_route),
        metrics=SimulationResult(total_packets=len(packets)),
        events=initial_events,
    )


def _link_between(links: list[Link], source: str, target: str) -> Link | None:
    return next(
        (
            link
            for link in links
            if {link.source, link.target} == {source, target}
        ),
        None,
    )


def _update_rates(state: SimulationState, rerouted_packet_ids: set[str]) -> None:
    total = len(state.packets)
    delivered = sum(packet.status == PacketStatus.DELIVERED for packet in state.packets)
    dropped = sum(packet.status == PacketStatus.DROPPED for packet in state.packets)
    state.metrics = SimulationResult(
        total_packets=total,
        delivered=delivered,
        dropped=dropped,
        rerouted=len(rerouted_packet_ids),
        delivery_rate=round(delivered / total * 100, 2) if total else 0,
        loss_rate=round(dropped / total * 100, 2) if total else 0,
        congestion_events=state.metrics.congestion_events,
    )


def run_simulation(
    config: SimulationConfig,
    topology: Topology,
    *,
    simulation_id: str | None = None,
    state: SimulationState | None = None,
    state_lock: RLockType | None = None,
    step_delay: float = 0.02,
) -> SimulationState:
    """Run one second-sized traffic window at a time and mutate real packet state."""
    simulation = state or create_initial_state(config, topology, simulation_id)
    lock = state_lock or nullcontext()
    rerouted_packet_ids: set[str] = set()
    congested_link_ids: set[str] = set()
    packets_per_window = config.traffic_rate

    with lock:
        simulation.simulation_status = "running"
        simulation.error = None

    if not simulation.initial_route:
        with lock:
            for packet in simulation.packets:
                packet.status = PacketStatus.DROPPED
            _update_rates(simulation, rerouted_packet_ids)
            simulation.simulation_status = "completed"
            simulation.events.append(
                SimulationEvent(
                    id=str(uuid4())[:8],
                    time=0.0,
                    type="complete",
                    title="No Valid Path Found",
                    description=f"Destination {config.destination} is unreachable from {config.source}.",
                )
            )
        return simulation

    for start in range(0, len(simulation.packets), packets_per_window):
        with lock:
            # Clear window traffic counters for the new window, but retain congestion status
            for link in simulation.links:
                link.traffic = 0
                link.utilization = 0

            # Find active Dijkstra route given currently congested links
            current_best = find_shortest_path(
                simulation.routers,
                simulation.links,
                config.source,
                config.destination,
            )
            if current_best:
                simulation.active_route = list(current_best["path"])

        window = simulation.packets[start : start + packets_per_window]
        for packet in window:
            with lock:
                packet.status = PacketStatus.TRANSMITTING
                packet.current_router = packet.source
                packet.route_index = 0
                packet.route = list(simulation.active_route)
                packet.rerouted = packet.route != simulation.initial_route
                packet.route_history = [list(packet.route)] if packet.route else []
                if packet.rerouted:
                    rerouted_packet_ids.add(packet.id)

            while packet.current_router != packet.destination:
                if packet.route_index + 1 >= len(packet.route):
                    with lock:
                        packet.status = PacketStatus.DROPPED
                    break

                next_router = packet.route[packet.route_index + 1]
                with lock:
                    link = _link_between(
                        simulation.links, packet.current_router, next_router
                    )
                    if link is None:
                        packet.status = PacketStatus.DROPPED
                        break

                    link.traffic += config.packet_size
                    link.utilization = link.traffic / link.capacity * 100

                    if (
                        link.utilization >= config.congestion_threshold
                        and not link.congested
                    ):
                        link.congested = True
                        congested_link_ids.add(link.id)
                        simulation.congested_links = list(congested_link_ids)
                        simulation.metrics.congestion_events += 1

                        simulation.events.append(
                            SimulationEvent(
                                id=str(uuid4())[:8],
                                time=round(simulation.simulation_time, 1),
                                type="congestion",
                                title=f"Congestion Triggered on {link.id}",
                                description=f"Link {link.source} ↔ {link.target} utilization reached {link.utilization:.0f}% (threshold: {config.congestion_threshold}%). Applying Dijkstra penalty (+1000).",
                                details={"link_id": link.id, "utilization": round(link.utilization, 1)},
                            )
                        )

                        global_route = find_shortest_path(
                            simulation.routers,
                            simulation.links,
                            config.source,
                            config.destination,
                        )
                        if global_route:
                            old_route = list(simulation.active_route)
                            simulation.active_route = list(global_route["path"])
                            route_label = "-".join(simulation.active_route)
                            if (
                                simulation.active_route != simulation.initial_route
                                and route_label not in simulation.rerouted_links
                            ):
                                simulation.rerouted_links.append(route_label)

                            if old_route != simulation.active_route:
                                simulation.events.append(
                                    SimulationEvent(
                                        id=str(uuid4())[:8],
                                        time=round(simulation.simulation_time, 1),
                                        type="reroute",
                                        title="Dijkstra Recalculated Alternate Path",
                                        description=f"Traffic rerouted: {' ➔ '.join(simulation.active_route)} (Cost: {float(global_route['cost']):.1f}) bypassing congested {link.id}.",
                                        details={"new_route": list(simulation.active_route), "cost": float(global_route["cost"])},
                                    )
                                )

                        remaining = find_shortest_path(
                            simulation.routers,
                            simulation.links,
                            packet.current_router,
                            packet.destination,
                        )
                        old_remaining = packet.route[packet.route_index :]
                        if remaining and remaining["path"] != old_remaining:
                            packet.route = (
                                packet.route[: packet.route_index]
                                + list(remaining["path"])
                            )
                            packet.rerouted = True
                            packet.route_history.append(list(packet.route))
                            rerouted_packet_ids.add(packet.id)
                            _update_rates(simulation, rerouted_packet_ids)
                            continue

                    # If there is no alternative, a link may carry traffic up to
                    # its capacity; packets beyond capacity are genuinely dropped.
                    if link.traffic > link.capacity:
                        packet.status = PacketStatus.DROPPED
                        break

                    packet.current_router = next_router
                    packet.route_index += 1

                if packet.current_router == packet.destination:
                    with lock:
                        packet.status = PacketStatus.DELIVERED
                        break

            with lock:
                if packet.status == PacketStatus.TRANSMITTING:
                    packet.status = (
                        PacketStatus.DELIVERED
                        if packet.current_router == packet.destination
                        else PacketStatus.DROPPED
                    )
                _update_rates(simulation, rerouted_packet_ids)

        with lock:
            simulation.simulation_time += 1
        if step_delay > 0 and start + packets_per_window < len(simulation.packets):
            sleep(step_delay)

    with lock:
        for packet in simulation.packets:
            if packet.status == PacketStatus.TRANSMITTING:
                packet.status = PacketStatus.DROPPED
        _update_rates(simulation, rerouted_packet_ids)
        simulation.simulation_status = "completed"

        simulation.events.append(
            SimulationEvent(
                id=str(uuid4())[:8],
                time=round(simulation.simulation_time, 1),
                type="complete",
                title="Simulation Completed",
                description=f"Run finalized: {simulation.metrics.delivered} delivered, {simulation.metrics.dropped} dropped, {simulation.metrics.rerouted} rerouted.",
                details={"delivered": simulation.metrics.delivered, "dropped": simulation.metrics.dropped, "rerouted": simulation.metrics.rerouted},
            )
        )

    return simulation