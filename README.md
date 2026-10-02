# CFRN

Congestion-Free Router Networking is a frontend-only network monitoring and routing simulation prototype. It uses local mock data; no backend, database, or real network traffic is involved.

## Run locally

```powershell
npm install
npm run dev
```

Open http://localhost:3000.

## Demo flow

1. Open **Traffic** and choose router endpoints and packet settings.
2. Generate a connected topology, then start a simulation.
3. Follow the packet and route changes in **Simulation**; inspect paths in **Route analysis** and metrics in **Results**.
4. Use **Reset / new topology** to clear the run and generate different links and link properties.

The simulation stages congestion, calculates a mock shortest path, reroutes traffic, and updates packet counters in the browser. State is shared across pages for the current session.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, React Flow, Framer Motion, Lucide React, and Recharts.
