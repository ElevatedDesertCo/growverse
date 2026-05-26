"use client";

import { useEffect } from "react";
import { consumeLostStreakNotice } from "@/lib/systems/dailyReward";
import { pushToast } from "@/lib/systems/toastSystem";

/**
 * Headless. Once on mount, checks if the player's daily streak was
 * just broken (last claim older than yesterday) and surfaces a
 * one-shot "Streak Lost" toast so the player knows why their badge
 * disappeared. Then clears the stored streak to 0.
 */
export function StreakWatcher() {
  useEffect(() => {
    const lost = consumeLostStreakNotice();
    if (lost !== null) {
      pushToast({
        kind: "info",
        title: "Streak Reset",
        body: `Your ${lost}-day streak ended. Claim today's bounty to start fresh.`,
        accent: "#a875d4",
        ttlMs: 4000,
      });
    }
  }, []);
  return null;
}
