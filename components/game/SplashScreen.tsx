"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const LOAD_MS = 2400;
const FADE_MS = 600;

type Phase = "loading" | "fading" | "done";

export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>("loading");

  // When fading starts, schedule a hard unmount after the fade.
  // This guarantees the splash leaves the DOM even if a CSS transition fails.
  useEffect(() => {
    if (phase !== "fading") return;
    const t = setTimeout(() => setPhase("done"), FADE_MS + 100);
    return () => clearTimeout(t);
  }, [phase]);

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

        <span className="text-[10px] tracking-wide text-text-muted">
          <span className="text-gold">TIP:</span> nurture your spirit
          plants to unlock hidden abilities.
        </span>
      </div>
    </div>
  );
}
