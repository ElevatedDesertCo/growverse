// Item pickup popup: a small stack of one-shot toasts the HUD pops whenever the
// player GAINS an item (loot, harvest, chest, pickup, quest/craft reward). Each
// toast shows the item's icon, its quality-colored name, and an "xN" badge when
// more than one landed, then fades out on a timer. Self-contained so it lives
// outside the hud.ts monolith (root Modularity rule); the HUD composes it and
// feeds it already-localized strings + the item id, so this module stays
// i18n-free. Event-driven (never per-frame), so it drives the DOM directly here
// rather than through the per-frame elided writers, exactly like the sibling
// fishing_catch_popup.ts.
import { iconDataUrl } from './icons';

export interface ItemPickupPopup {
  // `name` and `countLabel` are already localized by the caller (the sim/event
  // carries only the item id + count). `countLabel` is empty for a single item.
  // `color` is the item's quality color (from QUALITY_COLOR), used to tint the
  // name + card edge via a CSS custom property (no literal color lives here).
  push(opts: { itemId: string; name: string; countLabel: string; color: string }): void;
}

// How long each toast stays before it fades, and how many stack at once (older
// toasts FIFO-evict past the cap so a loot burst can never grow without bound).
const VISIBLE_MS = 3200;
const MAX_ROWS = 5;

export function createItemPickupPopup(parent: HTMLElement): ItemPickupPopup {
  const stack = document.createElement('div');
  stack.id = 'item-pickups';
  stack.className = 'item-pickups';
  // Announce each pickup to assistive tech, but politely (incidental juice).
  stack.setAttribute('role', 'status');
  stack.setAttribute('aria-live', 'polite');
  parent.appendChild(stack);

  const evict = (row: HTMLElement): void => {
    if (row.parentElement === stack) stack.removeChild(row);
  };

  return {
    push({ itemId, name, countLabel, color }): void {
      const row = document.createElement('div');
      row.className = 'item-pickup';
      row.style.setProperty('--pickup-quality', color);

      const icon = document.createElement('img');
      icon.className = 'item-pickup-icon';
      // Decorative: the label already names the item, so the image is redundant to SR.
      icon.alt = '';
      icon.draggable = false;
      icon.src = iconDataUrl('item', itemId);

      const label = document.createElement('span');
      label.className = 'item-pickup-label';
      label.textContent = name;

      row.append(icon, label);
      if (countLabel) {
        const badge = document.createElement('span');
        badge.className = 'item-pickup-count';
        badge.textContent = countLabel;
        row.append(badge);
      }

      // Newest on top; cap the live count so a burst FIFO-evicts the oldest.
      stack.insertBefore(row, stack.firstChild);
      while (stack.childElementCount > MAX_ROWS && stack.lastElementChild) {
        stack.removeChild(stack.lastElementChild);
      }

      // Fade-in on the next frame so the transition runs from the hidden state.
      requestAnimationFrame(() => row.classList.add('show'));
      window.setTimeout(() => {
        row.classList.remove('show');
        // Remove after the fade-out transition (kept in sync with the CSS timing).
        window.setTimeout(() => evict(row), 400);
      }, VISIBLE_MS);
    },
  };
}
