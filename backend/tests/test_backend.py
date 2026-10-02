import unittest

from app.models.models import Link, PacketStatus, Router, SimulationConfig, Topology
from app.services.routing import find_shortest_path
from app.services.simulation import run_simulation
from app.services.topology import generate_topology


def diamond_topology() -> Topology:
    routers = [Router(id=f"R{index}") for index in range(1, 5)]
    links = [
        Link(id="R1-R2", source="R1", target="R2", cost=2, capacity=200),
        Link(id="R2-R4", source="R2", target="R4", cost=2, capacity=200),
        Link(id="R1-R3", source="R1", target="R3", cost=3, capacity=1000),
        Link(id="R3-R4", source="R3", target="R4", cost=3, capacity=1000),
    ]
    return Topology(routers=routers, links=links)


class TopologyTests(unittest.TestCase):
    def test_generated_graph_is_connected_and_changes(self) -> None:
        signatures = set()
        for _ in range(5):
            topology = generate_topology(8, packet_size=100)
            signatures.add(tuple(sorted(link.id for link in topology.links)))
            for router in topology.routers:
                result = find_shortest_path(topology.routers, topology.links, "R1", router.id)
                self.assertIsNotNone(result)
        self.assertEqual(len(signatures), 5)


class RoutingTests(unittest.TestCase):
    def test_dijkstra_uses_cost_and_returns_expected_path(self) -> None:
        topology = diamond_topology()
        result = find_shortest_path(topology.routers, topology.links, "R1", "R4")
        self.assertEqual(result, {"path": ["R1", "R2", "R4"], "cost": 4.0})

    def test_congestion_increases_effective_cost_and_selects_alternative(self) -> None:
        topology = diamond_topology()
        congested = next(link for link in topology.links if link.id == "R2-R4")
        congested.congested = True
        self.assertGreater(congested.effective_cost, congested.cost)
        result = find_shortest_path(topology.routers, topology.links, "R1", "R4")
        self.assertEqual(result, {"path": ["R1", "R3", "R4"], "cost": 6.0})

    def test_missing_route_and_same_router(self) -> None:
        topology = diamond_topology()
        self.assertEqual(
            find_shortest_path(topology.routers, topology.links, "R1", "R1"),
            {"path": ["R1"], "cost": 0.0},
        )
        self.assertIsNone(find_shortest_path(topology.routers, [], "R1", "R4"))


class SimulationTests(unittest.TestCase):
    def test_congestion_reroutes_packet_and_future_packets(self) -> None:
        topology = diamond_topology()
        config = SimulationConfig(
            number_of_routers=4,
            source="R1",
            destination="R4",
            number_of_packets=8,
            packet_size=100,
            traffic_rate=8,
            congestion_threshold=75,
        )
        state = run_simulation(config, topology, step_delay=0)

        congested = next(link for link in state.links if link.id == "R1-R2")
        self.assertTrue(congested.congested)
        self.assertEqual(congested.utilization, 100)
        self.assertEqual(congested.effective_cost, congested.cost + 1000)
        self.assertEqual(state.initial_route, ["R1", "R2", "R4"])
        self.assertEqual(state.active_route, ["R1", "R3", "R4"])
        self.assertTrue(any(packet.rerouted for packet in state.packets))
        self.assertTrue(
            any(packet.route == ["R1", "R3", "R4"] for packet in state.packets)
        )
        self.assertTrue(all(packet.status == PacketStatus.DELIVERED for packet in state.packets))
        self.assertEqual(state.metrics.total_packets, 8)
        self.assertEqual(state.metrics.delivered + state.metrics.dropped, 8)
        self.assertGreater(state.metrics.rerouted, 0)

    def test_low_traffic_does_not_congest_but_high_traffic_does(self) -> None:
        low_config = SimulationConfig(
            number_of_routers=4,
            source="R1",
            destination="R4",
            number_of_packets=8,
            packet_size=100,
            traffic_rate=1,
            congestion_threshold=75,
        )
        high_config = low_config.model_copy(update={"traffic_rate": 8})
        low = run_simulation(low_config, diamond_topology(), step_delay=0)
        high = run_simulation(high_config, diamond_topology(), step_delay=0)
        self.assertEqual(low.metrics.rerouted, 0)
        self.assertEqual(low.metrics.congestion_events, 0)
        self.assertGreater(high.metrics.rerouted, 0)
        self.assertGreater(high.metrics.congestion_events, 0)

    def test_packet_results_come_from_terminal_states(self) -> None:
        topology = Topology(
            routers=[Router(id=f"R{index}") for index in range(1, 4)],
            links=[
                Link(id="R1-R2", source="R1", target="R2", cost=1, capacity=100),
                Link(id="R2-R3", source="R2", target="R3", cost=1, capacity=100),
            ],
        )
        config = SimulationConfig(
            number_of_routers=3,
            source="R1",
            destination="R3",
            number_of_packets=5,
            packet_size=100,
            traffic_rate=5,
            congestion_threshold=50,
        )
        state = run_simulation(config, topology, step_delay=0)
        delivered = sum(packet.status == PacketStatus.DELIVERED for packet in state.packets)
        dropped = sum(packet.status == PacketStatus.DROPPED for packet in state.packets)
        self.assertEqual(state.metrics.total_packets, delivered + dropped)
        self.assertEqual(state.metrics.delivered, delivered)
        self.assertEqual(state.metrics.dropped, dropped)
        self.assertEqual(
            state.metrics.delivery_rate,
            round(delivered / config.number_of_packets * 100, 2),
        )
        self.assertEqual(
            state.metrics.loss_rate,
            round(dropped / config.number_of_packets * 100, 2),
        )


if __name__ == "__main__":
    unittest.main()