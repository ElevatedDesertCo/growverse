"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2 } from "lucide-react";
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
  MAX_LEVEL,
  statAtLevel,
} from "@/lib/economy";
import { playSfx } from "@/lib/systems/audioSystem";
import {
  canAffordUpgrade,
  isMaxLevel,
} from "@/lib/systems/upgradeSystem";
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

interface Particle {
  id: string;
  dx: number;
  dy: number;
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
  const removeBuilding = useGameStore((s) => s.removeBuilding);
  const resources = useGameStore((s) => s.resources);
  const canDelete = editMode && isTapSelected && !BUILDINGS[building.type].singleton;
  const canUpgrade =
    !isMaxLevel(building.type, building.level) &&
    canAffordUpgrade(resources, building.type, building.level);
  // confirm flag — first tap arms, second tap commits
  const [deleteArmed, setDeleteArmed] = useState(false);
  useEffect(() => {
    if (!deleteArmed) return;
    const t = window.setTimeout(() => setDeleteArmed(false), 2200);
    return () => window.clearTimeout(t);
  }, [deleteArmed]);
  useEffect(() => {
    // Reset the arm when the player exits edit mode / deselects.
    // Intentional one-shot setState.
    if (!canDelete) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeleteArmed(false);
    }
  }, [canDelete]);
  const harvest = useGameStore((s) => s.harvest);
  const collectFire = useGameStore((s) => s.collectFire);
  const openUpgradeModal = useGameStore((s) => s.openUpgradeModal);
  // Subscribe to the global tick so time-aware UI redraws ~2/sec.
  // We use _tickAt (set by TickMount every 500ms) as our "now" — pure
  // (derived from store state) so the render stays referentially clean
  // per react-hooks/purity, and refresh cadence is good enough for
  // progress rings + pending-fire badges (collect itself uses Date.now()
  // server-side in the store action, so it's still exact at commit time).
  const tickNow = useGameStore((s) => s._tickAt);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [upgradeGlowKey, setUpgradeGlowKey] = useState(0);
  const prevLevelRef = useRef(building.level);

  // Fire SFX + glow when this building's level increases.
  useEffect(() => {
    if (building.level > prevLevelRef.current) {
      playSfx("upgradeComplete");
      setUpgradeGlowKey((k) => k + 1);
    }
    prevLevelRef.current = building.level;
  }, [building.level]);

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
  // Use the store tick (set by TickMount every 500ms) as "now" so render
  // stays pure per react-hooks/purity. Falls back to 1 for the very first
  // render before TickMount fires — progress reads as 0 briefly, then
  // corrects on the next tick.
  const now = tickNow || 1;
  const hasGrowCycle = def.growDurationMs !== undefined;
  const hasPassiveCollect = def.firePerSecond !== undefined;

  // Color for floater/particles: prefer producesResource color if set,
  // else fall back to the building's own accent color.
  const collectColor = (() => {
    if (!def.producesResource) return def.color;
    const r = def.producesResource;
    if (r === "bloomEssence") return "#7fb069";
    if (r === "amberShards") return "#e8964c";
    if (r === "mycoDust") return "#a875d4";
    return def.color;
  })();

  const growProgress =
    hasGrowCycle && building.plantedAt !== undefined
      ? getGrowProgress(building.plantedAt, def.growDurationMs!, now)
      : undefined;
  const isReady =
    hasGrowCycle && building.plantedAt !== undefined
      ? isReadyToHarvest(building.plantedAt, def.growDurationMs!, now)
      : false;

  const pendingFire =
    hasPassiveCollect && building.lastGenerated !== undefined
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
    setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.id !== id));
    }, 1100);
  };

  const spawnParticles = (color: string) => {
    const burst: Particle[] = Array.from({ length: 5 }, () => ({
      id: crypto.randomUUID(),
      dx: (Math.random() - 0.5) * 50,
      dy: -(20 + Math.random() * 30),
      color,
    }));
    setParticles((prev) => [...prev, ...burst]);
    setTimeout(() => {
      const ids = new Set(burst.map((b) => b.id));
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
    }, 750);
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
    if (hasGrowCycle && isReady) {
      const yieldNow = def.harvestYield
        ? intStatAtLevel(def.harvestYield, building.level)
        : 0;
      spawnFloater(yieldNow, collectColor);
      spawnParticles(collectColor);
      playSfx("resourceCollect");
      harvest(building.id);
      return;
    }
    if (hasPassiveCollect && pendingFire >= 1) {
      spawnFloater(pendingFire, collectColor);
      spawnParticles(collectColor);
      playSfx("resourceCollect");
      collectFire(building.id);
      return;
    }
    playSfx("buttonClick");
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
      className={`group relative z-[3] cursor-pointer rounded-md transition-all duration-150 ease-out hover:scale-[1.04] hover:brightness-110 hover:drop-shadow-[0_0_10px_rgba(212,160,74,0.5)] ${
        phase === "dragging" ? "z-50" : ""
      } ${
        isMenuSelected ? "ring-2 ring-gold/60 ring-inset" : ""
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
      {/* Tap-selected ring — animated gold halo with continuous breathe
          so the selection reads as "this is interactive right now" vs.
          a static border. Two layers: a soft outer glow that pulses
          and an inset ring that stays crisp. */}
      {isTapSelected && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-gold"
          animate={{
            boxShadow: [
              "0 0 14px 1px rgba(212,160,74,0.45), inset 0 0 8px rgba(212,160,74,0.25)",
              "0 0 26px 4px rgba(212,160,74,0.8), inset 0 0 14px rgba(212,160,74,0.45)",
              "0 0 14px 1px rgba(212,160,74,0.45), inset 0 0 8px rgba(212,160,74,0.25)",
            ],
          }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
      )}
      <BuildingTile
        building={building}
        editMode={editMode}
        growProgress={growProgress}
        isReady={isReady}
        pendingFire={pendingFire}
      />

      {/* Desktop hover tooltip — small pill above the building with
          the name, level, and a contextual hint. Hidden during drag /
          edit-mode delete to avoid stacking conflicts. */}
      {phase !== "dragging" && !canDelete && (
        <div
          className="pointer-events-none absolute -top-1 left-1/2 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-bg-deep/95 px-2.5 py-1 opacity-0 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.7)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
          style={{ border: `1px solid ${def.color}80` }}
        >
          <span
            className="font-display text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: def.color, fontFamily: "var(--font-cinzel)" }}
          >
            {def.name}
          </span>
          <span
            className="ml-1.5 rounded-full bg-bg-mid/70 px-1.5 py-px font-sans text-[9px] font-bold tabular-nums text-text-primary"
          >
            Lv {building.level}
            <span className="text-text-muted/70">
              /{def.maxLevel ?? MAX_LEVEL}
            </span>
          </span>
          {!editMode && (
            <span className="ml-1.5 font-sans text-[9px] uppercase tracking-[0.16em] text-text-muted">
              {canUpgrade ? "↑ ready" : isReady ? "✓ collect" : "tap"}
            </span>
          )}
        </div>
      )}

      {showRing && <LongPressRing progress={progress} color={def.color} />}

      {/* Edit-mode delete button. Pops above the building when it's
          selected in edit mode. First tap arms (turns red); second
          tap within 2.2s commits the delete + refund. */}
      {canDelete && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 4, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.18 }}
          onPointerDown={(e) => {
            // Stop the building's pointer chain so we don't init a drag.
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!deleteArmed) {
              setDeleteArmed(true);
              playSfx("locked");
              return;
            }
            playSfx("buttonClick");
            removeBuilding(building.id);
          }}
          aria-label={
            deleteArmed
              ? `Confirm delete ${def.name}`
              : `Delete ${def.name}`
          }
          className={`absolute -top-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border px-2 py-0.5 backdrop-blur transition-colors ${
            deleteArmed
              ? "border-red-400 bg-red-500 text-bg-deep"
              : "border-red-400/60 bg-bg-deep/95 text-red-300 hover:border-red-400 hover:text-red-200"
          }`}
          style={{
            boxShadow: deleteArmed
              ? "0 0 14px rgba(217,87,87,0.85), 0 4px 12px rgba(0,0,0,0.55)"
              : "0 4px 12px rgba(0,0,0,0.5)",
          }}
        >
          <Trash2 className="h-3 w-3" strokeWidth={2.5} />
          <span
            className="font-display text-[9px] font-bold uppercase tracking-[0.16em]"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            {deleteArmed ? "Confirm" : "Delete"}
          </span>
        </motion.button>
      )}

      {/* Upgrade glow — flashes when building.level increases */}
      {upgradeGlowKey > 0 && (
        <motion.div
          key={upgradeGlowKey}
          initial={{ opacity: 0.85, scale: 0.6 }}
          animate={{ opacity: 0, scale: 1.4 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 rounded-md"
          style={{
            background: `radial-gradient(circle, ${def.color}cc 0%, ${def.color}55 35%, transparent 70%)`,
            boxShadow: `0 0 30px 6px ${def.color}88`,
          }}
          aria-hidden
        />
      )}

      {/* Floaters + particles — pointer-events-none overlay */}
      <div className="pointer-events-none absolute inset-0">
        <AnimatePresence>
          {floaters.map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 0, scale: 0.85 }}
              animate={{
                // Two-stage trajectory: pop up briefly, then fly toward
                // the HUD at the top of the screen with a fade-out so it
                // visually "deposits" into the resource bank.
                opacity: [0, 1, 1, 0],
                y: [0, -32, -90, -160],
                scale: [0.85, 1.15, 1.05, 0.7],
              }}
              transition={{
                duration: 1.2,
                ease: "easeOut",
                times: [0, 0.25, 0.7, 1],
              }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-base font-bold leading-none"
              style={{
                color: f.color,
                textShadow:
                  "0 1px 0 rgba(0,0,0,0.7), 0 0 10px rgba(0,0,0,0.6), 0 0 18px " +
                  f.color +
                  "55",
              }}
            >
              +{f.amount}
            </motion.div>
          ))}
          {particles.map((p) => (
            <motion.span
              key={p.id}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{ opacity: 0, x: p.dx, y: p.dy, scale: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                backgroundColor: p.color,
                boxShadow: `0 0 6px ${p.color}`,
              }}
            />
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
