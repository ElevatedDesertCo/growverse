"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useToastStore, type ToastKind } from "@/lib/systems/toastSystem";

/** Lucide icon + default accent per kind. */
function iconFor(kind: ToastKind) {
  switch (kind) {
    case "success":
      return CheckCircle2;
    case "error":
      return AlertTriangle;
    default:
      return Info;
  }
}

function defaultAccent(kind: ToastKind): string {
  switch (kind) {
    case "success":
      return "#7fb069"; // leaf
    case "error":
      return "#d97757"; // warm warning red — softer than pure red on dark bg
    default:
      return "#d4a04a"; // gold
  }
}

export function ToastStack() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismissToast);

  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-50 flex flex-col items-center gap-2 px-3"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = iconFor(t.kind);
          const accent = t.accent ?? defaultAccent(t.kind);
          return (
            <motion.button
              key={t.id}
              type="button"
              layout
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onClick={() => dismiss(t.id)}
              className="pointer-events-auto flex max-w-[24rem] items-start gap-2.5 rounded-full border bg-bg-deep/95 px-4 py-2 shadow-[0_10px_28px_-10px_rgba(0,0,0,0.7)] backdrop-blur"
              style={{ borderColor: `${accent}60` }}
              aria-label={`Dismiss: ${t.title}`}
            >
              <Icon
                className="mt-px h-4 w-4 flex-shrink-0"
                style={{ color: accent }}
                strokeWidth={2.5}
              />
              <div className="flex flex-col items-start text-left leading-tight">
                <span
                  className="font-display text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: accent }}
                >
                  {t.title}
                </span>
                {t.body && (
                  <span className="mt-0.5 font-sans text-[11px] text-text-muted">
                    {t.body}
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
