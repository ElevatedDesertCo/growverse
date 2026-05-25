import type { Resources } from "@/lib/systems/resourceSystem";

/**
 * Daily login reward. First load each calendar day grants a small
 * resource bundle. Stored in localStorage as the YYYY-MM-DD key of
 * the last claim — independent of the game save so resets don't
 * grant a duplicate same-day reward.
 */

const LAST_CLAIM_KEY = "growverse-daily-claimed";

export interface DailyRewardBundle {
  /** Sparse map of resource → amount granted. */
  amounts: Partial<Record<keyof Resources, number>>;
  /** Display copy shown in the modal. */
  title: string;
  body: string;
}

/** Today as YYYY-MM-DD in the player's local timezone. */
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns the bundle to grant today, or null if already claimed. */
export function getPendingDailyReward(): DailyRewardBundle | null {
  if (typeof window === "undefined") return null;
  try {
    const last = localStorage.getItem(LAST_CLAIM_KEY);
    if (last === todayKey()) return null;
  } catch {
    // Storage disabled — fall through and grant.
  }
  return {
    title: "Daily Bounty",
    body: "A small offering from the desert spirits. Come back tomorrow for more.",
    amounts: {
      bloomEssence: 25,
      amberShards: 10,
      mycoDust: 5,
    },
  };
}

/** Mark today as claimed. Idempotent. */
export function markDailyClaimed(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_CLAIM_KEY, todayKey());
  } catch {
    /* storage disabled */
  }
}
