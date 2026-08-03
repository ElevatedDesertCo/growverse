// Thin DOM consumer for the Breeding window (strain genetics + commune reputation).
//
// The consumer half of the pure-core + thin-consumer split (reference garden_window.ts):
// it paints #breeding-window from the structured BreedingView (breeding_view.ts) and wires
// the pick-parent / breed / plant / release / close actions. It owns no state; the
// cross-window orchestration and the pending-parent picks stay in Hud. Interpolated strain
// names pass through esc(). This is an on-demand window (opened from the Grow Station,
// re-rendered on a library/standing change), NOT a per-frame painter, so direct innerHTML
// writes are fine (like the garden).

import { STRAIN_MASTERY_MAX } from '../sim/types';
import type { BreedingView } from './breeding_view';
import { esc } from './esc';
import { formatNumber, t } from './i18n';
import type { PainterHostPresentation } from './painter_host';
import { svgIcon } from './ui_icons';

export interface BreedingWindowDeps extends PainterHostPresentation {
  hideTooltip(): void;
  onPickParent(strainId: string, slot: 'a' | 'b'): void;
  onBreed(): void;
  onRefine(): void;
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
      // Provenance: what it came from and who made it. A base strain has neither,
      // and so does a strain from a save written before breeder credit landed, so
      // both lines are omitted rather than shown empty.
      const lineage = s.lineage
        ? `<div class="breeding-lineage">${esc(t('hudChrome.breeding.lineage', { a: s.lineage[0], b: s.lineage[1] }))}</div>`
        : '';
      const breeder = s.breeder
        ? `<div class="breeding-breeder">${esc(t('hudChrome.breeding.bredBy', { name: s.breeder }))}</div>`
        : '';
      // Mastery: the grower's own record with this strain, shown as a bar beside the
      // inherited traits so the two read as what they are. Traits are the strain's
      // ceiling; mastery is how close this grower gets to it.
      const masteryAria = t('hudChrome.breeding.masteryAria', {
        strain: s.name,
        mastery: num(s.mastery),
        max: num(STRAIN_MASTERY_MAX),
      });
      const mastery =
        `<div class="breeding-mastery" role="group" aria-label="${esc(masteryAria)}">` +
        `<span class="breeding-mastery-label">${esc(t('hudChrome.breeding.mastery'))}</span>` +
        `<div class="breeding-mastery-bar" style="--mastery-pct:${esc(num(s.masteryPct))}%">` +
        `<div class="breeding-mastery-fill"></div></div>` +
        `<span class="breeding-mastery-value">${esc(num(s.mastery))} / ${esc(num(STRAIN_MASTERY_MAX))}</span>` +
        `</div>`;
      row.innerHTML =
        `<div class="breeding-strain-head"><span class="breeding-strain-name">${esc(s.name)}</span>${landrace}</div>` +
        `<div class="breeding-traits">${traits}</div>` +
        mastery +
        lineage +
        breeder;

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

  // Footer: the cross action, its Epic Bud cost, and whichever note is blocking. The
  // cost is always shown (not only when short) so a player learns what a cross takes
  // before they are stopped by it; the shortfall note explains how to earn one, because
  // the answer is "grow better", not "grow more".
  const footer = document.createElement('div');
  footer.className = 'breeding-footer';
  const cost = t('hudChrome.breeding.cost', {
    count: formatNumber(view.breedCost, { maximumFractionDigits: 0 }),
    held: formatNumber(view.epicBuds, { maximumFractionDigits: 0 }),
  });
  // At capacity the note points at Refine rather than only saying "release something":
  // folding the second pick into the first frees the slot AND improves a strain, which
  // is a strictly better answer than throwing one away.
  const note = view.atCapacity
    ? t('hudChrome.breeding.fullRefine')
    : view.cannotAfford
      ? t('hudChrome.breeding.needEpicBuds')
      : '';
  footer.innerHTML =
    `<span class="breeding-cost${view.cannotAfford ? ' breeding-cost-short' : ''}">${esc(cost)}</span>` +
    (note ? `<span class="breeding-note">${esc(note)}</span>` : '');
  const breed = document.createElement('button');
  breed.type = 'button';
  breed.className = 'breeding-action breeding-breed';
  breed.disabled = !view.canBreed;
  breed.textContent = t('hudChrome.breeding.breed');
  breed.addEventListener('click', () => deps.onBreed());
  // Refine: same two picks, a different verb. A (the first pick) is the strain that is
  // kept and improved; B is folded into it and consumed.
  const refine = document.createElement('button');
  refine.type = 'button';
  refine.className = 'breeding-action breeding-refine';
  refine.disabled = !view.canRefine;
  refine.textContent = t('hudChrome.breeding.refine');
  refine.title = t('hudChrome.breeding.refineHint');
  refine.addEventListener('click', () => deps.onRefine());
  footer.append(breed, refine);
  el.appendChild(footer);

  el.querySelector('[data-close]')?.addEventListener('click', () => deps.onClose());
  el.style.display = 'block';
  el.scrollTop = scrollTop;
}
