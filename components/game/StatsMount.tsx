"use client";

import { useEffect } from "react";
import { setMilestoneHandler } from "@/lib/systems/statsSystem";
import { pushToast } from "@/lib/systems/toastSystem";
import { playSfx } from "@/lib/systems/audioSystem";

/**
 * Headless. Connects the lifetime-stats milestone events to the toast
 * bus + a celebration SFX. Mounted once at the GameShell.
 */
export function StatsMount() {
  useEffect(() => {
    setMilestoneHandler((m) => {
      playSfx("upgradeComplete");
      pushToast({
        kind: "success",
        title: m.title,
        body: m.body,
        accent: m.accent,
        ttlMs: 3400,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("growverse:milestone-confetti"));
      }
    });
    return () => setMilestoneHandler(null);
  }, []);
  return null;
}
