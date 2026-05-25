"use client";

import { motion } from "framer-motion";
import { RESOURCES } from "@/lib/data";
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
 * Stylized "stone-frame" resource bar inspired by the v2 art reference.
 * Pure CSS approximation: warm sandstone outer frame, three tinted glass
 * panels with sparkle backgrounds, gem cabochon caps. When real PNG
 * assets land we can swap individual layers in via AssetImage without
 * touching this layout.
 */

interface PanelTheme {
  /** Tailwind color class for the number digits. */
  digitClass: string;
  /** Hex accent for the gem cap + panel inner glow. */
  accent: string;
  /** Inner radial gradient stops for the panel background. */
  panelGradient: string;
  /** Outer ring tint just inside the gold trim. */
  ringTint: string;
}

const THEMES: Record<"bloom" | "myco" | "amber", PanelTheme> = {
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

/** Tiny sparkle field rendered behind the panel content. Pure CSS. */
const SPARKLES: React.CSSProperties = {
  backgroundImage: [
    "radial-gradient(1px 1px at 18% 30%, rgba(255,255,255,0.55) 0, transparent 60%)",
    "radial-gradient(1px 1px at 72% 42%, rgba(255,255,255,0.4) 0, transparent 60%)",
    "radial-gradient(1.5px 1.5px at 38% 78%, rgba(255,255,255,0.5) 0, transparent 60%)",
    "radial-gradient(1px 1px at 86% 18%, rgba(255,255,255,0.45) 0, transparent 60%)",
    "radial-gradient(1px 1px at 55% 22%, rgba(255,255,255,0.35) 0, transparent 60%)",
  ].join(","),
};

interface PanelProps {
  theme: PanelTheme;
  assetId: string;
  alt: string;
  value: number;
  max: number | null;
  placeholderColor: string;
  /** If true, render a rounded-left corner; for the leftmost panel. */
  capLeft?: boolean;
  /** If true, render a rounded-right corner; for the rightmost panel. */
  capRight?: boolean;
}

function ResourcePanel({
  theme,
  assetId,
  alt,
  value,
  max,
  placeholderColor,
  capLeft = false,
  capRight = false,
}: PanelProps) {
  const atCap = max !== null && value >= max;
  const display = value.toLocaleString();
  const corners = `${capLeft ? "rounded-l-xl" : ""} ${capRight ? "rounded-r-xl" : ""}`;
  return (
    <div
      className={`relative flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 ${corners}`}
      style={{
        background: theme.panelGradient,
        boxShadow: atCap
          ? `inset 0 0 0 1px rgba(220,80,80,0.7), inset 0 0 18px rgba(220,80,80,0.25)`
          : `inset 0 0 0 1px ${theme.ringTint}, inset 0 0 14px ${theme.accent}22`,
      }}
      title={`${alt}: ${display}${atCap ? " (full)" : max !== null ? ` / ${max.toLocaleString()}` : ""}`}
    >
      {/* Sparkle field */}
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={SPARKLES}
        aria-hidden
      />
      {/* Icon */}
      <div
        className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center sm:h-8 sm:w-8"
        style={{
          filter: `drop-shadow(0 0 6px ${theme.accent}88)`,
        }}
      >
        <AssetImage
          assetId={assetId}
          alt={alt}
          width={32}
          height={32}
          className="h-full w-full"
          placeholderColor={placeholderColor}
        />
      </div>
      {/* Number */}
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
        {display}
      </motion.span>
    </div>
  );
}

/** A small gem cabochon held in a gold diamond mount. Sits above the bar. */
function GemCap({ accent, leftPct }: { accent: string; leftPct: number }) {
  return (
    <div
      className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2"
      style={{ left: `${leftPct}%` }}
      aria-hidden
    >
      <div
        className="relative h-5 w-5 rotate-45 rounded-[3px] sm:h-6 sm:w-6"
        style={{
          background:
            "linear-gradient(135deg, #f4d98f 0%, #d4a04a 45%, #8b6c2e 100%)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.35) inset, 0 -1px 0 rgba(0,0,0,0.4) inset, 0 2px 4px rgba(0,0,0,0.55)",
        }}
      >
        <div
          className="absolute inset-[3px] -rotate-45 rounded-full sm:inset-[4px]"
          style={{
            background: `radial-gradient(circle at 35% 30%, #ffffffaa 0%, ${accent} 35%, ${accent}cc 70%, ${accent}55 100%)`,
            boxShadow: `0 0 8px ${accent}aa, inset 0 0 4px rgba(0,0,0,0.4)`,
          }}
        />
      </div>
    </div>
  );
}

export function ResourceBar() {
  const resources = useGameStore((s) => s.resources);
  const buildings = useGameStore((s) => s.buildings);
  const storageBonus = getTotalStorageBonus(buildings);

  const maxOf = (field: keyof Resources) =>
    isCapped(field) ? maxFor(field, storageBonus) : null;

  // Mockup order: green (Bloom) → purple (Myco) → red/amber (Amber).
  const panels: Array<{
    key: "bloom" | "myco" | "amber";
    field: keyof Resources;
  }> = [
    { key: "bloom", field: "bloomEssence" },
    { key: "myco", field: "mycoDust" },
    { key: "amber", field: "amberShards" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-gold/15 bg-bg-deep/95 backdrop-blur supports-[backdrop-filter]:bg-bg-deep/70">
      <div className="mx-auto flex max-w-md flex-col gap-1.5 px-3 pb-2 pt-2 md:max-w-3xl md:px-6 md:pb-2.5">
        {/* Title row — compact, identity + settings */}
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

        {/* Ornate stone-frame resource bar */}
        <div className="relative">
          {/* Gem caps sitting on top of each panel center */}
          <GemCap accent={THEMES.bloom.accent} leftPct={100 / 6} />
          <GemCap accent={THEMES.myco.accent} leftPct={50} />
          <GemCap accent={THEMES.amber.accent} leftPct={(100 / 6) * 5} />

          {/* Outer stone frame */}
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
                background:
                  "linear-gradient(180deg, #4a3520 0%, #2a1d10 100%)",
              }}
            >
              {panels.map((p, i) => {
                const theme = THEMES[p.key];
                const def = RESOURCES[p.field as keyof typeof RESOURCES];
                return (
                  <ResourcePanel
                    key={p.field}
                    theme={theme}
                    assetId={`resource.${p.field}`}
                    alt={def?.name ?? p.field}
                    value={resources[p.field]}
                    max={maxOf(p.field)}
                    placeholderColor={def?.color ?? theme.accent}
                    capLeft={i === 0}
                    capRight={i === panels.length - 1}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
