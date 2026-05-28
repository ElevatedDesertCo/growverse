import type { Resources } from "@/lib/systems/resourceSystem";

/**
 * Daily login reward. First load each calendar day grants a small
 * resource bundle. Stored in localStorage as the YYYY-MM-DD key of
 * the last claim — independent of the game save so resets don't
 * grant a duplicate same-day reward.
 */

const LAST_CLAIM_KEY = "growverse-daily-claimed";
const STREAK_KEY = "growverse-daily-streak";
const LAST_SHOWN_STREAK_KEY = "growverse-streak-last-shown";

// Module-level cache of the most recently consumed lost-streak so the
// Daily Bounty modal can surface the same information prominently
// without firing the toast a second time. Cleared after the modal
// closes (via clearLostStreakForUI) or the next consumeLostStreakNotice.
let lostStreakForUI: number | null = null;

/** Returns the lost-streak value cached for UI display (banner inside
 *  the Daily Bounty modal). Survives until clearLostStreakForUI runs. */
export function getLostStreakForUI(): number | null {
  return lostStreakForUI;
}

/** Clears the cached lost-streak UI flag — call after the player has
 *  acknowledged it (claim or dismiss). */
export function clearLostStreakForUI(): void {
  lostStreakForUI = null;
}

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

/** Yesterday's YYYY-MM-DD in local time. */
function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * One-time-per-load check: if the player previously had a streak ≥ 2
 * AND it has now broken (last claim is older than yesterday), return
 * the lost streak value so the UI can show a "streak lost" notice.
 * Returns null otherwise. Tracks via LAST_SHOWN_STREAK_KEY so the same
 * lost streak doesn't re-notify across reloads.
 */
export function consumeLostStreakNotice(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const last = window.localStorage.getItem(LAST_CLAIM_KEY);
    const storedStreak = parseInt(
      window.localStorage.getItem(STREAK_KEY) ?? "0",
      10,
    );
    if (!last || !Number.isFinite(storedStreak) || storedStreak < 2) {
      return null;
    }
    const today = todayKey();
    const yest = yesterdayKey();
    if (last === today || last === yest) {
      // Streak still live (or just claimed today).
      return null;
    }
    // Streak is broken. Check we haven't already shown this loss.
    const shownFor = window.localStorage.getItem(LAST_SHOWN_STREAK_KEY);
    const sig = `${last}:${storedStreak}`;
    if (shownFor === sig) return null;
    window.localStorage.setItem(LAST_SHOWN_STREAK_KEY, sig);
    // Reset the stored streak to 0 now that we've consumed the notice.
    window.localStorage.setItem(STREAK_KEY, "0");
    // Cache for the Daily Bounty modal banner so it surfaces the loss
    // even after StreakWatcher fires the one-shot toast.
    lostStreakForUI = storedStreak;
    return storedStreak;
  } catch {
    return null;
  }
}

/** Returns the current consecutive-day streak. 0 if never claimed or broken. */
export function getDailyStreak(): number {
  if (typeof window === "undefined") return 0;
  try {
    const last = window.localStorage.getItem(LAST_CLAIM_KEY);
    if (!last) return 0;
    const today = todayKey();
    const yest = yesterdayKey();
    // Streak is only "live" if the player claimed today or yesterday.
    // Older than that → broken streak shown as 0.
    if (last !== today && last !== yest) return 0;
    const n = parseInt(
      window.localStorage.getItem(STREAK_KEY) ?? "0",
      10,
    );
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
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

/** Mark today as claimed. Bumps the consecutive-day streak: +1 if last
 *  claim was yesterday, reset to 1 if there was a gap. Idempotent for
 *  same-day re-calls (streak doesn't double-bump). Returns new streak. */
export function markDailyClaimed(): number {
  if (typeof window === "undefined") return 0;
  try {
    const today = todayKey();
    const yest = yesterdayKey();
    const last = localStorage.getItem(LAST_CLAIM_KEY);
    const prevStreak = parseInt(
      localStorage.getItem(STREAK_KEY) ?? "0",
      10,
    );
    let nextStreak: number;
    if (last === today) {
      // Already claimed today — streak unchanged.
      nextStreak = Number.isFinite(prevStreak) ? prevStreak : 0;
    } else if (last === yest) {
      nextStreak = (Number.isFinite(prevStreak) ? prevStreak : 0) + 1;
    } else {
      nextStreak = 1;
    }
    localStorage.setItem(LAST_CLAIM_KEY, today);
    localStorage.setItem(STREAK_KEY, String(nextStreak));
    return nextStreak;
  } catch {
    return 0;
  }
}
