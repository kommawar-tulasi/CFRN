# CFRN FastAPI Backend

This is a standalone, in-memory network simulation API. It has no database and does not connect to the Next.js frontend.

## Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app creation + router registration
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py    # Pydantic models (Router, Link, Packet, …)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── topology.py  # Graph generation
│   │   ├── routing.py   # Dijkstra shortest-path
│   │   └── simulation.py# Packet simulation, congestion, rerouting
│   └── api/
│       ├── __init__.py
│       ├── topology.py  # POST /api/topology/generate
│       └── simulation.py# POST /api/simulation/start, GET /api/simulation/{id}
├── tests/
│   └── test_backend.py
├── requirements.txt
└── README.md
```

## Run

From the `backend/` directory in PowerShell:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Swagger UI is available at http://127.0.0.1:8000/docs.

## API

`POST /api/topology/generate`

```json
{"number_of_routers": 8, "packet_size": 1024}
```

`POST /api/simulation/start`

```json
{
  "number_of_routers": 8,
  "source": "R1",
  "destination": "R8",
  "number_of_packets": 100,
  "packet_size": 1024,
  "traffic_rate": 10,
  "congestion_threshold": 80
}
```

The response contains `simulation_id` and the initial state. Poll `GET /api/simulation/{simulation_id}` for current routers, links, packets, routes, congestion, and metrics. `GET /api/simulation/{simulation_id}/results` returns the final state and result metrics, or HTTP 409 while the run is active.

Sessions exist in process memory and are lost when the server restarts.

## Simulation model

Traffic rate is the number of packets generated in each simulated one-second window. Link traffic accumulates in bytes during that window; utilization is `traffic / capacity * 100`. At or above the configured threshold, a link is marked congested and its effective Dijkstra weight becomes its base cost plus 1000. The link remains in the graph. The current packet is recalculated from its current router before crossing the newly congested link, while subsequent packets use the updated active route. Links reset their window traffic at the next simulated second, allowing the original shortest route to become attractive again when load clears.

Packets carry their own current router, route, route index, status, and reroute flag. Delivered, dropped, and rerouted totals are derived from those packet records. Capacity-overflow packets are dropped when no route change moves them to an available link.

## Tests

Run from the `backend/` directory:

```powershell
python -m pytest tests/
```