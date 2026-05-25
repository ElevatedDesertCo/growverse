"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BUILDINGS, GRID_COLS, GRID_ROWS } from "@/lib/buildings";
import {
  buildingAtCell,
  canPlace,
  registerGridElement,
  useGameStore,
  type PlacedBuilding,
} from "@/lib/store";
import { playSfx } from "@/lib/systems/audioSystem";
import { DraggableBuilding } from "./DraggableBuilding";
import { AssetImage } from "./AssetImage";

// Decor refs used for ambient scenery on empty cells. All cropped to
// their In-Game panel via the manifest, so they render cleanly small.
const DECOR_REFS = [
  "decor.cactus",
  "decor.shrub",
  "decor.rocks",
  "decor.relic",
  "decor.lantern",
  "decor.logSeat",
  "decor.brokenRelic",
] as const;

/**
 * Standard GLSL-style 2D pseudorandom hash. Uniform in [0, 1).
 * The fract(sin·43758) trick scrambles the row/col periodicity that
 * plain |sin(ax+by)| introduces (columns of decor showing up in a
 * line). Same input → same output, so scenery is persistent.
 */
function rand2d(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Deterministic per-cell decor picker. Returns null for ~92% of cells
 * (sparse scatter that feels ambient, not crowded).
 */
function decorAt(x: number, y: number): string | null {
  if (rand2d(x, y) > 0.08) return null;
  const idx = Math.floor(rand2d(x + 1000, y + 2000) * DECOR_REFS.length);
  return DECOR_REFS[idx % DECOR_REFS.length];
}

interface DustBurst {
  id: string;
  x: number;
  y: number;
  color: string;
}

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

  // ─── Placement dust + SFX on new building ──────────────────────────
  const [dusts, setDusts] = useState<DustBurst[]>([]);
  const prevIdsRef = useRef<Set<string>>(new Set(buildings.map((b) => b.id)));
  useEffect(() => {
    const prev = prevIdsRef.current;
    const added: PlacedBuilding[] = [];
    for (const b of buildings) {
      if (!prev.has(b.id)) added.push(b);
    }
    if (added.length > 0) {
      playSfx("buildPlaced");
      const bursts = added.map((b) => ({
        id: b.id,
        x: b.x + BUILDINGS[b.type].size.w / 2,
        y: b.y + BUILDINGS[b.type].size.h / 2,
        color: BUILDINGS[b.type].color,
      }));
      // Intentional: transient placement bursts gated on a real diff;
      // the setTimeout below clears them, so no render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDusts((d) => [...d, ...bursts]);
      const burstIds = new Set(bursts.map((bb) => bb.id));
      setTimeout(() => {
        setDusts((d) => d.filter((bb) => !burstIds.has(bb.id)));
      }, 700);
    }
    prevIdsRef.current = new Set(buildings.map((b) => b.id));
  }, [buildings]);

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
  const previewCells: Array<{
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
    <div
      className="flex min-h-0 w-full flex-1 items-center justify-center"
      style={{ containerType: "size" }}
    >
      <div className="aspect-square h-[100cqmin] w-[100cqmin] rounded-2xl border border-gold/20 bg-gradient-to-b from-bg-mid/60 to-bg-deep/60 p-2 shadow-[0_0_40px_-20px_rgba(212,160,74,0.35)]">
        <div
          ref={gridRef}
          className="relative grid aspect-square gap-px overflow-hidden rounded-xl"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
          }}
        >
          {/* Layer 0a — desert ground backdrop. Sits behind the grid
              cells so the warm sand color shows through transparent
              empty cells. */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <AssetImage
              assetId="terrain.desertGround"
              alt=""
              fill
              className="h-full w-full opacity-95"
              notDraggable
            />
          </div>

          {/* Layer 0b — foundation tile under each placed building's
              footprint. Renders under the building art so it reads as
              a recessed stone plinth. */}
          {buildings.map((b) => {
            const size = BUILDINGS[b.type].size;
            return (
              <div
                key={`fnd-${b.id}`}
                className="pointer-events-none relative z-[1]"
                style={{
                  gridColumn: `${b.x + 1} / span ${size.w}`,
                  gridRow: `${b.y + 1} / span ${size.h}`,
                }}
              >
                <AssetImage
                  assetId="terrain.foundationTile"
                  alt=""
                  fill
                  className="h-full w-full opacity-90"
                  notDraggable
                />
              </div>
            );
          })}

          {/* Layer 0c — decor scatter on empty cells. Deterministic per
              cell; pointer-events-none so clicks pass through to the
              cell button beneath. */}
          {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => {
            const x = i % GRID_COLS;
            const y = Math.floor(i / GRID_COLS);
            if (buildingAtCell(x, y, buildings)) return null;
            const ref = decorAt(x, y);
            if (!ref) return null;
            return (
              <div
                key={`decor-${x}-${y}`}
                className="pointer-events-none relative z-[1]"
                style={{
                  gridColumn: `${x + 1} / span 1`,
                  gridRow: `${y + 1} / span 1`,
                }}
              >
                <AssetImage
                  assetId={ref}
                  alt=""
                  fill
                  className="h-full w-full opacity-90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
                  notDraggable
                />
              </div>
            );
          })}

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
                className={`relative z-[2] aspect-square border transition-colors ${
                  occupant
                    ? "pointer-events-none border-transparent bg-transparent"
                    : isAwaitingCellPick
                      ? "animate-pulse border-gold/50 bg-gold/10 hover:bg-gold/20"
                      : isMoveTarget
                        ? "border-gold/40 bg-gold/10 hover:bg-gold/15"
                        : "border-gold-muted/15 bg-transparent hover:bg-bg-deep/20"
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
                onPassiveTap={() => handleCellTap(b.x, b.y)}
              />
            );
          })}

          {/* First-run empty-state hint */}
          {buildings.length === 0 && !buildMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0 z-[4] flex flex-col items-center justify-center text-center"
            >
              {/* Soft aura behind the card */}
              <div
                className="absolute h-48 w-48 rounded-full opacity-60"
                style={{
                  background:
                    "radial-gradient(circle, rgba(212,160,74,0.18) 0%, rgba(212,160,74,0) 70%)",
                }}
                aria-hidden
              />
              <div className="relative flex max-w-[20rem] flex-col items-center gap-2 rounded-2xl border border-gold/25 bg-bg-deep/70 px-5 py-4 shadow-[0_8px_28px_-12px_rgba(0,0,0,0.7)] backdrop-blur-sm">
                <p
                  className="font-display text-xs font-semibold uppercase tracking-[0.32em] text-gold"
                  style={{ fontFamily: "var(--font-cinzel)" }}
                >
                  Your Realm Awaits
                </p>
                <p className="text-[11px] leading-snug text-text-muted">
                  Tap{" "}
                  <span className="font-bold text-gold">BUILD</span>{" "}
                  below and place your{" "}
                  <span className="font-bold text-gold">Guild Core</span> to
                  begin. Upgrade it to unlock more buildings.
                </p>
              </div>
            </motion.div>
          )}

          {/* Layer 3 — placement-dust bursts (just-placed buildings) */}
          <AnimatePresence>
            {dusts.map((d) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0.85, scale: 0.4 }}
                animate={{ opacity: 0, scale: 2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: "easeOut" }}
                className="pointer-events-none rounded-full"
                style={{
                  gridColumn: `${Math.floor(d.x) + 1} / span 2`,
                  gridRow: `${Math.floor(d.y) + 1} / span 2`,
                  background: `radial-gradient(circle, ${d.color}dd 0%, ${d.color}55 35%, transparent 70%)`,
                  alignSelf: "center",
                  justifySelf: "center",
                }}
                aria-hidden
              />
            ))}
          </AnimatePresence>

          {/* Layer 4 — drag-in-progress ghost preview */}
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
