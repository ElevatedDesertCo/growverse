"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Coins, Flame, Leaf, Sparkles, Hexagon, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RESOURCES } from "@/lib/data";
import { useGameStore } from "@/lib/store";
import { getTotalStorageBonus } from "@/lib/systems/buildingSystem";
import {
  isCapped,
  maxFor,
  type Resources,
} from "@/lib/systems/resourceSystem";
import { SettingsButton } from "./SettingsButton";

/**
 * HUD top bar: identity row + scrollable resource pill rail.
 *
 * Pure CSS implementation — no raw painted PNG composites. Each pill is
 * a self-contained dark-glass card with gold trim and a per-resource
 * neon accent glow. Layout: identity row above, 6 pills below. The rail
 * wraps to a horizontal-scroll strip on narrow viewports so all six
 * resources stay reachable on mobile without crushing layout.
 */

interface ResourceSpec {
  field: keyof Resources;
  short: string;
  full: string;
  /** Hex accent — drives glow + digits. */
  accent: string;
  /** Lucide icon used as a clean placeholder until painted art lands. */
  Icon: LucideIcon;
}

const RESOURCE_PILLS: ResourceSpec[] = [
  { field: "bloomEssence",   short: "Bloom",  full: "Bloom Essence",   accent: "#7fb069", Icon: Leaf },
  { field: "amberShards",    short: "Amber",  full: "Amber Shards",    accent: "#e8964c", Icon: Flame },
  { field: "mycoDust",       short: "Myco",   full: "Myco Dust",       accent: "#a875d4", Icon: Sparkles },
  { field: "relicFragments", short: "Relic",  full: "Relic Fragments", accent: "#c9a878", Icon: Coins },
  { field: "spiritSeeds",    short: "Seeds",  full: "Spirit Seeds",    accent: "#9ed16e", Icon: Hexagon },
  { field: "portalEnergy",   short: "Portal", full: "Portal Energy",   accent: "#b78ddf", Icon: Zap },
];

function ResourcePill({
  spec,
  value,
  max,
}: {
  spec: ResourceSpec;
  value: number;
  max: number | null;
}) {
  const { Icon, accent, short, full, field } = spec;
  const atCap = max !== null && value >= max;
  const display = value.toLocaleString();
  const maxDisplay = max !== null ? max.toLocaleString() : null;
  const resourceDef = RESOURCES[field as keyof typeof RESOURCES];

  // Tooltip open state — hover (desktop) + long-press (mobile).
  const [tipOpen, setTipOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        window.clearTimeout(longPressTimer.current);
      }
    };
  }, []);
  const startLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      setTipOpen(true);
      longPressTimer.current = null;
    }, 350);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div
      className={`group relative flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full border bg-bg-deep/85 pl-1 pr-2.5 backdrop-blur transition-colors ${
        atCap
          ? "border-red-400/60 ring-1 ring-red-500/30"
          : "border-gold/35 hover:border-gold/55"
      }`}
      onMouseEnter={() => setTipOpen(true)}
      onMouseLeave={() => {
        cancelLongPress();
        setTipOpen(false);
      }}
      onPointerDown={(e) => {
        // Long-press on touch only; mouse handled via hover.
        if (e.pointerType === "touch") startLongPress();
      }}
      onPointerUp={() => {
        cancelLongPress();
        // Auto-dismiss the tooltip a moment after release on touch.
        window.setTimeout(() => setTipOpen(false), 1800);
      }}
      onPointerCancel={() => {
        cancelLongPress();
        setTipOpen(false);
      }}
      style={{
        boxShadow: atCap
          ? "0 0 12px -4px rgba(220,80,80,0.5), inset 0 1px 0 rgba(255,255,255,0.05)"
          : `0 0 10px -4px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      {/* Icon — circular tinted disc */}
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${accent}cc, ${accent}55 60%, ${accent}22)`,
          boxShadow: `0 0 6px ${accent}88, inset 0 0 0 1px ${accent}77`,
        }}
        aria-hidden
      >
        <Icon
          className="h-3.5 w-3.5 text-bg-deep"
          strokeWidth={2.5}
          style={{
            filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.35))",
          }}
        />
      </div>

      {/* Digits */}
      <div className="flex min-w-0 items-baseline gap-1 font-sans leading-none">
        <motion.span
          key={value}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.16, 1] }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className={`whitespace-nowrap text-sm font-bold tabular-nums ${
            atCap ? "text-red-300" : "text-text-primary"
          }`}
          style={{
            color: atCap ? undefined : accent,
            textShadow: "0 1px 0 rgba(0,0,0,0.55)",
          }}
        >
          {display}
        </motion.span>
        {maxDisplay && (
          <span className="text-[10px] font-medium tabular-nums text-text-muted">
            / {maxDisplay}
          </span>
        )}
      </div>

      {/* Resource short-name label below digits on hover (desktop) — tooltip-style */}
      <span className="sr-only">{short}</span>

      {/* Hover / long-press tooltip with resource info */}
      <AnimatePresence>
        {tipOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -2, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2"
            role="tooltip"
          >
            <div
              className="rounded-xl p-[1.5px]"
              style={{
                background: `linear-gradient(135deg, ${accent}cc 0%, ${accent}55 60%, ${accent}33 100%)`,
                boxShadow: `0 10px 24px -10px rgba(0,0,0,0.7), 0 0 18px -4px ${accent}55`,
              }}
            >
              <div className="rounded-[11px] bg-bg-deep/95 px-3 py-2 backdrop-blur">
                <div
                  className="font-display text-[11px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: accent, fontFamily: "var(--font-cinzel)" }}
                >
                  {full}
                </div>
                {resourceDef?.description && (
                  <p className="mt-1 text-[10px] leading-snug text-text-muted">
                    {resourceDef.description}
                  </p>
                )}
                <div className="mt-1.5 font-sans text-[10px] tabular-nums text-text-primary">
                  <span style={{ color: accent }}>{display}</span>
                  {maxDisplay && (
                    <span className="text-text-muted"> / {maxDisplay}</span>
                  )}
                  {atCap && (
                    <span className="ml-1.5 rounded-full bg-red-500/30 px-1.5 py-px text-[8px] font-bold uppercase tracking-[0.18em] text-red-300">
                      Full
                    </span>
                  )}
                </div>
                {resourceDef?.earnedFrom && (
                  <p className="mt-1.5 text-[9px] uppercase tracking-[0.18em] text-text-muted/80">
                    Earned: <span className="text-text-muted">{resourceDef.earnedFrom}</span>
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ResourceBar() {
  const resources = useGameStore((s) => s.resources);
  const buildings = useGameStore((s) => s.buildings);
  const storageBonus = getTotalStorageBonus(buildings);

  const maxOf = (field: keyof Resources) =>
    isCapped(field) ? maxFor(field, storageBonus) : null;

  return (
    <header
      className="sticky top-0 z-30 border-b border-gold/15 bg-bg-deep/95 backdrop-blur supports-[backdrop-filter]:bg-bg-deep/75"
      style={{
        boxShadow:
          "0 6px 24px -12px rgba(0,0,0,0.7), inset 0 -1px 0 rgba(212,160,74,0.1)",
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 pt-2 pb-2.5 sm:px-4 md:px-6">
        {/* Row 1 — identity + settings */}
        <div className="flex items-center justify-between">
          <SettingsButton />
          <div className="flex flex-col items-center leading-none">
            <span
              className="font-display text-[13px] font-bold tracking-[0.32em] text-leaf sm:text-sm"
              style={{
                fontFamily: "var(--font-cinzel)",
                textShadow:
                  "0 0 10px rgba(127,176,105,0.35), 0 1px 0 rgba(184,133,46,0.5)",
              }}
            >
              GROWVERSE
            </span>
            <span className="mt-0.5 font-sans text-[8px] uppercase tracking-[0.4em] text-text-muted">
              Guild Wars · GC1
            </span>
          </div>
          {/* Right-side placeholder so the title stays optically centered */}
          <div className="h-8 w-8" aria-hidden />
        </div>

        {/* Row 2 — resource pill rail. Horizontal scroll on narrow widths
            with edge fades to signal scrollability; centered with no
            fades on desktop where all pills are visible. */}
        <div className="relative -mx-1">
          {/* Gradient fade-out on left + right edges hints "scroll me"
              on mobile. Hidden on md+ where everything fits. */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-bg-deep/95 to-transparent md:hidden"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-bg-deep/95 to-transparent md:hidden"
            aria-hidden
          />
          <div className="overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center justify-center gap-1.5 px-1 sm:gap-2 md:flex-wrap md:justify-center">
              {RESOURCE_PILLS.map((spec) => (
                <ResourcePill
                  key={spec.field}
                  spec={spec}
                  value={resources[spec.field]}
                  max={maxOf(spec.field)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
