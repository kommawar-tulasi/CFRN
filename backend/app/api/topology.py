from fastapi import APIRouter

from app.models.models import Topology, TopologyRequest
from app.services.topology import generate_topology

router = APIRouter(prefix="/api/topology", tags=["topology"])

latest_topology: Topology | None = None


@router.post("/generate", response_model=Topology)
def generate_network(request: TopologyRequest) -> Topology:
    global latest_topology
    latest_topology = generate_topology(request.number_of_routers, request.packet_size)
    return latest_topology

