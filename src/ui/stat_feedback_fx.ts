// Thin DOM consumer for the pure stat-feedback detector (stat_feedback.ts). It owns
// the overlay elements the pulses light up and turns a StatPulses set into one-shot
// Web-Animations (.animate) calls: an EVENT-driven flourish, not a per-frame DOM
// write, so it sits OUTSIDE the write-elision hot path (like an FCT spawn). Heals,
// mana gains, xp gains, and level-ups are infrequent, so a rare .animate() per event
// costs nothing at steady state.
//
// Every keyframe drives ONLY opacity / transform, never a colour: the colours live
// in hud.css on the overlay elements, so this consumer holds no magic values. All
// motion is suppressed under prefers-reduced-motion (the flourishes are cosmetic and
// carry no information the bars/text do not already show).

import type { StatPulses } from './stat_feedback';

export interface StatFeedbackElements {
  /** #pf-hp-heal: the heal-restore glow inside the health fill. */
  healFlash: HTMLElement;
  /** #pf-res-shimmer: the mana-regen shimmer sweep inside the mana fill. */
  manaShimmer: HTMLElement;
  /** #xp-gain: the bright pulse that sweeps the xp fill on a gain. */
  xpGain: HTMLElement;
  /** #pf-level-glow: the gold pulse ring behind the level medallion. */
  levelGlow: HTMLElement;
  /** #pf-level: the level medallion (scaled on level-up). */
  levelChip: HTMLElement;
}

// Flourish durations (ms). Named constants, not magic literals: the perf/cadence
// tunables the module owns.
const HEAL_MS = 460;
const SHIMMER_MS = 640;
const XP_MS = 620;
const LEVEL_MS = 720;

type Keyframes = Keyframe[];

export class StatFeedbackFx {
  // The OS-level preference, snapshot once (matches how the rest of the client reads
  // it at construction). The in-game Reduce Motion toggle is read LIVE in play() via
  // the body.reduce-motion class so a runtime flip takes effect without a reload.
  private readonly osReduceMotion: boolean;

  constructor(private readonly el: StatFeedbackElements) {
    this.osReduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Play the flourishes for the pulses that fired this frame. A no-op when nothing
   *  fired or motion is reduced (OS preference OR the in-game Reduce Motion setting,
   *  which mirrors onto body.reduce-motion; WAAPI animations are not caught by the
   *  CSS reduce-motion killer, so they must be gated here in JS). */
  play(p: StatPulses): void {
    if (this.osReduceMotion || this.reduceMotionSetting()) return;
    if (p.heal) this.run(this.el.healFlash, HEAL_FLASH, HEAL_MS);
    if (p.mana) this.run(this.el.manaShimmer, SWEEP, SHIMMER_MS);
    if (p.xp) this.run(this.el.xpGain, SWEEP, XP_MS);
    if (p.levelUp) {
      this.run(this.el.levelGlow, LEVEL_GLOW, LEVEL_MS);
      this.run(this.el.levelChip, LEVEL_POP, LEVEL_MS);
    }
  }

  // The in-game Reduce Motion toggle, read live (body.reduce-motion is the class
  // main.ts mirrors the setting onto). Guarded for a DOM-less test host.
  private reduceMotionSetting(): boolean {
    return typeof document !== 'undefined' && document.body.classList.contains('reduce-motion');
  }

  // element.animate is unavailable under a DOM-less test host, so guard it.
  private run(el: HTMLElement, frames: Keyframes, ms: number): void {
    el.animate?.(frames, { duration: ms, easing: 'ease-out' });
  }
}

// A brief opacity swell: the leading-edge heal glow blooms then fades.
const HEAL_FLASH: Keyframes = [{ opacity: 0 }, { opacity: 0.6, offset: 0.3 }, { opacity: 0 }];

// A highlight that sweeps left-to-right across the fill (mana regen, xp gain).
const SWEEP: Keyframes = [
  { opacity: 0, transform: 'translateX(-60%)' },
  { opacity: 0.75, offset: 0.35 },
  { opacity: 0, transform: 'translateX(160%)' },
];

// The gold pulse ring behind the medallion expands and fades on level-up.
const LEVEL_GLOW: Keyframes = [
  { opacity: 0, transform: 'scale(0.55)' },
  { opacity: 0.9, offset: 0.35 },
  { opacity: 0, transform: 'scale(1.7)' },
];

// The medallion springs up then settles back on level-up.
const LEVEL_POP: Keyframes = [
  { transform: 'scale(1)' },
  { transform: 'scale(1.32)', offset: 0.35 },
  { transform: 'scale(1)' },
];
