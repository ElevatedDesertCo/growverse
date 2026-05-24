import { create } from "zustand";
import {
  BUILDINGS,
  GRID_COLS,
  GRID_ROWS,
  type BuildingType,
} from "./buildings";

export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  level: number;
  /** Top-left origin cell of the building's footprint. */
  x: number;
  y: number;
}

export type DragState =
  | { kind: "place"; type: BuildingType }
  | { kind: "move"; id: string }
  | null;

interface GameState {
  buildings: PlacedBuilding[];
  editMode: boolean;
  buildMenuOpen: boolean;
  selectedCell: { x: number; y: number } | null;
  selectedPlacedId: string | null;

  /** Current drag operation, if any (card-from-menu or move-existing). */
  dragState: DragState;
  /** Cell currently under the dragging pointer (for ghost preview + drop). */
  hoverCell: { x: number; y: number } | null;

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
}

/** Return true if (x, y) is within grid AND not covered by any building (excluding `ignoreId`). */
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
    if (
      x >= b.x &&
      x < b.x + size.w &&
      y >= b.y &&
      y < b.y + size.h
    ) {
      return false;
    }
  }
  return true;
}

/** Return true if the building of `type` placed at (x, y) fits AND doesn't collide. */
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

/** Find the building whose footprint covers (x, y). Returns undefined if none. */
export function buildingAtCell(
  x: number,
  y: number,
  buildings: PlacedBuilding[],
): PlacedBuilding | undefined {
  return buildings.find((b) => {
    const size = BUILDINGS[b.type].size;
    return (
      x >= b.x &&
      x < b.x + size.w &&
      y >= b.y &&
      y < b.y + size.h
    );
  });
}

// ─── Grid coordinate translation ─────────────────────────────────────────
// A module-level ref so any draggable can compute cell-under-pointer
// without a React context dance.
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
  editMode: false,
  buildMenuOpen: false,
  selectedCell: null,
  selectedPlacedId: null,
  dragState: null,
  hoverCell: null,

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
        {
          id: crypto.randomUUID(),
          type,
          level: 1,
          x: cell.x,
          y: cell.y,
        },
      ],
      buildMenuOpen: false,
      selectedCell: null,
    }));
  },

  placeBuildingAt: (type, x, y) => {
    const buildings = get().buildings;
    if (!canPlace(type, x, y, buildings)) return false;
    set((state) => ({
      buildings: [
        ...state.buildings,
        { id: crypto.randomUUID(), type, level: 1, x, y },
      ],
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
              {
                id: crypto.randomUUID(),
                type: ds.type,
                level: 1,
                x: cell.x,
                y: cell.y,
              },
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
}));
