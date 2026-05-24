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

interface GameState {
  buildings: PlacedBuilding[];
  editMode: boolean;
  buildMenuOpen: boolean;
  selectedCell: { x: number; y: number } | null;
  selectedPlacedId: string | null;

  openBuildMenu: (x?: number, y?: number) => void;
  closeBuildMenu: () => void;
  placeBuilding: (type: BuildingType) => void;
  moveBuilding: (id: string, x: number, y: number) => void;
  toggleEditMode: () => void;
  selectPlacedBuilding: (id: string | null) => void;
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

export const useGameStore = create<GameState>((set, get) => ({
  buildings: [],
  editMode: false,
  buildMenuOpen: false,
  selectedCell: null,
  selectedPlacedId: null,

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
}));
