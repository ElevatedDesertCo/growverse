"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AssetImage } from "./AssetImage";
import { ActionIcon } from "./ActionIcon";
import { ArrowUp, X, ArrowRight } from "lucide-react";
import { BUILDINGS, type ResourceCost } from "@/lib/buildings";
import {
  intStatAtLevel,
  MAX_LEVEL,
  statAtLevel,
} from "@/lib/economy";
import { useGameStore } from "@/lib/store";
import {
  canAffordCost,
  type Resources,
} from "@/lib/systems/resourceSystem";
import { getUpgradeCost } from "@/lib/systems/upgradeSystem";
import { playSfx } from "@/lib/systems/audioSystem";
import { RESOURCES } from "@/lib/data";

function labelFor(field: string): string {
  switch (field as keyof Resources) {
    case "bloomEssence": return "Bloom";
    case "amberShards": return "Amber";
    case "mycoDust": return "Myco";
    case "relicFragments": return "Relic";
    case "spiritSeeds": return "Seeds";
    case "portalEnergy": return "Portal";
    case "guildXp": return "XP";
    case "cardShards": return "Shards";
    default: return field;
  }
}

function colorFor(field: string): string {
  return (
    RESOURCES[field as keyof typeof RESOURCES]?.color ?? "#d4a04a"
  );
}

export function UpgradeModal() {
  const id = useGameStore((s) => s.upgradeModalId);
  const buildings = useGameStore((s) => s.buildings);
  const resources = useGameStore((s) => s.resources);
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
              type={building.type}
              level={building.level}
              resources={resources}
              onClose={close}
              onUpgrade={() => {
                playSfx("buttonClick");
                upgrade(building.id);
                // upgradeComplete SFX fires automatically inside
                // DraggableBuilding when its level changes — no double-play.
              }}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function UpgradePanel({
  type,
  level,
  resources,
  onClose,
  onUpgrade,
}: {
  type: keyof typeof BUILDINGS;
  level: number;
  resources: Resources;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const def = BUILDINGS[type];
  const cap = def.maxLevel ?? MAX_LEVEL;
  const isMax = level >= cap;
  const cost: ResourceCost | null = isMax ? null : getUpgradeCost(type, level);
  const afford = cost !== null && canAffordCost(resources, cost);

  return (
    <div className="mx-auto max-w-md px-4 pt-3 md:max-w-2xl">
      <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-gold/30" />

      <header className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="relative h-16 w-16 overflow-hidden rounded-lg"
            style={{ backgroundColor: `${def.color}1a` }}
          >
            <AssetImage
              assetId={`building.${type}`}
              alt={def.name}
              fill
              sizes="64px"
              className="p-1"
              notDraggable
              placeholderColor={def.color}
              placeholderLabel={def.name}
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

      {!isMax && cost && (
        <div className="mt-4 rounded-xl border border-gold/15 bg-bg-mid/40 p-3">
          <div className="text-[9px] uppercase tracking-[0.22em] text-text-muted">
            Upgrade cost
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold tabular-nums">
            {Object.entries(cost)
              .filter(([, v]) => (v ?? 0) > 0)
              .map(([k, v]) => {
                const have = (resources as unknown as Record<string, number>)[k] ?? 0;
                const enough = have >= (v ?? 0);
                return (
                  <span
                    key={k}
                    className="flex items-baseline gap-1"
                    style={{ color: enough ? colorFor(k) : "#a85a5a" }}
                  >
                    {v}
                    <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
                      {labelFor(k)}
                    </span>
                  </span>
                );
              })}
          </div>
        </div>
      )}

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
            <ActionIcon
              assetId="ui.actionUpgrade"
              alt="Upgrade"
              fallback={ArrowUp}
              size={18}
              className="h-4 w-4"
              strokeWidth={2.5}
            />
            {afford ? `Upgrade to Level ${level + 1}` : "Not enough resources"}
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
    const produces = def.producesResource
      ? labelFor(def.producesResource)
      : "Resource";
    rows.push({
      label: `${produces} per second`,
      current: cur.toFixed(2),
      next: nxt.toFixed(2),
    });
  }
  if (def.storageBonus !== undefined) {
    rows.push({
      label: "Storage bonus",
      current: `+${Math.round(statAtLevel(def.storageBonus, level))}`,
      next: `+${Math.round(statAtLevel(def.storageBonus, nextLevel))}`,
    });
  }
  if (def.health !== undefined) {
    rows.push({
      label: "Health",
      current: `${Math.round(statAtLevel(def.health, level))}`,
      next: `${Math.round(statAtLevel(def.health, nextLevel))}`,
    });
  }
  // Guild Core upgrades unlock the next batch of buildings — show that.
  if (def.type === "guildCore") {
    rows.push({
      label: "Unlocks at next level",
      current: `Core L${level}`,
      next: `Core L${nextLevel}`,
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
