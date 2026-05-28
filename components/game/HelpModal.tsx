"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  HelpCircle,
  Hammer,
  Leaf,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { playSfx } from "@/lib/systems/audioSystem";

/**
 * Game help sheet — opened from Settings or via the "?" keyboard
 * shortcut. Lists the core loop, controls, and a quick reference for
 * keyboard shortcuts. Shares the gold-trim aesthetic of the other
 * modals.
 */
export function HelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const dismiss = () => {
    playSfx("buttonClick");
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="help-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={dismiss}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            aria-hidden
          />
          <motion.div
            key="help-modal"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,94vw)] max-h-[82dvh] -translate-x-1/2 -translate-y-1/2 overflow-hidden"
          >
            <div
              className="rounded-2xl p-[2px]"
              style={{
                background:
                  "linear-gradient(180deg, #e6c98a 0%, #b8852e 50%, #5a3f1a 100%)",
                boxShadow:
                  "0 24px 60px -20px rgba(0,0,0,0.85), 0 0 60px -10px rgba(212,160,74,0.4)",
              }}
            >
              <div className="relative flex max-h-[calc(82dvh-4px)] flex-col rounded-2xl bg-bg-deep/95 backdrop-blur">
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Close"
                  className="absolute right-2 top-2 z-10 rounded-full p-1.5 text-text-muted transition-colors hover:bg-bg-mid/60 hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
                <header className="flex items-center gap-3 border-b border-gold/15 px-6 py-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle at 35% 30%, #f5d97aaa, #d4a04a 50%, #8b6c2e 100%)",
                      boxShadow:
                        "0 0 14px rgba(212,160,74,0.55), inset 0 1px 0 rgba(255,255,255,0.3)",
                    }}
                    aria-hidden
                  >
                    <HelpCircle className="h-5 w-5 text-bg-deep" strokeWidth={2.25} />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <h2
                      id="help-title"
                      className="font-display text-base font-bold uppercase tracking-[0.22em] text-gold"
                      style={{
                        fontFamily: "var(--font-cinzel)",
                        textShadow: "0 1px 0 rgba(0,0,0,0.55)",
                      }}
                    >
                      How to play
                    </h2>
                    <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-text-muted">
                      Growverse · Guild Wars
                    </span>
                  </div>
                </header>

                <div className="space-y-4 overflow-y-auto px-6 py-4">
                  <Section title="The core loop">
                    <HelpStep
                      accent="#c9a878"
                      Icon={Leaf}
                      title="Clear the desert"
                      body="Tap cacti, shrubs, and rocks to harvest their resources. Decor regrows slowly so you always have something to clear when you return."
                    />
                    <HelpStep
                      accent="#d4a04a"
                      Icon={Hammer}
                      title="Build your base"
                      body="Open the Build menu, drag a card onto a glowing cell. Your Guild Core is free to place — it's the heart of your guild."
                    />
                    <HelpStep
                      accent="#7fb069"
                      Icon={Sparkles}
                      title="Upgrade to unlock"
                      body="Tap a placed building to open its Upgrade panel. Raise your Guild Core's level to unlock new building tiers (L2 → defense, L3 → spirit pets, L4 → portal)."
                    />
                    <HelpStep
                      accent="#a875d4"
                      Icon={Pencil}
                      title="Edit when you need to"
                      body="The pencil button opens edit mode — tap a building to select, tap another cell to move it, or use the Delete pill for a 30% refund."
                    />
                  </Section>

                  <Section title="Keyboard shortcuts (desktop)">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <Shortcut keys={["B"]} body="Open Build menu" />
                      <Shortcut keys={["E"]} body="Toggle Edit mode" />
                      <Shortcut keys={["M"]} body="Mute / unmute all audio" />
                      <Shortcut keys={["?"]} body="Open this help" />
                      <Shortcut keys={["Esc"]} body="Close current panel" />
                    </div>
                  </Section>

                  <Section title="HUD signals">
                    <ul className="space-y-1.5 text-[11px] leading-snug text-text-muted">
                      <Bullet color="#7fb069">A green +N popping out of the resource bar means you just collected that amount.</Bullet>
                      <Bullet color="#d4a04a">A small gold ↑ on a placed building means you can afford its next upgrade right now.</Bullet>
                      <Bullet color="#e8964c">A flame badge on the HUD shows your consecutive-day claim streak.</Bullet>
                      <Bullet color="#a875d4">A purple particle floater shows the resource you earned from a clear or harvest.</Bullet>
                    </ul>
                  </Section>
                </div>

                <footer className="border-t border-gold/15 px-6 py-3">
                  <button
                    type="button"
                    onClick={dismiss}
                    className="ml-auto block rounded-full bg-gold px-5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.22em] text-bg-deep shadow-[0_4px_14px_-4px_rgba(212,160,74,0.7)] transition-colors hover:bg-gold-dark"
                  >
                    Got It
                  </button>
                </footer>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3
        className="mb-2 font-display text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function HelpStep({
  accent,
  Icon,
  title,
  body,
}: {
  accent: string;
  Icon: typeof Leaf;
  title: string;
  body: string;
}) {
  return (
    <div className="mb-2 flex items-start gap-2.5">
      <div
        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${accent}cc, ${accent}55 60%, ${accent}22)`,
          boxShadow: `inset 0 0 0 1px ${accent}88, 0 0 8px ${accent}55`,
        }}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5 text-bg-deep" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col leading-tight">
        <span
          className="font-display text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: accent, fontFamily: "var(--font-cinzel)" }}
        >
          {title}
        </span>
        <span className="mt-0.5 text-[11px] leading-snug text-text-muted">{body}</span>
      </div>
    </div>
  );
}

function Shortcut({ keys, body }: { keys: string[]; body: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {keys.map((k) => (
          <span
            key={k}
            className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-gold/30 bg-bg-mid/60 px-1.5 font-mono text-[10px] font-bold text-gold"
          >
            {k}
          </span>
        ))}
      </div>
      <span className="text-text-muted">{body}</span>
    </div>
  );
}

function Bullet({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      <span
        className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}
