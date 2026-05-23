"use client";

import { Pencil, Hammer, Check } from "lucide-react";
import { useGameStore } from "@/lib/store";

export function ActionButtons() {
  const editMode = useGameStore((s) => s.editMode);
  const toggleEditMode = useGameStore((s) => s.toggleEditMode);
  const openBuildMenu = useGameStore((s) => s.openBuildMenu);

  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={toggleEditMode}
        className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium tracking-wide transition-colors ${
          editMode
            ? "border-gold bg-gold text-bg-deep shadow-[0_4px_18px_-6px_rgba(212,160,74,0.6)]"
            : "border-gold/60 bg-bg-deep/60 text-gold hover:bg-gold/10 active:bg-gold/15"
        }`}
      >
        {editMode ? (
          <Check className="h-4 w-4" strokeWidth={2.5} />
        ) : (
          <Pencil className="h-4 w-4" strokeWidth={2} />
        )}
        {editMode ? "Done" : "Edit Base"}
      </button>

      <button
        type="button"
        onClick={() => openBuildMenu()}
        disabled={editMode}
        className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold tracking-wide text-bg-deep shadow-[0_4px_18px_-6px_rgba(212,160,74,0.6)] transition-colors hover:bg-gold-dark active:bg-gold-dark disabled:cursor-not-allowed disabled:bg-gold-muted disabled:text-bg-deep/60 disabled:shadow-none"
      >
        <Hammer className="h-4 w-4" strokeWidth={2.25} />
        Build
      </button>
    </div>
  );
}
