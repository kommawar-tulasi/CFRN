"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSimulation } from "@/components/simulation-provider";

function formatRate(value: number, total: number) {
  if (!total) return "0%";
  return `${Number(((value / total) * 100).toFixed(1))}%`;
}

export function SimulationCompletedDialog() {
  const { status, stats } = useSimulation();
  const [open, setOpen] = useState(false);
  const sawRunning = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const packetsFinalized = stats.total > 0 && stats.delivered + stats.dropped === stats.total;

  useEffect(() => {
    if (status === "running") {
      sawRunning.current = true;
      return;
    }
    if (status === "idle") {
      sawRunning.current = false;
      return;
    }
    if (status === "completed" && sawRunning.current && packetsFinalized) {
      sawRunning.current = false;
      previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    }
  }, [status, packetsFinalized]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const duration = reduceMotion ? 0 : 0.2;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="completion-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
        >
          <motion.section
            className="completion-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="completion-title"
            aria-describedby="completion-description"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
          >
            <button
              ref={closeButton}
              className="completion-close"
              type="button"
              aria-label="Close notification"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
            <div className="completion-heading">
              <span className="completion-success-icon"><Check size={21} strokeWidth={2.5} /></span>
              <div>
                <h2 id="completion-title">Simulation Completed</h2>
                <p id="completion-description">The simulation has finished successfully.</p>
              </div>
            </div>
            <div className="completion-statistics" aria-label="Final simulation statistics">
              <div><span>Total Packets</span><strong>{stats.total.toLocaleString()}</strong></div>
              <div><span>Delivered</span><strong className="completion-delivered">{stats.delivered.toLocaleString()}</strong></div>
              <div><span>Dropped</span><strong className="completion-dropped">{stats.dropped.toLocaleString()}</strong></div>
              <div><span>Rerouted</span><strong className="completion-rerouted">{stats.rerouted.toLocaleString()}</strong></div>
              <div><span>Delivery Rate</span><strong className="completion-delivered">{formatRate(stats.delivered, stats.total)}</strong></div>
              <div><span>Loss Rate</span><strong className="completion-dropped">{formatRate(stats.dropped, stats.total)}</strong></div>
            </div>
            <div className="completion-actions">
              <Link className="button button-primary" href="/results" onClick={() => setOpen(false)}>
                View Results
              </Link>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}