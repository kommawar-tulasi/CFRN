"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  CircleDot,
  Gauge,
  Network,
} from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useSimulation } from "@/components/simulation-provider";

const nav = [
  ["Dashboard", "/", Gauge],
  ["Traffic", "/traffic", Activity],
  ["Simulation", "/simulation", Network],
  ["Route Analysis", "/route-analysis", ArrowLeftRight],
  ["Results", "/results", BarChart3],
] as const;
const titles: Record<string, [string, string]> = {
  "/": [
    "Dashboard",
    "Overview of network status, traffic, and simulation results.",
  ],
  "/traffic": [
    "Traffic setup",
    "Shape a workload and generate a fresh topology.",
  ],
  "/simulation": [
    "Live simulation",
    "Watch packets traverse, congest, and reroute.",
  ],
  "/route-analysis": [
    "Route Analysis",
    "Compare available routes between the selected routers.",
  ],
  "/results": ["Run results", "A clear readout of the latest simulation."],
};

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { status, topology, isBackendConnected, error, generateNetwork } =
    useSimulation();
  const [title, subtitle] = titles[path] ?? titles["/"];
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark">
            <Network size={19} />
          </span>
          <span>
            <strong>CFRN</strong>
            <small>ROUTING CONSOLE</small>
          </span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Primary navigation">
          {nav.map(([label, href, Icon]) => (
            <Link
              href={href}
              key={href}
              className={`nav-link ${path === href ? "is-active" : ""}`}
            >
              <Icon size={17} />
              <span>{label}</span>
              {path === href && (
                <motion.i layoutId="nav-indicator" className="nav-indicator" />
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-network">
            <div className="sidebar-network-head">
              <span>FASTAPI BACKEND</span>
              <CircleDot
                size={13}
                color={isBackendConnected ? "#00d084" : "#ff3b4e"}
              />
            </div>
            <strong>{topology.routers.length} routers</strong>
            <span>{topology.links.length} connected links</span>
          </div>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">
              <Network size={17} />
            </span>
            <strong>CFRN</strong>
          </div>
          <div className="breadcrumb">
            <span>NETWORK</span>
            <i>/</i>
            <strong>{title.toUpperCase()}</strong>
          </div>
          <div className="topbar-state">
            <span
              className={`state-dot ${status === "running" ? "state-dot-live" : isBackendConnected ? "" : "state-dot-offline"}`}
              style={{
                backgroundColor: !isBackendConnected
                  ? "#ff3b4e"
                  : status === "running"
                    ? "#00d084"
                    : "#1683ff",
              }}
            />
            {status === "running"
              ? "SIMULATION LIVE"
              : isBackendConnected
                ? "FASTAPI READY"
                : "BACKEND OFFLINE"}
            <span className="topbar-divider" />
            <span
              className="topbar-time"
              style={{
                color: isBackendConnected ? "#8fa6c1" : "#ff8591",
              }}
            >
              {isBackendConnected ? "FASTAPI CONNECTED" : "BACKEND OFFLINE"}
            </span>
          </div>
        </header>
        <div className="page-content">
          <motion.div
            key={path}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24 }}
          >
            <div className="page-heading">
              <div>
                <div className="eyebrow">CFRN / CONTROL PLANE</div>
                <h1>{title}</h1>
                <p>{subtitle}</p>
              </div>
              <div className="heading-meta">
                <i
                  className="meta-pulse"
                  style={{
                    backgroundColor: isBackendConnected ? "#00d084" : "#ff3b4e",
                  }}
                />
                {isBackendConnected ? "FASTAPI BACKEND" : "BACKEND OFFLINE"}
              </div>
            </div>
            {error && (
              <div
                role="alert"
                style={{
                  background: "rgba(255, 59, 78, 0.12)",
                  border: "1px solid #ff3b4e",
                  color: "#ff8591",
                  padding: "12px 18px",
                  borderRadius: "8px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  fontSize: "13px",
                }}
              >
                <div>
                  <strong>Backend Connection Error:</strong> {error}
                </div>
                <button
                  type="button"
                  onClick={() => generateNetwork()}
                  style={{
                    background: "#ff3b4e",
                    color: "#fff",
                    border: "none",
                    padding: "6px 14px",
                    borderRadius: "4px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  Retry Connection
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
