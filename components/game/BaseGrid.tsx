"use client";

import { useEffect, useRef } from "react";
import { BUILDINGS, GRID_COLS, GRID_ROWS } from "@/lib/buildings";
import {
  buildingAtCell,
  canPlace,
  registerGridElement,
  useGameStore,
} from "@/lib/store";
import { DraggableBuilding } from "./DraggableBuilding";

export function BaseGrid() {
  const buildings = useGameStore((s) => s.buildings);
  const editMode = useGameStore((s) => s.editMode);
  const buildMenuOpen = useGameStore((s) => s.buildMenuOpen);
  const selectedCell = useGameStore((s) => s.selectedCell);
  const selectedPlacedId = useGameStore((s) => s.selectedPlacedId);
  const dragState = useGameStore((s) => s.dragState);
  const hoverCell = useGameStore((s) => s.hoverCell);
  const openBuildMenu = useGameStore((s) => s.openBuildMenu);
  const selectPlacedBuilding = useGameStore((s) => s.selectPlacedBuilding);
  const moveBuilding = useGameStore((s) => s.moveBuilding);

  const gridRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    registerGridElement(gridRef.current);
    return () => registerGridElement(null);
  }, []);

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
        if (
          canPlace(
            selectedBuilding.type,
            x,
            y,
            buildings,
            selectedBuilding.id,
          )
        ) {
          moveBuilding(selectedBuilding.id, x, y);
        }
      }
      return;
    }

    if (!occupant) {
      openBuildMenu(x, y);
    }
  };

  // Hover-preview: when a drag is in progress, compute which cells the
  // proposed footprint would occupy and whether it's valid.
  let previewCells: Array<{
    x: number;
    y: number;
    valid: boolean;
  }> = [];
  if (dragState && hoverCell) {
    const type =
      dragState.kind === "place"
        ? dragState.type
        : buildings.find((b) => b.id === dragState.id)?.type;
    if (type) {
      const size = BUILDINGS[type].size;
      const ignoreId =
        dragState.kind === "move" ? dragState.id : undefined;
      const valid = canPlace(
        type,
        hoverCell.x,
        hoverCell.y,
        buildings,
        ignoreId,
      );
      for (let dy = 0; dy < size.h; dy++) {
        for (let dx = 0; dx < size.w; dx++) {
          const cx = hoverCell.x + dx;
          const cy = hoverCell.y + dy;
          if (cx >= 0 && cx < GRID_COLS && cy >= 0 && cy < GRID_ROWS) {
            previewCells.push({ x: cx, y: cy, valid });
          }
        }
      }
    }
  }

  return (
    <div className="mx-auto w-full">
      <div className="mx-auto rounded-2xl border border-gold/20 bg-gradient-to-b from-bg-mid/60 to-bg-deep/60 p-2 shadow-[0_0_40px_-20px_rgba(212,160,74,0.35)] w-[min(100vw-1rem,calc(100dvh-13rem))] sm:w-[min(100vw-2rem,calc(100dvh-14rem))]">
        <div
          ref={gridRef}
          className="relative grid aspect-square gap-px overflow-hidden rounded-xl"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
          }}
        >
          {/* Layer 1 — empty-cell interactive grid */}
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
                    ? "pointer-events-none border-transparent bg-transparent"
                    : isAwaitingCellPick
                      ? "animate-pulse border-gold/50 bg-gold/10 hover:bg-gold/20"
                      : isMoveTarget
                        ? "border-gold/40 bg-gold/10 hover:bg-gold/15"
                        : "border-gold-muted/15 bg-bg-deep/40"
                }`}
              />
            );
          })}

          {/* Layer 2 — placed buildings (long-press → drag enabled) */}
          {buildings.map((b) => {
            const isMenuSelected =
              buildMenuOpen &&
              selectedCell?.x === b.x &&
              selectedCell?.y === b.y;
            return (
              <DraggableBuilding
                key={b.id}
                building={b}
                isTapSelected={selectedPlacedId === b.id}
                isMenuSelected={isMenuSelected}
                onTap={() => handleCellTap(b.x, b.y)}
              />
            );
          })}

          {/* Layer 3 — drag-in-progress ghost preview */}
          {previewCells.map((pc, i) => (
            <div
              key={`preview-${i}`}
              className={`pointer-events-none rounded-sm ${
                pc.valid
                  ? "bg-gold/30 ring-2 ring-gold ring-inset"
                  : "bg-red-500/30 ring-2 ring-red-500/70 ring-inset"
              }`}
              style={{
                gridColumn: `${pc.x + 1} / span 1`,
                gridRow: `${pc.y + 1} / span 1`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
