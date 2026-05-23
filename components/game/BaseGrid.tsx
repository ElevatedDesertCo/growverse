"use client";

import { useGameStore } from "@/lib/store";
import { BuildingTile } from "./BuildingTile";

const ROWS = 6;
const COLS = 6;

export function BaseGrid() {
  const buildings = useGameStore((s) => s.buildings);
  const editMode = useGameStore((s) => s.editMode);
  const buildMenuOpen = useGameStore((s) => s.buildMenuOpen);
  const selectedCell = useGameStore((s) => s.selectedCell);
  const selectedPlacedId = useGameStore((s) => s.selectedPlacedId);
  const openBuildMenu = useGameStore((s) => s.openBuildMenu);
  const selectPlacedBuilding = useGameStore((s) => s.selectPlacedBuilding);
  const moveBuilding = useGameStore((s) => s.moveBuilding);

  const buildingAt = (x: number, y: number) =>
    buildings.find((b) => b.x === x && b.y === y);

  const handleCellTap = (x: number, y: number) => {
    const occupant = buildingAt(x, y);

    if (editMode) {
      if (occupant) {
        selectPlacedBuilding(
          selectedPlacedId === occupant.id ? null : occupant.id,
        );
      } else if (selectedPlacedId) {
        moveBuilding(selectedPlacedId, x, y);
      }
      return;
    }

    if (!occupant) {
      console.log("[diag] Cell tapped:", x, y);
      openBuildMenu(x, y);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm md:max-w-xl lg:max-w-2xl">
      <div className="rounded-2xl border border-gold/20 bg-gradient-to-b from-bg-mid/60 to-bg-deep/60 p-2 shadow-[0_0_40px_-20px_rgba(212,160,74,0.35)]">
        <div className="grid aspect-square grid-cols-6 grid-rows-6 gap-px overflow-hidden rounded-xl">
          {Array.from({ length: ROWS * COLS }).map((_, i) => {
            const x = i % COLS;
            const y = Math.floor(i / COLS);
            const occupant = buildingAt(x, y);

            const isMenuOpenForCell =
              buildMenuOpen &&
              selectedCell?.x === x &&
              selectedCell?.y === y;

            const isMoveTarget =
              editMode && selectedPlacedId !== null && !occupant;

            return (
              <button
                key={i}
                type="button"
                onClick={() => handleCellTap(x, y)}
                aria-label={
                  occupant
                    ? `${occupant.type} at row ${y + 1} column ${x + 1}`
                    : `Empty cell row ${y + 1} column ${x + 1}`
                }
                className={`aspect-square border transition-colors ${
                  isMenuOpenForCell
                    ? "border-gold/80 bg-gold/15 ring-2 ring-gold/70 ring-inset"
                    : isMoveTarget
                      ? "border-gold/40 bg-gold/10 hover:bg-gold/15"
                      : "border-gold-muted/20 bg-bg-deep/40"
                }`}
              >
                {occupant && (
                  <BuildingTile
                    building={occupant}
                    editMode={editMode}
                    isSelected={selectedPlacedId === occupant.id}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
