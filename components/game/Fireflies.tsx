"use client";

import { motion } from "framer-motion";

/**
 * Ambient firefly layer — 8 small leaf-green dots drifting slowly in
 * loops across the playfield. Pure CSS/motion, GPU-cheap, runs forever.
 * Lives in the GameShell as a pointer-events-none layer behind the HUD.
 */

interface Firefly {
  /** Start position % from left of viewport. */
  x: number;
  /** Start position % from top. */
  y: number;
  /** Loop duration in seconds — longer = slower drift. */
  dur: number;
  /** Drift amplitude in viewport %. */
  dx: number;
  dy: number;
  /** Animation delay so they don't all blink in sync. */
  delay: number;
}

const FIREFLIES: Firefly[] = [
  { x: 12, y: 22, dur: 18, dx: 6,  dy: 4,  delay: 0   },
  { x: 78, y: 18, dur: 24, dx: -5, dy: 7,  delay: 2.5 },
  { x: 28, y: 70, dur: 20, dx: 7,  dy: -5, delay: 1.2 },
  { x: 65, y: 55, dur: 26, dx: -8, dy: -4, delay: 4.1 },
  { x: 45, y: 35, dur: 22, dx: 5,  dy: 8,  delay: 6.0 },
  { x: 88, y: 80, dur: 19, dx: -6, dy: -6, delay: 3.3 },
  { x: 18, y: 88, dur: 25, dx: 8,  dy: -7, delay: 7.5 },
  { x: 55, y: 12, dur: 21, dx: -4, dy: 5,  delay: 5.0 },
];

export function Fireflies() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      aria-hidden
    >
      {FIREFLIES.map((f, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-leaf"
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            boxShadow:
              "0 0 6px rgba(127,176,105,0.85), 0 0 14px rgba(127,176,105,0.55)",
          }}
          animate={{
            x: [`0vw`, `${f.dx}vw`, `${f.dx * 0.4}vw`, `0vw`],
            y: [`0vh`, `${f.dy}vh`, `${f.dy * 0.6}vh`, `0vh`],
            opacity: [0.35, 0.9, 0.55, 0.35],
          }}
          transition={{
            duration: f.dur,
            ease: "easeInOut",
            repeat: Infinity,
            delay: f.delay,
          }}
        />
      ))}
    </div>
  );
}
