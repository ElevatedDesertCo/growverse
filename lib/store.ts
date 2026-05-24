import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  BUILDINGS,
  GRID_COLS,
  GRID_ROWS,
  type BuildingType,
} from "./buildings";
import {
  costAtLevel,
  getPendingFire,
  intStatAtLevel,
  isReadyToHarvest,
  MAX_LEVEL,
  statAtLevel,
} from "./economy";
import {
  addResource,
  canAffordCost,
  INITIAL_RESOURCES,
  migrateResourcesV1toV2,
  spendResources,
  type Resources,
} from "./systems/resourceSystem";
import { getTotalStorageBonus } from "./systems/buildingSystem";
import { getUpgradeCost } from "./systems/upgradeSystem";

/**
 * SAVE_KEY is fixed (no version suffix) so zustand-persist can find the
 * existing v1 saves and run `migrate()` against them. SAVE_VERSION is the
 * schema version inside that key.
 */
export const SAVE_VERSION = 2;
export const SAVE_KEY = "growverse-save-v1";

export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  level: number;
  /** Top-left origin cell of the building's footprint. */
  x: number;
  y: number;
  /** Wall-clock ms when the current grow cycle started. growTent only. */
  plantedAt?: number;
  /** Wall-clock ms of last passive-Fire collection. amberForge only. */
  lastGenerated?: number;
}

export type { Resources } from "./systems/resourceSystem";

export type DragState =
  | { kind: "place"; type: BuildingType }
  | { kind: "move"; id: string }
  | null;

interface GameState {
  buildings: PlacedBuilding[];
  resources: Resources;

  editMode: boolean;
  buildMenuOpen: boolean;
  selectedCell: { x: number; y: number } | null;
  selectedPlacedId: string | null;
  /** Id of the building whose Upgrade Modal is open, or null. */
  upgradeModalId: string | null;

  /** Current drag operation, if any. */
  dragState: DragState;
  /** Cell currently under the dragging pointer. */
  hoverCell: { x: number; y: number } | null;

  /** Re-render trigger written by the global 500ms tick. */
  _tickAt: number;

  openBuildMenu: (x?: number, y?: number) => void;
  closeBuildMenu: () => void;
  placeBuilding: (type: BuildingType) => void;
  placeBuildingAt: (type: BuildingType, x: number, y: number) => boolean;
  moveBuilding: (id: string, x: number, y: number) => void;
  toggleEditMode: () => void;
  selectPlacedBuilding: (id: string | null) => void;

  startPlaceDrag: (type: BuildingType) => void;
  startMoveDrag: (id: string) => void;
  setHoverCell: (cell: { x: number; y: number } | null) => void;
  commitDrag: () => boolean;
  cancelDrag: () => void;

  /** Harvest a Grow Tent (only succeeds if cycle complete). */
  harvest: (id: string) => void;
  /** Collect accrued Fire from an Amber Forge. */
  collectFire: (id: string) => void;

  /** Open / close the Upgrade Modal for a placed building. */
  openUpgradeModal: (id: string) => void;
  closeUpgradeModal: () => void;
  /** Upgrade a building one level (deducts Leaf, no-op if unaffordable / maxed). */
  upgrade: (id: string) => void;

  /** Bump _tickAt to trigger re-renders of time-aware components. */
  tick: () => void;

  /** Wipe the persisted save and reset to initial state. */
  resetSave: () => void;
}

// ─── Type-aware factory ─────────────────────────────────────────────
function createPlacedBuilding(
  type: BuildingType,
  x: number,
  y: number,
): PlacedBuilding {
  const now = Date.now();
  const b: PlacedBuilding = {
    id: crypto.randomUUID(),
    type,
    level: 1,
    x,
    y,
  };
  if (BUILDINGS[type].growDurationMs !== undefined) b.plantedAt = now;
  if (BUILDINGS[type].firePerSecond !== undefined) b.lastGenerated = now;
  return b;
}

// ─── Footprint helpers ──────────────────────────────────────────────
function isCellFree(
  x: number,
  y: number,
  buildings: PlacedBuilding[],
  ignoreId?: string,
): boolean {
  if (x < 0 || y < 0 || x >= GRID_COLS || y >= GRID_ROWS) return false;
  for (const b of buildings) {
    if (ignoreId && b.id === ignoreId) continue;
    const size = BUILDINGS[b.type].size;
    if (x >= b.x && x < b.x + size.w && y >= b.y && y < b.y + size.h) {
      return false;
    }
  }
  return true;
}

export function canPlace(
  type: BuildingType,
  x: number,
  y: number,
  buildings: PlacedBuilding[],
  ignoreId?: string,
): boolean {
  const size = BUILDINGS[type].size;
  if (x < 0 || y < 0) return false;
  if (x + size.w > GRID_COLS || y + size.h > GRID_ROWS) return false;
  for (let dy = 0; dy < size.h; dy++) {
    for (let dx = 0; dx < size.w; dx++) {
      if (!isCellFree(x + dx, y + dy, buildings, ignoreId)) return false;
    }
  }
  return true;
}

export function buildingAtCell(
  x: number,
  y: number,
  buildings: PlacedBuilding[],
): PlacedBuilding | undefined {
  return buildings.find((b) => {
    const size = BUILDINGS[b.type].size;
    return x >= b.x && x < b.x + size.w && y >= b.y && y < b.y + size.h;
  });
}

/**
 * True if a building of `type` is already placed on the grid.
 * Used for singleton enforcement.
 */
export function isAlreadyPlaced(
  type: BuildingType,
  buildings: PlacedBuilding[],
): boolean {
  return buildings.some((b) => b.type === type);
}

/**
 * Combined gate: canPlace (footprint fits + no collision) AND singleton
 * rule (if BUILDINGS[type].singleton, no existing instance). Use this
 * for NEW placements; `canPlace` alone is correct for moves.
 */
export function canPlaceNew(
  type: BuildingType,
  x: number,
  y: number,
  buildings: PlacedBuilding[],
): boolean {
  if (BUILDINGS[type].singleton && isAlreadyPlaced(type, buildings)) {
    return false;
  }
  return canPlace(type, x, y, buildings);
}

// ─── Grid coordinate translation (module-level, no React context) ───
let gridEl: HTMLElement | null = null;

export function registerGridElement(el: HTMLElement | null) {
  gridEl = el;
}

export function cellFromClientPoint(
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  if (!gridEl) return null;
  const rect = gridEl.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const relX = clientX - rect.left;
  const relY = clientY - rect.top;
  if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) {
    return null;
  }
  const cellW = rect.width / GRID_COLS;
  const cellH = rect.height / GRID_ROWS;
  const x = Math.floor(relX / cellW);
  const y = Math.floor(relY / cellH);
  if (x < 0 || y < 0 || x >= GRID_COLS || y >= GRID_ROWS) return null;
  return { x, y };
}

export const useGameStore = create<GameState>()(persist((set, get) => ({
  buildings: [],
  resources: { ...INITIAL_RESOURCES },

  editMode: false,
  buildMenuOpen: false,
  selectedCell: null,
  selectedPlacedId: null,
  upgradeModalId: null,
  dragState: null,
  hoverCell: null,
  _tickAt: 0,

  openBuildMenu: (x, y) =>
    set({
      buildMenuOpen: true,
      selectedCell:
        x !== undefined && y !== undefined ? { x, y } : null,
    }),

  closeBuildMenu: () => set({ buildMenuOpen: false, selectedCell: null }),

  placeBuilding: (type) => {
    const cell = get().selectedCell;
    if (!cell) return;
    const state = get();
    if (!canPlaceNew(type, cell.x, cell.y, state.buildings)) return;
    const def = BUILDINGS[type];
    const cost = def.buildCost ?? { bloomEssence: def.baseCost };
    if (!canAffordCost(state.resources, cost)) return;
    set((s) => ({
      buildings: [
        ...s.buildings,
        createPlacedBuilding(type, cell.x, cell.y),
      ],
      resources: spendResources(s.resources, cost),
      buildMenuOpen: false,
      selectedCell: null,
    }));
  },

  placeBuildingAt: (type, x, y) => {
    const state = get();
    if (!canPlaceNew(type, x, y, state.buildings)) return false;
    const def = BUILDINGS[type];
    const cost = def.buildCost ?? { bloomEssence: def.baseCost };
    if (!canAffordCost(state.resources, cost)) return false;
    set((s) => ({
      buildings: [...s.buildings, createPlacedBuilding(type, x, y)],
      resources: spendResources(s.resources, cost),
    }));
    return true;
  },

  moveBuilding: (id, x, y) => {
    const buildings = get().buildings;
    const target = buildings.find((b) => b.id === id);
    if (!target) return;
    if (!canPlace(target.type, x, y, buildings, id)) return;
    set((state) => ({
      buildings: state.buildings.map((b) =>
        b.id === id ? { ...b, x, y } : b,
      ),
      selectedPlacedId: null,
    }));
  },

  toggleEditMode: () =>
    set((state) => ({
      editMode: !state.editMode,
      selectedPlacedId: null,
      buildMenuOpen: false,
      selectedCell: null,
      upgradeModalId: null,
    })),

  selectPlacedBuilding: (id) => set({ selectedPlacedId: id }),

  startPlaceDrag: (type) =>
    set({ dragState: { kind: "place", type }, hoverCell: null }),

  startMoveDrag: (id) =>
    set({ dragState: { kind: "move", id }, hoverCell: null }),

  setHoverCell: (cell) => set({ hoverCell: cell }),

  commitDrag: () => {
    const state = get();
    const ds = state.dragState;
    const cell = state.hoverCell;
    let success = false;

    if (ds && cell) {
      if (ds.kind === "place") {
        const def = BUILDINGS[ds.type];
        const cost = def.buildCost ?? { bloomEssence: def.baseCost };
        if (
          canPlaceNew(ds.type, cell.x, cell.y, state.buildings) &&
          canAffordCost(state.resources, cost)
        ) {
          set((s) => ({
            buildings: [
              ...s.buildings,
              createPlacedBuilding(ds.type, cell.x, cell.y),
            ],
            resources: spendResources(s.resources, cost),
            buildMenuOpen: false,
            selectedCell: null,
          }));
          success = true;
        }
      } else if (ds.kind === "move") {
        const target = state.buildings.find((b) => b.id === ds.id);
        if (
          target &&
          canPlace(target.type, cell.x, cell.y, state.buildings, ds.id)
        ) {
          set((s) => ({
            buildings: s.buildings.map((b) =>
              b.id === ds.id ? { ...b, x: cell.x, y: cell.y } : b,
            ),
            selectedPlacedId: null,
          }));
          success = true;
        }
      }
    }

    set({ dragState: null, hoverCell: null });
    return success;
  },

  cancelDrag: () => set({ dragState: null, hoverCell: null }),

  // ─── Sprint 3: harvest + collect ─────────────────────────────────────
  harvest: (id) => {
    const state = get();
    const b = state.buildings.find((x) => x.id === id);
    if (!b) return;
    const def = BUILDINGS[b.type];
    if (def.growDurationMs === undefined || def.harvestYield === undefined) {
      return;
    }
    if (b.plantedAt === undefined) return;
    if (!isReadyToHarvest(b.plantedAt, def.growDurationMs, Date.now())) {
      return;
    }
    const yieldAtThisLevel = intStatAtLevel(def.harvestYield, b.level);
    const now = Date.now();
    const target = def.producesResource ?? "bloomEssence";
    const storageBonus = getTotalStorageBonus(state.buildings);
    set((s) => ({
      buildings: s.buildings.map((x) =>
        x.id === id ? { ...x, plantedAt: now } : x,
      ),
      resources: addResource(
        s.resources,
        target as keyof Resources,
        yieldAtThisLevel,
        storageBonus,
      ).next,
    }));
  },

  collectFire: (id) => {
    const state = get();
    const b = state.buildings.find((x) => x.id === id);
    if (!b) return;
    const def = BUILDINGS[b.type];
    if (def.firePerSecond === undefined || b.lastGenerated === undefined) {
      return;
    }
    const ratePerSec = statAtLevel(def.firePerSecond, b.level);
    const pending = getPendingFire(b.lastGenerated, ratePerSec, Date.now());
    if (pending < 1) return;
    const consumedMs = (pending / ratePerSec) * 1000;
    const newLastGenerated = b.lastGenerated + consumedMs;
    const target = def.producesResource ?? "amberShards";
    const storageBonus = getTotalStorageBonus(state.buildings);
    set((s) => ({
      buildings: s.buildings.map((x) =>
        x.id === id ? { ...x, lastGenerated: newLastGenerated } : x,
      ),
      resources: addResource(
        s.resources,
        target as keyof Resources,
        pending,
        storageBonus,
      ).next,
    }));
  },

  // ─── Sprint 4: upgrade modal + upgrade action ────────────────────────
  openUpgradeModal: (id) => set({ upgradeModalId: id }),
  closeUpgradeModal: () => set({ upgradeModalId: null }),

  upgrade: (id) => {
    const state = get();
    const b = state.buildings.find((x) => x.id === id);
    if (!b) return;
    const def = BUILDINGS[b.type];
    const cap = def.maxLevel ?? MAX_LEVEL;
    if (b.level >= cap) return;
    const cost = getUpgradeCost(b.type, b.level);
    if (!cost) return;
    if (!canAffordCost(state.resources, cost)) return;
    set((s) => ({
      buildings: s.buildings.map((x) =>
        x.id === id ? { ...x, level: x.level + 1 } : x,
      ),
      resources: spendResources(s.resources, cost),
    }));
  },

  tick: () => set({ _tickAt: Date.now() }),

  resetSave: () => {
    set({
      buildings: [],
      resources: { ...INITIAL_RESOURCES },
      editMode: false,
      buildMenuOpen: false,
      selectedCell: null,
      selectedPlacedId: null,
      upgradeModalId: null,
      dragState: null,
      hoverCell: null,
    });
    // Clear the persisted snapshot as well; persist will rewrite on next set.
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore (SSR or storage disabled) */
    }
  },
}), {
  name: SAVE_KEY,
  storage: createJSONStorage(() => localStorage),
  version: SAVE_VERSION,
  // Persist only true game state, never UI / drag / tick state.
  partialize: (s) => ({
    buildings: s.buildings,
    resources: s.resources,
  }),
  /**
   * Save migrations. v1 stored 3-resource {leaf, fire, mushroom}; v2 stores
   * the full 8-resource canonical bag. v1 saves' balances port over via
   * migrateResourcesV1toV2.
   */
  migrate: (persistedState: unknown, version: number) => {
    const state = persistedState as { resources?: unknown; buildings?: unknown } | null;
    if (!state) return state as never;
    if (version < 2) {
      return {
        ...state,
        resources: migrateResourcesV1toV2(state.resources as Parameters<typeof migrateResourcesV1toV2>[0]),
      };
    }
    return state as never;
  },
  // Skip SSR hydration — only rehydrate on the client after mount.
  // The splash screen covers the brief default-state flash.
  skipHydration: true,
}));
