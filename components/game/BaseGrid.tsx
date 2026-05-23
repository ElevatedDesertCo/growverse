const ROWS = 6;
const COLS = 6;
const CELLS = Array.from({ length: ROWS * COLS });

export function BaseGrid() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="rounded-2xl border border-gold/20 bg-gradient-to-b from-bg-mid/60 to-bg-deep/60 p-2 shadow-[0_0_40px_-20px_rgba(212,160,74,0.35)]">
        <div className="grid aspect-square grid-cols-6 grid-rows-6 gap-px overflow-hidden rounded-xl">
          {CELLS.map((_, i) => (
            <div
              key={i}
              className="aspect-square border border-gold-muted/20 bg-bg-deep/40"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
