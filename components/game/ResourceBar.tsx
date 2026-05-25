"use client";

import { motion } from "framer-motion";
import { RESOURCES } from "@/lib/data";
import { hasRealAsset } from "@/lib/data/assetManifest";
import { useGameStore } from "@/lib/store";
import { getTotalStorageBonus } from "@/lib/systems/buildingSystem";
import {
  isCapped,
  maxFor,
  type Resources,
} from "@/lib/systems/resourceSystem";
import { AssetImage } from "./AssetImage";
import { SettingsButton } from "./SettingsButton";

/**
 * Two-mode resource bar:
 *
 * 1. **Painted mode** (default — when `ui.resourceBarFrame` is real): use
 *    the painted PNG as the full bar background, overlay live numbers
 *    at the painted slot centers. Icons + gem caps are part of the
 *    art — we just refresh the digits.
 * 2. **CSS mode** (fallback when no painted file): the stone-frame
 *    approximation built in CSS. Stays as a safety net.
 *
 * Both modes share the same title row above (Settings + GROWVERSE).
 */

/** Horizontal centers of the 3 number slots inside the painted bar
 *  (after cropping to just the bar). Tuned to the v2 mockup. */
const SLOT_CENTERS_X = [29, 58, 86] as const;
/** Vertical center of the numbers inside the painted bar. */
const SLOT_CENTER_Y = 58;

const PANELS = [
  { key: "bloom" as const, field: "bloomEssence" as keyof Resources, accent: "#7fb069", capColor: "text-leaf" },
  { key: "myco" as const, field: "mycoDust" as keyof Resources, accent: "#a875d4", capColor: "text-mushroom" },
  { key: "amber" as const, field: "amberShards" as keyof Resources, accent: "#e8964c", capColor: "text-fire" },
];

interface NumberOverlayProps {
  value: number;
  atCap: boolean;
  capColor: string;
  centerX: number;
  centerY: number;
}

function NumberOverlay({
  value,
  atCap,
  capColor,
  centerX,
  centerY,
}: NumberOverlayProps) {
  const display = value.toLocaleString();
  return (
    <motion.span
      key={value}
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.18, 1] }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap font-display text-xs font-bold tabular-nums sm:text-sm md:text-base ${
        atCap ? "text-red-300" : capColor
      }`}
      style={{
        left: `${centerX}%`,
        top: `${centerY}%`,
        textShadow:
          "0 1px 0 rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.7), 0 0 14px rgba(0,0,0,0.6)",
        fontFamily: "var(--font-cinzel)",
      }}
    >
      {display}
    </motion.span>
  );
}

export function ResourceBar() {
  const resources = useGameStore((s) => s.resources);
  const buildings = useGameStore((s) => s.buildings);
  const storageBonus = getTotalStorageBonus(buildings);

  const useFrame = hasRealAsset("ui.resourceBarFrame");

  const maxOf = (field: keyof Resources) =>
    isCapped(field) ? maxFor(field, storageBonus) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-gold/15 bg-bg-deep/95 backdrop-blur supports-[backdrop-filter]:bg-bg-deep/70">
      <div className="mx-auto flex max-w-md flex-col gap-1.5 px-3 pb-2 pt-2 md:max-w-3xl md:px-6 md:pb-2.5">
        {/* Title row — Settings + GROWVERSE wordmark + GC1 badge */}
        <div className="flex items-center justify-between">
          <SettingsButton />
          <div className="flex flex-col items-end leading-none">
            <span
              className="font-display text-[13px] font-bold tracking-[0.3em] text-leaf"
              style={{
                fontFamily: "var(--font-cinzel)",
                textShadow:
                  "0 0 8px rgba(127,176,105,0.3), 0 1px 0 rgba(184,133,46,0.45)",
              }}
            >
              GROWVERSE
            </span>
            <span className="mt-0.5 font-sans text-[8px] uppercase tracking-[0.4em] text-text-muted">
              GC1
            </span>
          </div>
        </div>

        {useFrame ? (
          <PaintedFrameBar
            resources={resources}
            maxOf={maxOf}
          />
        ) : (
          <CssFrameBar resources={resources} maxOf={maxOf} />
        )}
      </div>
    </header>
  );
}

function PaintedFrameBar({
  resources,
  maxOf,
}: {
  resources: Resources;
  maxOf: (f: keyof Resources) => number | null;
}) {
  return (
    <div className="relative w-full">
      {/* Painted frame — sets the bar's aspect ratio implicitly via
          the cropped PNG. We render it as a background div so live
          overlays can sit on top without affecting layout. */}
      <div className="relative aspect-[5.1/1] w-full">
        <AssetImage
          assetId="ui.resourceBarFrame"
          alt="Resources"
          fill
          className="h-full w-full"
          notDraggable
        />

        {/* Live number overlays at the painted slot centers. */}
        {PANELS.map((p, i) => {
          const max = maxOf(p.field);
          const value = resources[p.field];
          const atCap = max !== null && value >= max;
          return (
            <NumberOverlay
              key={p.field}
              value={value}
              atCap={atCap}
              capColor="text-amber-50"
              centerX={SLOT_CENTERS_X[i]}
              centerY={SLOT_CENTER_Y}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── CSS fallback (kept for when the painted PNG is absent) ─────────

interface PanelTheme {
  digitClass: string;
  accent: string;
  panelGradient: string;
  ringTint: string;
}

const CSS_THEMES: Record<"bloom" | "myco" | "amber", PanelTheme> = {
  bloom: {
    digitClass: "text-leaf",
    accent: "#7fb069",
    panelGradient:
      "radial-gradient(120% 100% at 50% 60%, #2e6b2a 0%, #1a3e1a 55%, #0d2310 100%)",
    ringTint: "rgba(127,176,105,0.55)",
  },
  myco: {
    digitClass: "text-mushroom",
    accent: "#a875d4",
    panelGradient:
      "radial-gradient(120% 100% at 50% 60%, #5a3a8b 0%, #2e1d5a 55%, #160a2e 100%)",
    ringTint: "rgba(168,117,212,0.55)",
  },
  amber: {
    digitClass: "text-fire",
    accent: "#e8964c",
    panelGradient:
      "radial-gradient(120% 100% at 50% 60%, #b06028 0%, #5c2e0f 55%, #2a1208 100%)",
    ringTint: "rgba(232,150,76,0.55)",
  },
};

function CssFrameBar({
  resources,
  maxOf,
}: {
  resources: Resources;
  maxOf: (f: keyof Resources) => number | null;
}) {
  return (
    <div
      className="rounded-2xl p-[3px]"
      style={{
        background:
          "linear-gradient(180deg, #e6c98a 0%, #b8852e 45%, #5a3f1a 100%)",
        boxShadow:
          "0 4px 14px -6px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,160,74,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
    >
      <div
        className="flex items-stretch gap-[3px] overflow-hidden rounded-xl"
        style={{
          background: "linear-gradient(180deg, #4a3520 0%, #2a1d10 100%)",
        }}
      >
        {PANELS.map((p, i) => {
          const theme = CSS_THEMES[p.key];
          const def = RESOURCES[p.field as keyof typeof RESOURCES];
          const value = resources[p.field];
          const max = maxOf(p.field);
          const atCap = max !== null && value >= max;
          const corners = `${i === 0 ? "rounded-l-xl" : ""} ${i === PANELS.length - 1 ? "rounded-r-xl" : ""}`;
          return (
            <div
              key={p.field}
              className={`relative flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 ${corners}`}
              style={{
                background: theme.panelGradient,
                boxShadow: atCap
                  ? `inset 0 0 0 1px rgba(220,80,80,0.7), inset 0 0 18px rgba(220,80,80,0.25)`
                  : `inset 0 0 0 1px ${theme.ringTint}, inset 0 0 14px ${theme.accent}22`,
              }}
            >
              <div
                className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center sm:h-8 sm:w-8"
                style={{ filter: `drop-shadow(0 0 6px ${theme.accent}88)` }}
              >
                <AssetImage
                  assetId={`resource.${p.field}`}
                  alt={def?.name ?? p.field}
                  width={32}
                  height={32}
                  className="h-full w-full"
                  placeholderColor={def?.color ?? theme.accent}
                />
              </div>
              <motion.span
                key={value}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.18, 1] }}
                transition={{ duration: 0.32, ease: "easeOut" }}
                className={`relative flex-1 truncate text-right font-display text-sm font-bold tabular-nums sm:text-base ${theme.digitClass}`}
                style={{
                  textShadow:
                    "0 1px 0 rgba(0,0,0,0.55), 0 0 10px rgba(0,0,0,0.35)",
                  fontFamily: "var(--font-cinzel)",
                }}
              >
                {value.toLocaleString()}
              </motion.span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
