/**
 * Hard-cap nudge — when a resource gain is silently clamped because the
 * player's storage is full, surface a one-shot toast suggesting they
 * build (or upgrade) a Storage Vault. Cooldown prevents the same nudge
 * from firing on every subsequent harvest.
 */

import { pushToast } from "./toastSystem";

const COOLDOWN_MS = 60 * 1000;
let lastNudgeAt = 0;

interface NudgeInput {
  requested: number;
  gained: number;
  /** True if the player already owns at least one Storage Vault. */
  hasVault: boolean;
}

/**
 * Call after `addResource`. Fires the nudge when:
 *  - the caller asked for a positive gain,
 *  - the result was clamped (gained < requested),
 *  - and the cooldown window has elapsed.
 */
export function notifyCapHit({ requested, gained, hasVault }: NudgeInput): void {
  if (requested <= 0) return;
  if (gained >= requested) return;
  const now = Date.now();
  if (now - lastNudgeAt < COOLDOWN_MS) return;
  lastNudgeAt = now;
  pushToast({
    kind: "info",
    title: "Storage Full",
    body: hasVault
      ? "Upgrade a Storage Vault to hoard more."
      : "Place a Storage Vault to expand your cap.",
    accent: "#d4a04a",
    coalesceKey: "cap-nudge",
    ttlMs: 3200,
  });
}
