// Fishing catch popup: a one-shot card that fades in over the HUD when a cast
// resolves, showing the caught fish's icon + localized name (or a "nothing was
// caught" line on a miss). Self-contained so it lives outside the hud.ts monolith
// (root Modularity rule); the HUD composes it and feeds it the localized title +
// item id from the structured `fishCatch` SimEvent. No per-frame work: it only
// reacts to the catch event, so it drives the DOM directly here rather than
// through the per-frame elided writers.
import { iconDataUrl } from './icons';

export interface FishingCatchPopup {
  // `title` is already localized by the caller (the sim/event carries only the
  // item id, never text). `itemId` null = a miss (no icon shown). `rare` tints
  // the card for the special catch.
  show(opts: { title: string; itemId: string | null; rare: boolean }): void;
}

const VISIBLE_MS = 2800;

export function createFishingCatchPopup(parent: HTMLElement): FishingCatchPopup {
  const el = document.createElement('div');
  el.id = 'fishing-catch';
  el.className = 'fishing-catch';
  // Announce the catch to assistive tech, but politely (it is incidental juice).
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');

  const icon = document.createElement('img');
  icon.className = 'fishing-catch-icon';
  // Decorative: the label already names the fish, so the image is redundant to SR.
  icon.alt = '';
  icon.draggable = false;

  const label = document.createElement('div');
  label.className = 'fishing-catch-label';

  el.append(icon, label);
  parent.appendChild(el);

  let timer: number | undefined;

  return {
    show({ title, itemId, rare }): void {
      label.textContent = title;
      if (itemId) {
        icon.src = iconDataUrl('item', itemId);
        icon.style.display = '';
      } else {
        icon.removeAttribute('src');
        icon.style.display = 'none';
      }
      el.classList.toggle('rare', rare);
      el.classList.add('show');
      clearTimeout(timer);
      timer = window.setTimeout(() => el.classList.remove('show'), VISIBLE_MS);
    },
  };
}
