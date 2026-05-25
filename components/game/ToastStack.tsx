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
              initial={{ opacity: 0, y: -14, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onClick={() => dismiss(t.id)}
              className="pointer-events-auto flex max-w-[24rem] items-center gap-2.5 rounded-2xl p-[1.5px]"
              style={{
                background: `linear-gradient(135deg, ${accent}ee 0%, ${accent}55 40%, ${accent}33 100%)`,
                boxShadow: `0 10px 28px -10px rgba(0,0,0,0.75), 0 0 22px -6px ${accent}66`,
              }}
              aria-label={`Dismiss: ${t.title}`}
            >
              <div className="flex w-full items-center gap-2.5 rounded-[14px] bg-bg-deep/95 px-3 py-2 backdrop-blur">
                {/* Icon disc — matches the resource pill aesthetic */}
                <div
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, ${accent}cc, ${accent}55 60%, ${accent}22)`,
                    boxShadow: `inset 0 0 0 1px ${accent}88, 0 0 8px ${accent}66`,
                  }}
                >
                  <Icon
                    className="h-3.5 w-3.5"
                    style={{
                      color: "#0f0a06",
                      filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.35))",
                    }}
                    strokeWidth={2.75}
                  />
                </div>
                <div className="flex min-w-0 flex-col items-start text-left leading-tight">
                  <span
                    className="font-display text-[11px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: accent, fontFamily: "var(--font-cinzel)" }}
                  >
                    {t.title}
                  </span>
                  {t.body && (
                    <span className="mt-0.5 truncate font-sans text-[11px] text-text-muted">
                      {t.body}
                    </span>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
