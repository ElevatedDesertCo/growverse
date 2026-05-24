"use client";

import { BUILDINGS, GRID_COLS, GRID_ROWS } from "@/lib/buildings";
import { buildingAtCell, canPlace, useGameStore } from "@/lib/store";
import { BuildingTile } from "./BuildingTile";

export function BaseGrid() {
  const buildings = useGameStore((s) => s.buildings);
  const editMode = useGameStore((s) => s.editMode);
  const buildMenuOpen = useGameStore((s) => s.buildMenuOpen);
  const selectedCell = useGameStore((s) => s.selectedCell);
  const selectedPlacedId = useGameStore((s) => s.selectedPlacedId);
  const openBuildMenu = useGameStore((s) => s.openBuildMenu);
  const selectPlacedBuilding = useGameStore((s) => s.selectPlacedBuilding);
  const moveBuilding = useGameStore((s) => s.moveBuilding);

  const selectedBuilding = selectedPlacedId
    ? buildings.find((b) => b.id === selectedPlacedId)
    : undefined;

  const handleCellTap = (x: number, y: number) => {
    const occupant = buildingAtCell(x, y, buildings);

    if (editMode) {
      if (occupant) {
        selectPlacedBuilding(
          selectedPlacedId === occupant.id ? null : occupant.id,
        );
      } else if (selectedBuilding) {
        if (canPlace(selectedBuilding.type, x, y, buildings, selectedBuilding.id)) {
          moveBuilding(selectedBuilding.id, x, y);
        }
      }
      return;
    }

    if (!occupant) {
      openBuildMenu(x, y);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm md:max-w-xl lg:max-w-2xl">
      <div className="rounded-2xl border border-gold/20 bg-gradient-to-b from-bg-mid/60 to-bg-deep/60 p-2 shadow-[0_0_40px_-20px_rgba(212,160,74,0.35)]">
        <div
          className="relative grid aspect-square gap-px overflow-hidden rounded-xl"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
          }}
        >
          {/* Layer 1 — empty cell grid (interactive surface) */}
          {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => {
            const x = i % GRID_COLS;
            const y = Math.floor(i / GRID_COLS);
            const occupant = buildingAtCell(x, y, buildings);

            const isAwaitingCellPick =
              buildMenuOpen && selectedCell === null && !occupant;

            const isMoveTarget =
              editMode &&
              selectedBuilding !== undefined &&
              !occupant &&
              canPlace(
                selectedBuilding.type,
                x,
                y,
                buildings,
                selectedBuilding.id,
              );

            return (
              <button
                key={i}
                type="button"
                onClick={() => handleCellTap(x, y)}
                aria-label={
                  occupant
                    ? `${BUILDINGS[occupant.type].name} cell ${x + 1},${y + 1}`
                    : `Empty cell ${x + 1},${y + 1}`
                }
                className={`aspect-square border transition-colors ${
                  occupant
                    ? "border-transparent bg-transparent"
                    : isAwaitingCellPick
                      ? "animate-pulse border-gold/50 bg-gold/10 hover:bg-gold/20"
                      : isMoveTarget
                        ? "border-gold/40 bg-gold/10 hover:bg-gold/15"
                        : "border-gold-muted/15 bg-bg-deep/40"
                }`}
              />
            );
          })}

          {/* Layer 2 — placed buildings (grid-spanning, on top of cells) */}
          {buildings.map((b) => {
            const def = BUILDINGS[b.type];
            const isSelected = selectedPlacedId === b.id;
            const isMenuSelected =
              buildMenuOpen &&
              selectedCell?.x === b.x &&
              selectedCell?.y === b.y;
            return (
              <button
                key={b.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCellTap(b.x, b.y);
                }}
                aria-label={`${def.name} at ${b.x + 1},${b.y + 1}`}
                className={`relative cursor-pointer rounded-md transition-shadow ${
                  isSelected
                    ? "ring-2 ring-gold ring-offset-1 ring-offset-bg-deep shadow-[0_0_18px_rgba(212,160,74,0.55)]"
                    : isMenuSelected
                      ? "ring-2 ring-gold/60 ring-inset"
                      : ""
                }`}
                style={{
                  gridColumn: `${b.x + 1} / span ${def.size.w}`,
                  gridRow: `${b.y + 1} / span ${def.size.h}`,
                }}
              >
                <BuildingTile
                  building={b}
                  editMode={editMode}
                  isSelected={isSelected}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
