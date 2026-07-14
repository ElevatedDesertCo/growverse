// Thin DOM consumer for the Garden window (cultivation).
//
// The consumer half of the pure-core + thin-consumer split (reference
// crafting_window.ts / stash_window.ts): it paints #garden-window from the
// structured GardenView (garden_view.ts) and wires the select-seed / plant /
// harvest / close actions. It owns no state; the cross-window orchestration and
// the selected-seed state stay in Hud. Interpolated names pass through esc(); seed
// names come from the item table via itemDisplayName, not raw t(). This is an
// on-demand window (opened from the Grow Station, re-rendered on a garden change),
// NOT a per-frame painter, so direct innerHTML writes are fine (like crafting).

import { itemDisplayName } from './entity_i18n';
import { esc } from './esc';
import type { GardenView } from './garden_view';
import { formatNumber, t } from './i18n';
import type { PainterHostPresentation } from './painter_host';
import { svgIcon } from './ui_icons';

export interface GardenWindowDeps extends PainterHostPresentation {
  hideTooltip(): void;
  onSelectSeed(seedItemId: string): void;
  onPlant(plotIndex: number): void;
  onHarvest(plotIndex: number): void;
  onClose(): void;
}

function pct(fraction: number): string {
  return formatNumber(Math.round(fraction * 100), { maximumFractionDigits: 0 });
}

/** Paint the garden panel from a prepared view. */
export function renderGardenWindow(
  el: HTMLElement,
  view: GardenView,
  deps: GardenWindowDeps,
): void {
  // The rebuild replaces the hovered plot (its mouseleave never fires); drop the
  // tooltip and preserve the scroll like the sibling windows.
  deps.hideTooltip();
  const scrollTop = el.scrollTop;

  const title = t('hudChrome.garden.title');
  el.innerHTML =
    `<div class="panel-title"><span>${esc(title)}</span><button type="button" class="x-btn" data-close aria-label="${esc(t('hudChrome.crafting.close'))}">${svgIcon('close')}</button></div>` +
    `<div class="garden-hint">${esc(t('hudChrome.garden.hint'))}</div>`;

  // Seed selector: which strain the Plant buttons will sow. Empty when the player
  // carries no plantable seed.
  const selector = document.createElement('div');
  selector.className = 'garden-seedbar';
  if (view.seeds.length === 0) {
    selector.innerHTML = `<span class="garden-noseeds">${esc(t('hudChrome.garden.noSeeds'))}</span>`;
  } else {
    const label = `<span class="garden-seedlabel">${esc(t('hudChrome.garden.seedLabel'))}</span>`;
    const opts = view.seeds
      .map((s) => {
        const selected = s.itemId === view.selectedSeedId;
        const name = itemDisplayName(s.item);
        return `<button type="button" class="garden-seedopt${selected ? ' garden-seedopt-on' : ''}" data-seed="${esc(s.itemId)}" aria-pressed="${selected}">${deps.itemIcon(s.item)}<span class="garden-seedopt-name">${esc(name)}</span> <span class="garden-seedopt-count">${esc(formatNumber(s.count, { maximumFractionDigits: 0 }))}</span></button>`;
      })
      .join('');
    selector.innerHTML = `${label}<div class="garden-seedopts">${opts}</div>`;
  }
  el.appendChild(selector);

  const grid = document.createElement('div');
  grid.className = 'garden-grid';
  for (const plot of view.plots) {
    const cell = document.createElement('div');
    cell.className = `garden-plot garden-plot-${plot.stage}`;

    if (plot.stage === 'empty') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'garden-action garden-plant';
      btn.disabled = !plot.canPlant;
      btn.textContent = t('hudChrome.garden.plant');
      btn.addEventListener('click', () => deps.onPlant(plot.index));
      cell.innerHTML = `<div class="garden-plot-label">${esc(t('hudChrome.garden.empty'))}</div>`;
      cell.appendChild(btn);
    } else {
      const seedName = plot.seedItem ? itemDisplayName(plot.seedItem) : '';
      const icon = plot.seedItem ? deps.itemIcon(plot.seedItem) : '';
      const ready = plot.stage === 'ready';
      const status = ready
        ? `<span class="garden-ready">${esc(t('hudChrome.garden.ready'))}</span>`
        : `<span class="garden-progress-pct">${esc(pct(plot.progress))}%</span>`;
      cell.innerHTML =
        `<div class="garden-plot-crop">${icon}<span class="garden-plot-name">${esc(seedName)}</span></div>` +
        `<div class="garden-progress"><div class="garden-progress-fill" style="width:${esc(pct(plot.progress))}%"></div></div>` +
        `<div class="garden-plot-status">${status}</div>`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'garden-action garden-harvest';
      btn.disabled = !plot.canHarvest;
      btn.textContent = t('hudChrome.garden.harvest');
      btn.addEventListener('click', () => deps.onHarvest(plot.index));
      cell.appendChild(btn);
    }
    grid.appendChild(cell);
  }
  el.appendChild(grid);

  el.querySelectorAll('[data-seed]').forEach((node) => {
    const seedId = (node as HTMLElement).dataset.seed;
    if (seedId) node.addEventListener('click', () => deps.onSelectSeed(seedId));
  });
  el.querySelector('[data-close]')?.addEventListener('click', () => deps.onClose());
  el.style.display = 'block';
  el.scrollTop = scrollTop;
}
