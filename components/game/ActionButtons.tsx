"use client";

import { Pencil, Hammer } from "lucide-react";

export function ActionButtons() {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => console.log("edit clicked")}
        className="inline-flex items-center gap-2 rounded-full border border-gold/60 bg-bg-deep/60 px-5 py-2.5 text-sm font-medium tracking-wide text-gold transition-colors hover:bg-gold/10 active:bg-gold/15"
      >
        <Pencil className="h-4 w-4" strokeWidth={2} />
        Edit Base
      </button>

      <button
        type="button"
        onClick={() => console.log("build clicked")}
        className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold tracking-wide text-bg-deep shadow-[0_4px_18px_-6px_rgba(212,160,74,0.6)] transition-colors hover:bg-gold-dark active:bg-gold-dark"
      >
        <Hammer className="h-4 w-4" strokeWidth={2.25} />
        Build
      </button>
    </div>
  );
}
