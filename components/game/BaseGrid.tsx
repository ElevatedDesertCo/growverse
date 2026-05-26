"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { BUILDINGS, GRID_COLS, GRID_ROWS } from "@/lib/buildings";
import {
  buildingAtCell,
  canPlace,
  registerGridElement,
  useGameStore,
  type PlacedBuilding,
} from "@/lib/store";
import { playSfx } from "@/lib/systems/audioSystem";
import { pushToast } from "@/lib/systems/toastSystem";
import { DECOR_DEFS, type DecorItem } from "@/lib/store";
import { DraggableBuilding } from "./DraggableBuilding";
import { AssetImage } from "./AssetImage";

/** Map a decor item type → manifest assetId. */
function decorAssetId(type: DecorItem["type"]): string {
  switch (type) {
    case "cactus":  return "decor.cactus";
    case "shrub":   return "decor.shrub";
    case "rocks":   return "decor.rocks";
    case "relic":   return "decor.relic";
    case "lantern": return "decor.lantern";
    default:        return "decor.shrub";
  }
}

/** Map a decor type → SFX hook name. Plants rustle, rocks clack, relics clunk. */
function decorClearSfx(type: DecorItem["type"]): "decorLeaf" | "decorStone" | "decorMetal" {
  switch (type) {
    case "cactus":
    case "shrub":   return "decorLeaf";
    case "rocks":   return "decorStone";
    case "relic":
    case "lantern": return "decorMetal";
    default:        return "decorLeaf";
  }
}

const FIRST_CLEAR_KEY = "growverse-has-cleared-decor";

interface DustBurst {
  id: string;
  x: number;
  y: number;
  color: string;
}

interface DecorFloater {
  id: string;
  x: number;
  y: number;
  amount: number;
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
  const decor = useGameStore((s) => s.decor);
  const clearDecor = useGameStore((s) => s.clearDecor);

  const gridRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    registerGridElement(gridRef.current);
    return () => registerGridElement(null);
  }, []);

  // ─── Decor clear: animate fade-out + spawn floater + toast ─────────
  const [clearingDecor, setClearingDecor] = useState<Set<string>>(new Set());
  const [decorFloaters, setDecorFloaters] = useState<DecorFloater[]>([]);
  const floaterCounter = useRef(0);
  // First-clear tutorial state: ring + chevron over the first decor item
  // until the player has cleared at least one. Persisted across reloads.
  const hasClearedDecorRef = useRef(false);
  const [showDecorHint, setShowDecorHint] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cleared = window.localStorage.getItem(FIRST_CLEAR_KEY) === "1";
      hasClearedDecorRef.current = cleared;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowDecorHint(!cleared);
    } catch {
      /* storage disabled */
    }
  }, []);
  const handleDecorTap = (d: DecorItem) => {
    if (clearingDecor.has(d.id)) return;
    const def = DECOR_DEFS[d.type];
    setClearingDecor((s) => {
      const next = new Set(s);
      next.add(d.id);
      return next;
    });
    floaterCounter.current += 1;
    const floaterId = `df_${d.id}_${floaterCounter.current}`;
    setDecorFloaters((prev) => [
      ...prev,
      { id: floaterId, x: d.x, y: d.y, amount: def.reward, color: def.color },
    ]);
    playSfx(decorClearSfx(d.type));
    pushToast({
      kind: "success",
      title: def.label,
      body: `+${def.reward}`,
      accent: def.color,
      // Coalesce rapid clears of the same prop type into a single
      // toast that counts up + sums the reward, so wholesale-clearing
      // doesn't spam the HUD.
      coalesceKey: `decor-${d.type}`,
      bodyAmount: def.reward,
    });
    // First-clear: mark so the tutorial hint stops showing on future loads.
    if (!hasClearedDecorRef.current) {
      hasClearedDecorRef.current = true;
      try {
        window.localStorage.setItem(FIRST_CLEAR_KEY, "1");
      } catch {
        /* storage disabled */
      }
      setShowDecorHint(false);
    }
    // Hold the visual for the fade animation, then commit to store.
    window.setTimeout(() => {
      clearDecor(d.id);
      setClearingDecor((s) => {
        const next = new Set(s);
        next.delete(d.id);
        return next;
      });
    }, 380);
    // Remove the floater after its animation completes.
    window.setTimeout(() => {
      setDecorFloaters((prev) => prev.filter((f) => f.id !== floaterId));
    }, 1300);
  };

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
      <div
        className="aspect-square h-[100cqmin] w-[100cqmin] rounded-2xl p-[3px]"
        style={{
          background:
            "linear-gradient(180deg, #e6c98a 0%, #b8852e 45%, #5a3f1a 100%)",
          boxShadow:
            "0 12px 36px -16px rgba(0,0,0,0.8), 0 0 0 1px rgba(212,160,74,0.4), 0 0 48px -16px rgba(212,160,74,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
        }}
      >
        <div
          ref={gridRef}
          className="relative grid aspect-square overflow-hidden rounded-[14px]"
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

          {/* Layer 0c — clearable decor. 5 types, weighted scatter.
              Each tap awards the mapped resource + plays a +N floater.
              Items overlapped by a placed building are filtered out. */}
          {(() => {
            // The first non-occluded decor item gets the tutorial ring.
            const visible = decor.filter(
              (d) => !buildingAtCell(d.x, d.y, buildings),
            );
            const hintTarget = showDecorHint && visible.length > 0
              ? visible[0].id
              : null;
            return visible.map((d) => {
              const def = DECOR_DEFS[d.type];
              const isClearing = clearingDecor.has(d.id);
              const isHint = d.id === hintTarget;
              return (
                <motion.button
                  key={d.id}
                  type="button"
                  animate={
                    isClearing
                      ? { opacity: 0, scale: 0.6, y: -8 }
                      : { opacity: 1, scale: 1, y: 0 }
                  }
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  onClick={() => handleDecorTap(d)}
                  aria-label={`Clear ${def.label} for ${def.reward} ${def.resource}`}
                  className="group relative z-[2] cursor-pointer transition-transform hover:scale-[1.12]"
                  style={{
                    gridColumn: `${d.x + 1} / span 1`,
                    gridRow: `${d.y + 1} / span 1`,
                  }}
                >
                  {/* Masked visual layer — keeps the radial crop confined
                      to the sprite so tooltip + ring (siblings) aren't
                      masked. */}
                  <div
                    className="absolute inset-0"
                    style={{
                      WebkitMaskImage:
                        "radial-gradient(circle, black 38%, transparent 72%)",
                      maskImage:
                        "radial-gradient(circle, black 38%, transparent 72%)",
                      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
                    }}
                  >
                    <AssetImage
                      assetId={decorAssetId(d.type)}
                      alt=""
                      fill
                      className="h-full w-full"
                      notDraggable
                    />
                  </div>

                  {/* Hover tooltip: prop name + reward chip. CSS-only
                      reveal via group-hover so it doesn't need per-decor
                      state. Touch users get the same on long-press via
                      :focus-within fallback (not perfect, but workable). */}
                  <div
                    className="pointer-events-none absolute left-1/2 top-0 z-[50] -translate-x-1/2 -translate-y-[110%] whitespace-nowrap rounded-full bg-bg-deep/95 px-2 py-0.5 opacity-0 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.7)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                    style={{
                      border: `1px solid ${def.color}88`,
                    }}
                  >
                    <span
                      className="font-display text-[9px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: def.color, fontFamily: "var(--font-cinzel)" }}
                    >
                      {def.label}
                    </span>
                    <span
                      className="ml-1.5 font-sans text-[9px] font-bold tabular-nums"
                      style={{ color: def.color }}
                    >
                      +{def.reward}
                    </span>
                  </div>

                  {/* Tutorial ring on the first visible item until the
                      player has cleared at least one decor item. */}
                  {isHint && (
                    <motion.span
                      className="pointer-events-none absolute inset-[-15%] rounded-full ring-2 ring-leaf"
                      animate={{
                        boxShadow: [
                          "0 0 0 0 rgba(127,176,105,0)",
                          "0 0 14px 2px rgba(127,176,105,0.7)",
                          "0 0 0 0 rgba(127,176,105,0)",
                        ],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      aria-hidden
                    />
                  )}
                </motion.button>
              );
            });
          })()}

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
                className={`relative z-[2] aspect-square transition-colors ${
                  occupant
                    ? "pointer-events-none bg-transparent"
                    : isAwaitingCellPick
                      ? "animate-pulse rounded-sm border border-gold/60 bg-gold/15 hover:bg-gold/25"
                      : isMoveTarget
                        ? "rounded-sm border border-gold/45 bg-gold/10 hover:bg-gold/15"
                        : "bg-transparent hover:bg-bg-deep/15"
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

              {/* Animated hand pointer drawing the eye toward the
                  BUILD button. Translates down + up in a loop with
                  a soft gold glow trail. */}
              <motion.div
                className="absolute right-6 bottom-2 flex flex-col items-center text-gold/90 sm:right-10"
                animate={{ y: [0, 14, 0], opacity: [0.65, 1, 0.65] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              >
                <ChevronDown
                  className="h-8 w-8 drop-shadow-[0_0_8px_rgba(212,160,74,0.7)]"
                  strokeWidth={3}
                />
              </motion.div>
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

          {/* Layer 3b — decor-clear floaters ("+10") flying upward. */}
          <AnimatePresence>
            {decorFloaters.map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 0, scale: 0.85 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: [0, -24, -64, -120],
                  scale: [0.85, 1.1, 1.0, 0.7],
                }}
                transition={{
                  duration: 1.1,
                  ease: "easeOut",
                  times: [0, 0.25, 0.7, 1],
                }}
                className="pointer-events-none z-[5] flex select-none items-center justify-center whitespace-nowrap font-display text-sm font-bold leading-none"
                style={{
                  gridColumn: `${f.x + 1} / span 1`,
                  gridRow: `${f.y + 1} / span 1`,
                  color: f.color,
                  alignSelf: "center",
                  justifySelf: "center",
                  textShadow:
                    "0 1px 0 rgba(0,0,0,0.75), 0 0 10px rgba(0,0,0,0.6), 0 0 16px " +
                    f.color +
                    "66",
                }}
                aria-hidden
              >
                +{f.amount}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Layer 4 — drag-in-progress ghost preview. Valid cells get
              a shimmering gold sweep gradient so the drop target reads
              as a "magical" placement zone. Invalid stays solid red so
              the rejection signal is unambiguous. */}
          {previewCells.map((pc) => (
            <motion.div
              key={`preview-${pc.x}-${pc.y}`}
              className={`pointer-events-none relative overflow-hidden rounded-sm ${
                pc.valid
                  ? "ring-2 ring-gold ring-inset"
                  : "bg-red-500/30 ring-2 ring-red-500/75 ring-inset"
              }`}
              style={{
                gridColumn: `${pc.x + 1} / span 1`,
                gridRow: `${pc.y + 1} / span 1`,
              }}
              aria-hidden
            >
              {pc.valid && (
                <motion.div
                  className="absolute inset-0"
                  initial={{ backgroundPosition: "0% 0%" }}
                  animate={{ backgroundPosition: "200% 0%" }}
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{
                    background:
                      "linear-gradient(115deg, rgba(212,160,74,0.18) 0%, rgba(245,217,122,0.55) 35%, rgba(212,160,74,0.18) 70%)",
                    backgroundSize: "200% 100%",
                  }}
                />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
