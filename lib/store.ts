import { create } from "zustand";
import type { BuildingType } from "./buildings";

export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  level: number;
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

export const useGameStore = create<GameState>((set, get) => ({
  buildings: [],
  editMode: false,
  buildMenuOpen: false,
  selectedCell: null,
  selectedPlacedId: null,

  openBuildMenu: (x, y) => {
    const next = x !== undefined && y !== undefined ? { x, y } : null;
    console.log("[diag] openBuildMenu called, selectedCell now:", next);
    set({ buildMenuOpen: true, selectedCell: next });
  },

  closeBuildMenu: () => set({ buildMenuOpen: false, selectedCell: null }),

  placeBuilding: (type) => {
    const cell = get().selectedCell;
    const before = get().buildings.length;
    console.log("[diag] placeBuilding called:", { type, cell, buildingsBefore: before });
    if (!cell) {
      console.log("[diag] placeBuilding ABORTED: no selectedCell");
      return;
    }
    const occupied = get().buildings.some(
      (b) => b.x === cell.x && b.y === cell.y,
    );
    if (occupied) {
      console.log("[diag] placeBuilding ABORTED: cell occupied");
      return;
    }
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
    console.log("[diag] placeBuilding committed, buildings after:", get().buildings.length);
  },

  moveBuilding: (id, x, y) => {
    const blocked = get().buildings.some(
      (b) => b.id !== id && b.x === x && b.y === y,
    );
    if (blocked) return;
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
