// Thin DOM consumer for the Breeding window (strain genetics + commune reputation).
//
// The consumer half of the pure-core + thin-consumer split (reference garden_window.ts):
// it paints #breeding-window from the structured BreedingView (breeding_view.ts) and wires
// the pick-parent / breed / plant / release / close actions. It owns no state; the
// cross-window orchestration and the pending-parent picks stay in Hud. Interpolated strain
// names pass through esc(). This is an on-demand window (opened from the Grow Station,
// re-rendered on a library/standing change), NOT a per-frame painter, so direct innerHTML
// writes are fine (like the garden).

import type { BreedingView } from './breeding_view';
import { esc } from './esc';
import { formatNumber, t } from './i18n';
import type { PainterHostPresentation } from './painter_host';
import { svgIcon } from './ui_icons';

export interface BreedingWindowDeps extends PainterHostPresentation {
  hideTooltip(): void;
  onPickParent(strainId: string, slot: 'a' | 'b'): void;
  onBreed(): void;
  onPlant(strainId: string): void;
  onRelease(strainId: string): void;
  onClose(): void;
}

function num(n: number): string {
  return formatNumber(n, { maximumFractionDigits: 0 });
}

function pct(fraction: number): string {
  return formatNumber(Math.round(fraction * 100), { maximumFractionDigits: 0 });
}

/** Paint the breeding panel from a prepared view. */
export function renderBreedingWindow(
  el: HTMLElement,
  view: BreedingView,
  deps: BreedingWindowDeps,
): void {
  // The rebuild replaces the hovered row (its mouseleave never fires); drop the tooltip
  // and preserve the scroll like the sibling windows.
  deps.hideTooltip();
  const scrollTop = el.scrollTop;

  const title = t('hudChrome.breeding.title');
  el.innerHTML =
    `<div class="panel-title"><span>${esc(title)}</span><button type="button" class="x-btn" data-close aria-label="${esc(t('hudChrome.crafting.close'))}">${svgIcon('close')}</button></div>` +
    `<div class="breeding-hint">${esc(t('hudChrome.breeding.hint'))}</div>`;

  // Commune standing header: tier + progress toward the next tier per faction.
  const rep = document.createElement('div');
  rep.className = 'breeding-rep';
  rep.innerHTML = view.reputation
    .map((r) => {
      const tierName = t(`hudChrome.reputation.tier.${r.tier}` as Parameters<typeof t>[0]);
      const progressLabel = r.nextThreshold
        ? `${num(r.points)} / ${num(r.nextThreshold)}`
        : num(r.points);
      return (
        `<div class="breeding-rep-row">` +
        `<span class="breeding-rep-name">${esc(r.name)}</span>` +
        `<span class="breeding-rep-tier">${esc(tierName)}</span>` +
        `<div class="breeding-rep-bar"><div class="breeding-rep-fill" style="width:${esc(pct(r.progress))}%"></div></div>` +
        `<span class="breeding-rep-pts">${esc(progressLabel)}</span>` +
        `</div>`
      );
    })
    .join('');
  el.appendChild(rep);

  // Strain library list.
  const list = document.createElement('div');
  list.className = 'breeding-list';
  if (view.strains.length === 0) {
    list.innerHTML = `<div class="breeding-empty">${esc(t('hudChrome.breeding.empty'))}</div>`;
  } else {
    for (const s of view.strains) {
      const row = document.createElement('div');
      row.className = `breeding-strain${s.selectedAs ? ` breeding-strain-${s.selectedAs}` : ''}`;

      const landrace = s.landrace
        ? `<span class="breeding-landrace">${esc(t('hudChrome.breeding.landrace'))}</span>`
        : '';
      const traits =
        `<span class="breeding-trait">${esc(t('hudChrome.breeding.potency'))} ${esc(num(s.potency))}</span>` +
        `<span class="breeding-trait">${esc(t('hudChrome.breeding.vigor'))} ${esc(num(s.vigor))}</span>` +
        `<span class="breeding-trait">${esc(t('hudChrome.breeding.yield'))} ${esc(num(s.yield))}</span>`;
      row.innerHTML =
        `<div class="breeding-strain-head"><span class="breeding-strain-name">${esc(s.name)}</span>${landrace}</div>` +
        `<div class="breeding-traits">${traits}</div>`;

      const actions = document.createElement('div');
      actions.className = 'breeding-strain-actions';

      const pickA = document.createElement('button');
      pickA.type = 'button';
      pickA.className = `breeding-action breeding-pick${s.selectedAs === 'a' ? ' breeding-pick-on' : ''}`;
      pickA.textContent = t('hudChrome.breeding.parentA');
      pickA.setAttribute('aria-pressed', String(s.selectedAs === 'a'));
      pickA.addEventListener('click', () => deps.onPickParent(s.id, 'a'));

      const pickB = document.createElement('button');
      pickB.type = 'button';
      pickB.className = `breeding-action breeding-pick${s.selectedAs === 'b' ? ' breeding-pick-on' : ''}`;
      pickB.textContent = t('hudChrome.breeding.parentB');
      pickB.setAttribute('aria-pressed', String(s.selectedAs === 'b'));
      pickB.addEventListener('click', () => deps.onPickParent(s.id, 'b'));

      const plant = document.createElement('button');
      plant.type = 'button';
      plant.className = 'breeding-action breeding-plant';
      plant.disabled = view.firstEmptyPlot === null;
      plant.textContent = t('hudChrome.breeding.plant');
      plant.addEventListener('click', () => deps.onPlant(s.id));

      const release = document.createElement('button');
      release.type = 'button';
      release.className = 'breeding-action breeding-release';
      release.textContent = t('hudChrome.breeding.release');
      release.addEventListener('click', () => deps.onRelease(s.id));

      actions.append(pickA, pickB, plant, release);
      row.appendChild(actions);
      list.appendChild(row);
    }
  }
  el.appendChild(list);

  // Footer: the cross action + capacity note.
  const footer = document.createElement('div');
  footer.className = 'breeding-footer';
  if (view.atCapacity) {
    footer.innerHTML = `<span class="breeding-note">${esc(t('hudChrome.breeding.full'))}</span>`;
  }
  const breed = document.createElement('button');
  breed.type = 'button';
  breed.className = 'breeding-action breeding-breed';
  breed.disabled = !view.canBreed;
  breed.textContent = t('hudChrome.breeding.breed');
  breed.addEventListener('click', () => deps.onBreed());
  footer.appendChild(breed);
  el.appendChild(footer);

  el.querySelector('[data-close]')?.addEventListener('click', () => deps.onClose());
  el.style.display = 'block';
  el.scrollTop = scrollTop;
}
