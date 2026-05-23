import { Leaf, Flame, Sparkles } from "lucide-react";

type ResourceProps = {
  Icon: typeof Leaf;
  value: number;
  colorClass: string;
};

function ResourcePill({ Icon, value, colorClass }: ResourceProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-bg-deep/80 px-2.5 py-1 shadow-[0_0_0_1px_rgba(212,160,74,0.05)_inset]">
      <Icon className={`h-3.5 w-3.5 ${colorClass}`} strokeWidth={2.25} />
      <span
        className={`font-sans text-xs font-semibold tabular-nums ${colorClass}`}
      >
        {value.toLocaleString()}
      </span>
    </div>
  );
}

export function ResourceBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-gold/15 bg-bg-deep/95 backdrop-blur supports-[backdrop-filter]:bg-bg-deep/70">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <div className="flex flex-col leading-none">
          <span
            className="font-display text-base font-semibold tracking-[0.25em] text-gold"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            GROWVERSE
          </span>
          <span className="mt-0.5 font-sans text-[10px] uppercase tracking-[0.35em] text-text-muted">
            GC1
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <ResourcePill Icon={Leaf} value={3200} colorClass="text-leaf" />
          <ResourcePill Icon={Flame} value={1400} colorClass="text-fire" />
          <ResourcePill
            Icon={Sparkles}
            value={420}
            colorClass="text-mushroom"
          />
        </div>
      </div>
    </header>
  );
}
