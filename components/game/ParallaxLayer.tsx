"use client";

import { useEffect, useState } from "react";
import { isReducedMotion, subscribeReduced } from "@/lib/systems/motionPrefs";

/**
 * Slow-drifting nebula layer behind the HUD. Three radial-gradient
 * spots translate diagonally over 90 seconds via a CSS keyframe.
 * Skipped entirely when the player has reduced-motion enabled.
 */
export function ParallaxLayer() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    // Intentional one-shot hydration + subscription pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(isReducedMotion());
    return subscribeReduced(() => setReduced(isReducedMotion()));
  }, []);
  if (reduced) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden opacity-50"
      aria-hidden
    >
      <div
        className="absolute -inset-[10%] bg-no-repeat"
        style={{
          backgroundImage: [
            "radial-gradient(circle 22% at 30% 35%, rgba(127,176,105,0.10) 0%, transparent 60%)",
            "radial-gradient(circle 18% at 75% 60%, rgba(168,117,212,0.12) 0%, transparent 60%)",
            "radial-gradient(circle 25% at 50% 85%, rgba(232,150,76,0.10) 0%, transparent 60%)",
          ].join(","),
          backgroundSize: "100% 100%",
          animation: "growverse-parallax 90s linear infinite",
        }}
      />
      <style>{`
        @keyframes growverse-parallax {
          0%   { transform: translate3d(0%, 0%, 0); }
          50%  { transform: translate3d(-3%, 2%, 0); }
          100% { transform: translate3d(0%, 0%, 0); }
        }
      `}</style>
    </div>
  );
}
