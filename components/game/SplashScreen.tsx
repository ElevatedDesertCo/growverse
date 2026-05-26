"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const LOAD_MS = 2400;
const FADE_MS = 600;

/** Lore tips rotated through the splash. Each rotation: ~1.2s. */
const TIPS: string[] = [
  "nurture your spirit plants to unlock hidden abilities.",
  "upgrade the Guild Core to unlock new building tiers.",
  "Storage Vaults raise the cap on every resource at once.",
  "Bloom Extractors farm Bloom Essence — your bread and butter.",
  "Defenders share their stats across the whole Guild Base.",
  "raids open at Phase 3 — start stockpiling now.",
  "every resource regenerates faster while you're away.",
  "tap Edit to rearrange your base without a rebuild cost.",
];

function pickRandomTipIndex(): number {
  return Math.floor(Math.random() * TIPS.length);
}

type Phase = "loading" | "fading" | "done";

export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>("loading");
  // Seed with a random tip so refreshes feel different. Rotate every
  // 1.2s — covers ~2 tips per 2.4s load duration.
  const [tipIdx, setTipIdx] = useState(() => pickRandomTipIndex());

  useEffect(() => {
    if (phase !== "loading") return;
    const id = setInterval(() => {
      setTipIdx((i) => (i + 1) % TIPS.length);
    }, 1200);
    return () => clearInterval(id);
  }, [phase]);

  // When fading starts, schedule a hard unmount after the fade.
  // This guarantees the splash leaves the DOM even if a CSS transition fails.
  useEffect(() => {
    if (phase !== "fading") return;
    const t = setTimeout(() => setPhase("done"), FADE_MS + 100);
    return () => clearTimeout(t);
  }, [phase]);

  // Prefetch all flagged building + terrain art during splash so the
  // first build doesn't network-fetch + chroma-process. Fire-and-forget;
  // failures are silent (chroma + Next/Image both handle missing files).
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      const [{ BUILDING_ASSETS, TERRAIN_ASSETS, DECOR_ASSETS }, { chromaKeyImage }] = await Promise.all([
        import("@/lib/data/assetManifest"),
        import("@/lib/systems/chromaKey"),
      ]);
      if (cancelled) return;
      type Entry = {
        path: string;
        status: string;
        focus?: { x: number; y: number; w: number; h: number };
        chromaKey?: boolean;
      };
      const entries: Entry[] = [
        ...(Object.values(BUILDING_ASSETS) as Entry[]),
        ...(Object.values(TERRAIN_ASSETS) as Entry[]),
        ...(Object.values(DECOR_ASSETS) as Entry[]),
      ];
      for (const e of entries) {
        if (cancelled) break;
        if (e.status === "placeholder") continue;
        if (e.chromaKey) {
          // Kick off chroma processing; result gets cached.
          chromaKeyImage(e.path, { focus: e.focus }).catch(() => {});
        } else {
          // Just warm the browser HTTP cache.
          const img = new window.Image();
          img.src = e.path;
        }
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "done") return null;

  const fading = phase === "fading";

  return (
    <div
      aria-hidden
      style={{
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
        transition: `opacity ${FADE_MS}ms ease-in-out`,
      }}
      className="fixed inset-0 z-50 bg-bg-deep"
    >
      <Image
        src="/brand/growverse-splash.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-t from-bg-deep via-bg-deep/85 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-8 pb-[max(env(safe-area-inset-bottom),2rem)]">
        <span
          className="font-display text-[10px] uppercase tracking-[0.45em] text-gold/90"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Loading
        </span>

        <div className="relative h-2 w-full max-w-xs overflow-hidden rounded-full border border-gold/40 bg-bg-deep/80 shadow-[0_0_18px_rgba(212,160,74,0.25)]">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: LOAD_MS / 1000, ease: "easeInOut" }}
            onAnimationComplete={() => setPhase("fading")}
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-leaf via-gold to-leaf shadow-[0_0_12px_rgba(127,176,105,0.7)]"
          />
        </div>

        <div className="relative h-4 w-full max-w-sm overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={tipIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="absolute inset-0 text-center text-[10px] tracking-wide text-text-muted"
            >
              <span className="text-gold">TIP:</span> {TIPS[tipIdx]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
