from enum import Enum

from pydantic import BaseModel, Field, computed_field

CONGESTION_PENALTY = 1_000.0


class Router(BaseModel):
    id: str


class Link(BaseModel):
    id: str
    source: str
    target: str
    cost: float = Field(ge=0)
    capacity: float = Field(gt=0)
    traffic: float = Field(default=0, ge=0)
    utilization: float = Field(default=0, ge=0)
    congested: bool = False

    @computed_field
    @property
    def effective_cost(self) -> float:
        if self.congested:
            return self.cost + CONGESTION_PENALTY
        return self.cost


class Topology(BaseModel):
    routers: list[Router]
    links: list[Link]


class PacketStatus(str, Enum):
    QUEUED = "queued"
    TRANSMITTING = "transmitting"
    DELIVERED = "delivered"
    DROPPED = "dropped"


class Packet(BaseModel):
    id: str
    source: str
    destination: str
    current_router: str
    route: list[str] = Field(default_factory=list)
    route_index: int = 0
    status: PacketStatus = PacketStatus.QUEUED
    rerouted: bool = False
    route_history: list[list[str]] = Field(default_factory=list)


class TopologyRequest(BaseModel):
    number_of_routers: int = Field(default=8, ge=3, le=20)
    packet_size: int = Field(default=1024, ge=1, le=1_000_000)


class SimulationConfig(BaseModel):
    number_of_routers: int = Field(default=8, ge=3, le=20)
    source: str = "R1"
    destination: str = "R8"
    number_of_packets: int = Field(default=100, ge=1, le=10_000)
    packet_size: int = Field(default=1024, ge=1, le=1_000_000)
    traffic_rate: int = Field(default=10, ge=1, le=1000)
    congestion_threshold: float = Field(default=80, gt=0, le=100)


class SimulationResult(BaseModel):
    total_packets: int = 0
    delivered: int = 0
    dropped: int = 0
    rerouted: int = 0
    delivery_rate: float = 0
    loss_rate: float = 0
    congestion_events: int = 0


class SimulationEvent(BaseModel):
    id: str
    time: float
    type: str  # "route_init" | "congestion" | "reroute" | "complete"
    title: str
    description: str
    details: dict[str, object] = Field(default_factory=dict)


class SimulationState(BaseModel):
    simulation_id: str
    simulation_status: str = "running"
    simulation_time: float = 0
    config: SimulationConfig
    routers: list[Router]
    links: list[Link]
    packets: list[Packet]
    initial_route: list[str] = Field(default_factory=list)
    active_route: list[str] = Field(default_factory=list)
    congested_links: list[str] = Field(default_factory=list)
    rerouted_links: list[str] = Field(default_factory=list)
    metrics: SimulationResult
    events: list[SimulationEvent] = Field(default_factory=list)
    error: str | None = None