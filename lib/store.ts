import { create } from "zustand";
import {
  BUILDINGS,
  GRID_COLS,
  GRID_ROWS,
  type BuildingType,
} from "./buildings";
import { getPendingFire, isReadyToHarvest } from "./economy";

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

export interface Resources {
  leaf: number;
  fire: number;
  mushroom: number;
}

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

  /** Bump _tickAt to trigger re-renders of time-aware components. */
  tick: () => void;
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

export const useGameStore = create<GameState>((set, get) => ({
  buildings: [],
  resources: { leaf: 100, fire: 50, mushroom: 0 },

  editMode: false,
  buildMenuOpen: false,
  selectedCell: null,
  selectedPlacedId: null,
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
    const buildings = get().buildings;
    if (!canPlace(type, cell.x, cell.y, buildings)) return;
    set((state) => ({
      buildings: [
        ...state.buildings,
        createPlacedBuilding(type, cell.x, cell.y),
      ],
      buildMenuOpen: false,
      selectedCell: null,
    }));
  },

  placeBuildingAt: (type, x, y) => {
    const buildings = get().buildings;
    if (!canPlace(type, x, y, buildings)) return false;
    set((state) => ({
      buildings: [...state.buildings, createPlacedBuilding(type, x, y)],
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
        if (canPlace(ds.type, cell.x, cell.y, state.buildings)) {
          set((s) => ({
            buildings: [
              ...s.buildings,
              createPlacedBuilding(ds.type, cell.x, cell.y),
            ],
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
      return; // not a harvestable building
    }
    if (b.plantedAt === undefined) return;
    if (!isReadyToHarvest(b.plantedAt, def.growDurationMs, Date.now())) {
      return; // not ready
    }
    const now = Date.now();
    set((s) => ({
      buildings: s.buildings.map((x) =>
        x.id === id ? { ...x, plantedAt: now } : x,
      ),
      resources: { ...s.resources, leaf: s.resources.leaf + def.harvestYield! },
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
    const pending = getPendingFire(
      b.lastGenerated,
      def.firePerSecond,
      Date.now(),
    );
    if (pending < 1) return;
    // Advance lastGenerated by exactly the time consumed by the collected
    // units, so any fractional remainder rolls into the next cycle.
    const consumedMs = (pending / def.firePerSecond) * 1000;
    const newLastGenerated = b.lastGenerated + consumedMs;
    set((s) => ({
      buildings: s.buildings.map((x) =>
        x.id === id ? { ...x, lastGenerated: newLastGenerated } : x,
      ),
      resources: { ...s.resources, fire: s.resources.fire + pending },
    }));
  },

  tick: () => set({ _tickAt: Date.now() }),
}));
