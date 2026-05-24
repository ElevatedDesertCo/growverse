"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BUILDINGS } from "@/lib/buildings";
import {
  cellFromClientPoint,
  type PlacedBuilding,
  useGameStore,
} from "@/lib/store";
import {
  getGrowProgress,
  getPendingFire,
  intStatAtLevel,
  isReadyToHarvest,
  statAtLevel,
} from "@/lib/economy";
import { BuildingTile } from "./BuildingTile";

const LONG_PRESS_MS = 2500;
const MOVE_CANCEL_THRESHOLD_PX = 14;

interface Props {
  building: PlacedBuilding;
  isTapSelected: boolean;
  isMenuSelected: boolean;
  /** Called for short taps in normal mode when there's no game-specific action. */
  onPassiveTap: () => void;
}

type Phase = "idle" | "pressing" | "dragging";

interface Floater {
  id: string;
  amount: number;
  color: string;
}

export function DraggableBuilding({
  building,
  isTapSelected,
  isMenuSelected,
  onPassiveTap,
}: Props) {
  const def = BUILDINGS[building.type];
  const startMoveDrag = useGameStore((s) => s.startMoveDrag);
  const setHoverCell = useGameStore((s) => s.setHoverCell);
  const commitDrag = useGameStore((s) => s.commitDrag);
  const cancelDrag = useGameStore((s) => s.cancelDrag);
  const editMode = useGameStore((s) => s.editMode);
  const harvest = useGameStore((s) => s.harvest);
  const collectFire = useGameStore((s) => s.collectFire);
  const openUpgradeModal = useGameStore((s) => s.openUpgradeModal);
  // Subscribe to the global tick so time-aware UI redraws ~2/sec.
  useGameStore((s) => s._tickAt);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [floaters, setFloaters] = useState<Floater[]>([]);

  const startRef = useRef<{
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const elRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ─── Time-aware computed values ──────────────────────────────────────
  const now = Date.now();
  const isGrowTent = def.growDurationMs !== undefined;
  const isAmberForge = def.firePerSecond !== undefined;

  const growProgress =
    isGrowTent && building.plantedAt !== undefined
      ? getGrowProgress(building.plantedAt, def.growDurationMs!, now)
      : undefined;
  const isReady =
    isGrowTent && building.plantedAt !== undefined
      ? isReadyToHarvest(building.plantedAt, def.growDurationMs!, now)
      : false;

  const pendingFire =
    isAmberForge && building.lastGenerated !== undefined
      ? getPendingFire(
          building.lastGenerated,
          statAtLevel(def.firePerSecond!, building.level),
          now,
        )
      : 0;

  // ─── Floater spawn ───────────────────────────────────────────────────
  const spawnFloater = (amount: number, color: string) => {
    const id = crypto.randomUUID();
    setFloaters((prev) => [...prev, { id, amount, color }]);
    // Self-destruct after the exit animation completes.
    setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.id !== id));
    }, 1100);
  };

  // ─── Long-press / drag state machine ─────────────────────────────────
  const reset = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setPhase("idle");
    setProgress(0);
    setOffset({ x: 0, y: 0 });
    startRef.current = null;
    cancelDrag();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (phase !== "idle") return;
    if (e.button !== undefined && e.button !== 0) return;
    elRef.current?.setPointerCapture(e.pointerId);
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
    };
    setPhase("pressing");
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const p = Math.min(elapsed / LONG_PRESS_MS, 1);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPhase("dragging");
        startMoveDrag(building.id);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const start = startRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (phase === "pressing") {
      if (dx * dx + dy * dy > MOVE_CANCEL_THRESHOLD_PX ** 2) {
        reset();
      }
    } else if (phase === "dragging") {
      setOffset({ x: dx, y: dy });
      setHoverCell(cellFromClientPoint(e.clientX, e.clientY));
    }
  };

  const handleShortTap = () => {
    if (editMode) {
      // In edit mode, a tap is a passive selection action (handled by parent).
      onPassiveTap();
      return;
    }

    // Normal mode — strict precedence:
    //   1) harvest (growTent ready)
    //   2) collect (amberForge has pending fire)
    //   3) open upgrade modal (anything else)
    if (isGrowTent && isReady) {
      const yieldNow = def.harvestYield
        ? intStatAtLevel(def.harvestYield, building.level)
        : 0;
      spawnFloater(yieldNow, def.color);
      harvest(building.id);
      return;
    }
    if (isAmberForge && pendingFire >= 1) {
      spawnFloater(pendingFire, "#e8964c");
      collectFire(building.id);
      return;
    }
    openUpgradeModal(building.id);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const wasPressing = phase === "pressing";
    const wasDragging = phase === "dragging";
    try {
      elRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (wasDragging) {
      commitDrag();
      setPhase("idle");
      setProgress(0);
      setOffset({ x: 0, y: 0 });
      startRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    reset();

    if (wasPressing) {
      handleShortTap();
    }
  };

  const onPointerCancel = () => reset();

  const showRing = phase === "pressing";

  return (
    <button
      ref={elRef}
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`${def.name} at ${building.x + 1},${building.y + 1}`}
      className={`group relative cursor-pointer rounded-md transition-shadow ${
        phase === "dragging" ? "z-50" : ""
      } ${
        isTapSelected
          ? "ring-2 ring-gold ring-offset-1 ring-offset-bg-deep shadow-[0_0_18px_rgba(212,160,74,0.55)]"
          : isMenuSelected
            ? "ring-2 ring-gold/60 ring-inset"
            : ""
      }`}
      style={{
        gridColumn: `${building.x + 1} / span ${def.size.w}`,
        gridRow: `${building.y + 1} / span ${def.size.h}`,
        touchAction: "none",
        transform:
          phase === "dragging"
            ? `translate(${offset.x}px, ${offset.y}px) scale(1.05)`
            : undefined,
        opacity: phase === "dragging" ? 0.9 : 1,
      }}
    >
      <BuildingTile
        building={building}
        editMode={editMode}
        growProgress={growProgress}
        isReady={isReady}
        pendingFire={pendingFire}
      />

      {showRing && <LongPressRing progress={progress} color={def.color} />}

      {/* Floaters — render on top of everything, pointer-events-none */}
      <div className="pointer-events-none absolute inset-0">
        <AnimatePresence>
          {floaters.map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 0, scale: 0.85 }}
              animate={{ opacity: 1, y: -40, scale: 1.05 }}
              exit={{ opacity: 0, y: -55 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-base font-bold leading-none"
              style={{
                color: f.color,
                textShadow:
                  "0 1px 0 rgba(0,0,0,0.6), 0 0 8px rgba(0,0,0,0.5)",
              }}
            >
              +{f.amount}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </button>
  );
}

function LongPressRing({
  progress,
  color,
}: {
  progress: number;
  color: string;
}) {
  const r = 45;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - progress);
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="4"
      />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 50 50)"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}
