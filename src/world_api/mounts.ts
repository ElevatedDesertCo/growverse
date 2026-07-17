// Mounts and Stables v1 (docs/prd/mounts-and-stables.md): the mount surface the
// HUD reads and acts through. `growCoins` is the $GROW balance mirror (account
// ledger authoritative online, plain sim number offline); `ownedMounts` is the
// learned-mount ledger; `activeMountId` is the current ride (null on foot).

export interface IWorldMounts {
  growCoins: number;
  ownedMounts: string[];
  activeMountId: string | null;
  // Summon an owned mount (summoning the active mount dismisses it).
  summonMount(mountId: string): void;
  // Dismiss the active mount, if any.
  dismount(): void;
}
