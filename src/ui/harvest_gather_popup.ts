// Harvest gather popup: a one-shot card that fades in over the HUD when a resource
// node (a Flower Patch, Bloom Thicket, ...) finishes being worked, showing the
// gathered reagent's icon + localized name. Self-contained so it lives outside the
// hud.ts monolith (root Modularity rule); the HUD composes it and feeds it the
// localized title + item id from the structured `harvestGather` SimEvent. No
// per-frame work: it only reacts to the gather event, so it drives the DOM directly
// here rather than through the per-frame elided writers. Mirrors fishing_catch_popup.
import { iconDataUrl } from './icons';

export interface HarvestGatherPopup {
  // `title` is already localized by the caller (the sim/event carries only the
  // item id, never text). `itemId` names the gathered reagent, drawn as its icon.
  show(opts: { title: string; itemId: string }): void;
}

const VISIBLE_MS = 2400;

export function createHarvestGatherPopup(parent: HTMLElement): HarvestGatherPopup {
  const el = document.createElement('div');
  el.id = 'harvest-gather';
  el.className = 'harvest-gather';
  // Announce the gather to assistive tech, but politely (it is incidental juice).
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');

  const icon = document.createElement('img');
  icon.className = 'harvest-gather-icon';
  // Decorative: the label already names the reagent, so the image is redundant to SR.
  icon.alt = '';
  icon.draggable = false;

  const label = document.createElement('div');
  label.className = 'harvest-gather-label';

  el.append(icon, label);
  parent.appendChild(el);

  let timer: number | undefined;

  return {
    show({ title, itemId }): void {
      label.textContent = title;
      icon.src = iconDataUrl('item', itemId);
      el.classList.add('show');
      clearTimeout(timer);
      timer = window.setTimeout(() => el.classList.remove('show'), VISIBLE_MS);
    },
  };
}
