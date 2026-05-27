"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { isReducedMotion, subscribeReduced } from "@/lib/systems/motionPrefs";

/**
 * Listens for `growverse:milestone-confetti` window events and pops a
 * small particle burst near the top center of the viewport. Particles
 * are pure CSS+framer (no canvas) so the implementation is light. The
 * burst is suppressed when reduced-motion is on; the milestone toast
 * still fires.
 */

const PARTICLE_COUNT = 22;
const COLORS = ["#d4a04a", "#7fb069", "#e8964c", "#a875d4", "#f5d97a"];

interface Burst {
  id: number;
  particles: Array<{
    color: string;
    angle: number;
    distance: number;
    rotate: number;
    delay: number;
    size: number;
  }>;
}

let nextBurstId = 0;

function makeBurst(): Burst {
  return {
    id: ++nextBurstId,
    particles: Array.from({ length: PARTICLE_COUNT }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      return {
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        angle,
        distance: 60 + Math.random() * 90,
        rotate: (Math.random() - 0.5) * 360,
        delay: Math.random() * 0.06,
        size: 6 + Math.random() * 6,
      };
    }),
  };
}

export function MilestoneConfetti() {
  const [mounted, setMounted] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [reduced, setReduced] = useState(false);

  // Hydration flip for createPortal — one-shot setState in effect is intentional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(isReducedMotion());
    return subscribeReduced(() => setReduced(isReducedMotion()));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      if (isReducedMotion()) return;
      const burst = makeBurst();
      setBursts((b) => [...b, burst]);
      window.setTimeout(() => {
        setBursts((b) => b.filter((x) => x.id !== burst.id));
      }, 1400);
    };
    window.addEventListener("growverse:milestone-confetti", handler);
    return () => {
      window.removeEventListener("growverse:milestone-confetti", handler);
    };
  }, []);

  // Skip rendering entirely when reduced motion is on — quiet exit.
  if (!mounted || reduced) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+6.5rem)] z-[55] -translate-x-1/2"
      aria-hidden
    >
      <AnimatePresence>
        {bursts.map((burst) => (
          <BurstView key={burst.id} burst={burst} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

function BurstView({ burst }: { burst: Burst }) {
  const particles = useMemo(() => burst.particles, [burst]);
  return (
    <div className="relative h-0 w-0">
      {particles.map((p, i) => {
        const x = Math.cos(p.angle) * p.distance;
        const y = Math.sin(p.angle) * p.distance - 10;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4, rotate: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: [0, x * 0.6, x],
              y: [0, y * 0.6, y + 40],
              scale: [0.4, 1, 0.8],
              rotate: [0, p.rotate * 0.5, p.rotate],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 1.1,
              delay: p.delay,
              ease: "easeOut",
              times: [0, 0.18, 0.7, 1],
            }}
            className="absolute block rounded-sm"
            style={{
              width: p.size,
              height: p.size * 0.45,
              background: p.color,
              boxShadow: `0 0 6px ${p.color}99`,
            }}
          />
        );
      })}
    </div>
  );
}
