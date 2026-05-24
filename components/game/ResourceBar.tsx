"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useGameStore } from "@/lib/store";
import { SettingsButton } from "./SettingsButton";

type ResourceProps = {
  iconSrc: string;
  alt: string;
  value: number;
  colorClass: string;
};

function ResourcePill({ iconSrc, alt, value, colorClass }: ResourceProps) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-gold/40 bg-bg-deep/80 px-1.5 py-0.5 shadow-[0_0_0_1px_rgba(212,160,74,0.05)_inset]">
      <Image
        src={iconSrc}
        alt={alt}
        width={275}
        height={275}
        className="h-5 w-5 flex-shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
      />
      {/* key changes when value changes → motion remounts and replays the scale bump */}
      <motion.span
        key={value}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.18, 1] }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        className={`font-sans text-xs font-semibold tabular-nums ${colorClass}`}
      >
        {value.toLocaleString()}
      </motion.span>
    </div>
  );
}

export function ResourceBar() {
  // Three independent selectors → each pill only re-renders when its slice changes.
  const leaf = useGameStore((s) => s.resources.leaf);
  const fire = useGameStore((s) => s.resources.fire);
  const mushroom = useGameStore((s) => s.resources.mushroom);

  return (
    <header className="sticky top-0 z-30 border-b border-gold/15 bg-bg-deep/95 backdrop-blur supports-[backdrop-filter]:bg-bg-deep/70">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-3 py-3 md:max-w-3xl md:px-6">
        <div className="flex items-center gap-2">
          <SettingsButton />
          <div className="flex flex-col items-start leading-none">
            <span
              className="font-display text-[17px] font-bold tracking-[0.22em] text-leaf"
              style={{
                fontFamily: "var(--font-cinzel)",
                textShadow:
                  "0 0 10px rgba(127,176,105,0.35), 0 1px 0 rgba(184,133,46,0.55), 0 2px 4px rgba(0,0,0,0.6)",
              }}
            >
              GROWVERSE
            </span>
            <span className="mt-0.5 font-sans text-[9px] uppercase tracking-[0.35em] text-text-muted">
              GC1
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ResourcePill
            iconSrc="/icons/leaf.png"
            alt="Leaf"
            value={leaf}
            colorClass="text-leaf"
          />
          <ResourcePill
            iconSrc="/icons/fire.png"
            alt="Fire"
            value={fire}
            colorClass="text-fire"
          />
          <ResourcePill
            iconSrc="/icons/mushroom.png"
            alt="Mushroom"
            value={mushroom}
            colorClass="text-mushroom"
          />
        </div>
      </div>
    </header>
  );
}
