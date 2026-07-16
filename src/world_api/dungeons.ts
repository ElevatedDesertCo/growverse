// One raid's lockout as projected to the HUD: the dungeon id plus the time left
// until it unlocks. The seam only ever surfaces still-locked raids.
export interface RaidLockout {
  id: string;
  msRemaining: number;
}

export interface IWorldDungeons {
  enterDungeon(dungeonId: string): void;
  leaveDungeon(): void;
  // Still-locked raids for the local player (unlock countdown in ms), driving the
  // minimap raid-lockout badge + panel. Empty when nothing is locked.
  raidLockouts(): RaidLockout[];
  // Realm portals (docs/design/realms.md): step through a portal into a
  // dimension, or back to the overworld. `currentRealmId` is the realm the local
  // player stands in ('overworld' when not in a realm) and scopes the map/renderer.
  enterRealm(realmId: string): void;
  leaveRealm(): void;
  currentRealmId(): string;
}
