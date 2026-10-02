from dataclasses import dataclass, field
from threading import RLock

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.models.models import SimulationConfig, SimulationState, Topology
from app.services.simulation import create_initial_state, run_simulation
from app.services.topology import generate_topology

router = APIRouter(prefix="/api/simulation", tags=["simulation"])


class SimulationStartResponse(BaseModel):
    simulation_id: str
    initial_state: SimulationState


@dataclass
class SimulationSession:
    state: SimulationState
    lock: RLock = field(default_factory=RLock)


_sessions: dict[str, SimulationSession] = {}
_sessions_lock = RLock()


def _run_session(session: SimulationSession) -> None:
    state = session.state
    topology = Topology(routers=state.routers, links=state.links)
    try:
        windows = max(1, len(state.packets) // max(1, state.config.traffic_rate))
        # Target ~6.5 s of visible simulation for a normal 100-packet run.
        # step_delay is injected between every consecutive window (N-1 pauses),
        # so we divide the target duration by the window count and clamp:
        #   - min 0.45 s  → shortest pause to keep the UI feeling alive
        #   - max 1.5 s   → prevents low packet counts from stalling too long
        _TARGET_SECONDS = 6.5
        step_delay = max(0.45, min(1.5, _TARGET_SECONDS / windows))
        run_simulation(
            state.config,
            topology,
            state=state,
            state_lock=session.lock,
            step_delay=step_delay,
        )
    except Exception as error:
        with session.lock:
            state.simulation_status = "failed"
            state.error = str(error)


def _get_session(simulation_id: str) -> SimulationSession:
    with _sessions_lock:
        session = _sessions.get(simulation_id)
    if session is None:
        raise HTTPException(status_code=404, detail="simulation not found")
    return session


@router.post("/start", response_model=SimulationStartResponse)
def start_simulation(
    config: SimulationConfig,
    background_tasks: BackgroundTasks,
) -> SimulationStartResponse:
    from app.api import topology as topology_api

    if (
        topology_api.latest_topology is not None
        and len(topology_api.latest_topology.routers) == config.number_of_routers
    ):
        topology = topology_api.latest_topology
    else:
        topology = generate_topology(config.number_of_routers, config.packet_size)

    router_ids = {r.id for r in topology.routers}
    if config.source not in router_ids:
        raise HTTPException(status_code=422, detail="source router is not in the topology")
    if config.destination not in router_ids:
        raise HTTPException(
            status_code=422,
            detail="destination router is not in the topology",
        )

    from uuid import uuid4

    simulation_id = str(uuid4())
    state = create_initial_state(config, topology, simulation_id)
    session = SimulationSession(state=state)
    with _sessions_lock:
        _sessions[simulation_id] = session
    background_tasks.add_task(_run_session, session)
    return SimulationStartResponse(
        simulation_id=simulation_id,
        initial_state=state.model_copy(deep=True),
    )


@router.get("/{simulation_id}", response_model=SimulationState)
def get_simulation_state(simulation_id: str) -> SimulationState:
    session = _get_session(simulation_id)
    with session.lock:
        return session.state.model_copy(deep=True)


@router.get(
    "/{simulation_id}/results",
    response_model=SimulationState,
)
def get_simulation_results(simulation_id: str) -> SimulationState:
    session = _get_session(simulation_id)
    with session.lock:
        if session.state.simulation_status == "running":
            raise HTTPException(status_code=409, detail="simulation is still running")
        return session.state.model_copy(deep=True)
