"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import { BUILDINGS } from "@/lib/buildings";
import {
  canAfford,
  costAtLevel,
  intStatAtLevel,
  MAX_LEVEL,
  statAtLevel,
} from "@/lib/economy";
import { useGameStore } from "@/lib/store";

export function UpgradeModal() {
  const id = useGameStore((s) => s.upgradeModalId);
  const buildings = useGameStore((s) => s.buildings);
  const leaf = useGameStore((s) => s.resources.leaf);
  const close = useGameStore((s) => s.closeUpgradeModal);
  const upgrade = useGameStore((s) => s.upgrade);

  const building = id ? buildings.find((b) => b.id === id) : undefined;
  const open = !!building;

  return (
    <AnimatePresence>
      {open && building && (
        <>
          <motion.div
            key="upgrade-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-black/65"
            aria-hidden
          />
          <motion.div
            key="upgrade-drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            role="dialog"
            aria-label="Upgrade building"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-40 max-h-[70dvh] overflow-y-auto rounded-t-3xl border-t border-gold/30 bg-bg-deep/95 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
          >
            <UpgradePanel
              buildingId={building.id}
              type={building.type}
              level={building.level}
              leaf={leaf}
              onClose={close}
              onUpgrade={() => upgrade(building.id)}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function UpgradePanel({
  buildingId,
  type,
  level,
  leaf,
  onClose,
  onUpgrade,
}: {
  buildingId: string;
  type: keyof typeof BUILDINGS;
  level: number;
  leaf: number;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const def = BUILDINGS[type];
  const isMax = level >= MAX_LEVEL;
  const cost = isMax ? 0 : costAtLevel(def.baseCost, level, def.costMultiplier);
  const afford = canAfford(leaf, cost);

  return (
    <div className="mx-auto max-w-md px-4 pt-3 md:max-w-2xl">
      <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-gold/30" />

      <header className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="relative h-16 w-16 overflow-hidden rounded-lg"
            style={{ backgroundColor: `${def.color}1a` }}
          >
            <Image
              src={def.imagePath}
              alt={def.name}
              fill
              sizes="64px"
              className="object-contain p-1"
              draggable={false}
            />
          </div>
          <div className="flex flex-col leading-none">
            <h2
              className="font-display text-base font-semibold tracking-[0.18em] text-gold"
              style={{ fontFamily: "var(--font-cinzel)" }}
            >
              {def.name.toUpperCase()}
            </h2>
            <p className="mt-1 font-sans text-[10px] uppercase tracking-[0.25em] text-text-muted">
              Level {level}
              {isMax && (
                <span className="ml-2 rounded-full bg-gold px-1.5 py-0.5 text-[8px] font-bold text-bg-deep">
                  MAX
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close upgrade modal"
          className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-bg-mid/60 hover:text-text-primary"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <p className="mt-3 text-[11px] leading-snug text-text-muted">
        {def.description}
      </p>

      <StatComparison type={type} level={level} isMax={isMax} />

      <div className="mt-5">
        {isMax ? (
          <div className="flex w-full items-center justify-center rounded-full border border-gold/40 bg-gold/10 py-3 text-center font-display text-sm font-bold uppercase tracking-[0.25em] text-gold">
            Max Level Reached
          </div>
        ) : (
          <button
            type="button"
            onClick={onUpgrade}
            disabled={!afford}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold py-3 font-display text-sm font-bold uppercase tracking-[0.18em] text-bg-deep shadow-[0_4px_18px_-6px_rgba(212,160,74,0.6)] transition-colors hover:bg-gold-dark active:bg-gold-dark disabled:cursor-not-allowed disabled:bg-gold-muted disabled:text-bg-deep/60 disabled:shadow-none"
          >
            {afford ? (
              <>
                Upgrade to Level {level + 1}
                <span className="font-sans tabular-nums">· {cost} Bloom</span>
              </>
            ) : (
              <>
                Need {cost - leaf} more Bloom
                <span className="font-sans tabular-nums opacity-70">
                  ({cost} total)
                </span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function StatComparison({
  type,
  level,
  isMax,
}: {
  type: keyof typeof BUILDINGS;
  level: number;
  isMax: boolean;
}) {
  const def = BUILDINGS[type];
  const nextLevel = level + 1;

  // Build rows: [{label, current, next}] — only for stats this building actually has.
  const rows: { label: string; current: string; next: string }[] = [];

  if (def.harvestYield !== undefined) {
    rows.push({
      label: "Bloom per harvest",
      current: `+${intStatAtLevel(def.harvestYield, level)}`,
      next: `+${intStatAtLevel(def.harvestYield, nextLevel)}`,
    });
  }
  if (def.growDurationMs !== undefined) {
    rows.push({
      label: "Grow cycle",
      current: `${(def.growDurationMs / 1000).toFixed(0)}s`,
      next: `${(def.growDurationMs / 1000).toFixed(0)}s`,
    });
  }
  if (def.firePerSecond !== undefined) {
    const cur = statAtLevel(def.firePerSecond, level);
    const nxt = statAtLevel(def.firePerSecond, nextLevel);
    rows.push({
      label: "Amber per second",
      current: cur.toFixed(2),
      next: nxt.toFixed(2),
    });
  }

  if (rows.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-gold/15 bg-bg-mid/40 p-3 text-center">
        <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted">
          Effect bonus coming in a future sprint
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-gold/15 bg-bg-mid/40">
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2 text-[9px] uppercase tracking-[0.22em] text-text-muted">
        <span>Stat</span>
        <span className="text-right">Now</span>
        <span aria-hidden />
        <span className="text-right text-gold">
          {isMax ? "Max" : `Lv ${level + 1}`}
        </span>
      </div>
      <div className="divide-y divide-gold/10">
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2 text-xs"
          >
            <span className="text-text-primary">{r.label}</span>
            <span className="font-sans font-semibold tabular-nums text-text-primary">
              {r.current}
            </span>
            <ArrowRight className="h-3 w-3 text-text-muted" />
            <span className="font-sans font-bold tabular-nums text-gold">
              {isMax ? "—" : r.next}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
