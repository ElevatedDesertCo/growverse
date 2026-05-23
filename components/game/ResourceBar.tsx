import Image from "next/image";

type ResourceProps = {
  iconSrc: string;
  alt: string;
  value: number;
  colorClass: string;
};

function ResourcePill({ iconSrc, alt, value, colorClass }: ResourceProps) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-gold/40 bg-bg-deep/80 px-1.5 py-0.5 shadow-[0_0_0_1px_rgba(212,160,74,0.05)_inset]">
      <Image
        src={iconSrc}
        alt={alt}
        width={275}
        height={275}
        className="h-5 w-5 flex-shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
      />
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
    <header className="sticky top-0 z-30 border-b border-gold/15 bg-bg-deep/80 backdrop-blur supports-[backdrop-filter]:bg-bg-deep/60">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-3 py-2">
        <div className="flex flex-col items-start leading-none">
          <Image
            src="/brand/wordmark.png"
            alt="GROWVERSE"
            width={1472}
            height={380}
            priority
            className="h-8 w-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
          />
          <span className="mt-1 font-sans text-[9px] uppercase tracking-[0.35em] text-text-muted">
            GC1
          </span>
        </div>

        <div className="flex items-center gap-1">
          <ResourcePill
            iconSrc="/icons/leaf.png"
            alt="Leaf"
            value={3200}
            colorClass="text-leaf"
          />
          <ResourcePill
            iconSrc="/icons/fire.png"
            alt="Fire"
            value={1400}
            colorClass="text-fire"
          />
          <ResourcePill
            iconSrc="/icons/mushroom.png"
            alt="Mushroom"
            value={420}
            colorClass="text-mushroom"
          />
        </div>
      </div>
    </header>
  );
}
