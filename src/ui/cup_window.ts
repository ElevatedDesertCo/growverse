// Thin DOM consumer for the Vale Cup window.
//
// The consumer half of the pure-core + thin-consumer split (reference garden_window.ts /
// breeding_window.ts): it paints #cup-window from the structured CupView (cup_view.ts)
// and wires the pick / enter / close actions. It owns no state; the cross-window
// orchestration and the pending picks stay in Hud. Grower and strain names are proper
// nouns spliced through esc(), never localized. This is an on-demand window, NOT a
// per-frame painter, so direct innerHTML writes are fine (like crafting and breeding).

import type { CupView } from './cup_view';
import { itemDisplayName } from './entity_i18n';
import { esc } from './esc';
import { formatNumber, t } from './i18n';
import type { PainterHostPresentation } from './painter_host';
import { svgIcon } from './ui_icons';

export interface CupWindowDeps extends PainterHostPresentation {
  hideTooltip(): void;
  onPickStrain(strainId: string): void;
  onPickBud(budItemId: string): void;
  onEnter(): void;
  onClose(): void;
}

const num = (n: number): string => formatNumber(n, { maximumFractionDigits: 0 });

// Whole minutes remaining, floored: a season is 48 hours, so a seconds-precise countdown
// would churn the panel for no one's benefit.
function remainingLabel(seconds: number): string {
  const mins = Math.max(0, Math.floor(seconds / 60));
  const hours = Math.floor(mins / 60);
  return hours > 0
    ? t('hudChrome.cup.remainingHours', { hours: num(hours), minutes: num(mins % 60) })
    : t('hudChrome.cup.remainingMinutes', { minutes: num(mins) });
}

/** Paint the Cup panel from a prepared view. */
export function renderCupWindow(el: HTMLElement, view: CupView, deps: CupWindowDeps): void {
  deps.hideTooltip();
  const scrollTop = el.scrollTop;

  el.innerHTML =
    `<div class="panel-title"><span>${esc(t('hudChrome.cup.title'))}</span>` +
    `<button type="button" class="x-btn" data-close aria-label="${esc(t('hudChrome.crafting.close'))}">${svgIcon('close')}</button></div>` +
    `<div class="cup-hint">${esc(t('hudChrome.cup.hint'))}</div>` +
    `<div class="cup-season">${esc(
      t('hudChrome.cup.season', { season: num(view.season + 1) }),
    )} <span class="cup-remaining">${esc(remainingLabel(view.secondsRemaining))}</span></div>` +
    `<div class="cup-best">${esc(t('hudChrome.cup.best', { score: num(view.best) }))}</div>`;

  // The board. Shown first because it is the point of the window: what the field looks
  // like right now, and where you sit in it.
  const board = document.createElement('div');
  board.className = 'cup-board';
  if (view.board.length === 0) {
    board.innerHTML = `<div class="cup-empty">${esc(t('hudChrome.cup.emptyBoard'))}</div>`;
  } else {
    board.innerHTML = view.board
      .map(
        (r) =>
          `<div class="cup-row${r.isSelf ? ' cup-row-self' : ''}">` +
          `<span class="cup-rank">${esc(num(r.rank))}</span>` +
          `<span class="cup-grower">${esc(r.growerName)}</span>` +
          `<span class="cup-strain">${esc(r.strainName)}</span>` +
          `<span class="cup-score">${esc(num(r.score))}</span></div>`,
      )
      .join('');
  }
  el.appendChild(board);

  // Once posted, the entry form is replaced by the standing: one entry per season, so
  // leaving a dead form on screen would only invite a click that cannot work.
  if (view.ownEntry) {
    const posted = document.createElement('div');
    posted.className = 'cup-posted';
    posted.textContent = t('hudChrome.cup.posted', {
      strain: view.ownEntry.strainName,
      score: num(view.ownEntry.score),
      rank: num(view.ownEntry.rank),
    });
    el.appendChild(posted);
    el.querySelector('[data-close]')?.addEventListener('click', () => deps.onClose());
    el.style.display = 'block';
    el.scrollTop = scrollTop;
    return;
  }

  const form = document.createElement('div');
  form.className = 'cup-entry';

  // Grade picker first: it decides the projected score shown against every strain below,
  // so picking it first is the order the numbers actually make sense in.
  const budBar = document.createElement('div');
  budBar.className = 'cup-buds';
  if (view.buds.length === 0) {
    budBar.innerHTML = `<span class="cup-note">${esc(t('hudChrome.cup.noBuds'))}</span>`;
  } else {
    budBar.innerHTML =
      `<span class="cup-label">${esc(t('hudChrome.cup.gradeLabel'))}</span>` +
      view.buds
        .map((b) => {
          const on = b.itemId === view.selectedBudId;
          return (
            `<button type="button" class="cup-bud${on ? ' cup-bud-on' : ''}" data-bud="${esc(b.itemId)}"` +
            ` aria-pressed="${on}"${b.enough ? '' : ' disabled'}>` +
            `${deps.itemIcon(b.item)}<span>${esc(itemDisplayName(b.item))}</span>` +
            `<span class="cup-bud-count">${esc(num(b.count))}</span></button>`
          );
        })
        .join('');
  }
  form.appendChild(budBar);

  const list = document.createElement('div');
  list.className = 'cup-strains';
  if (view.strains.length === 0) {
    list.innerHTML = `<div class="cup-empty">${esc(t('hudChrome.cup.noStrains'))}</div>`;
  } else {
    list.innerHTML =
      `<span class="cup-label">${esc(t('hudChrome.cup.strainLabel'))}</span>` +
      view.strains
        .map((s) => {
          const on = s.id === view.selectedStrainId;
          const landrace = s.landrace
            ? `<span class="cup-landrace">${esc(t('hudChrome.breeding.landrace'))}</span>`
            : '';
          // The projected score is the whole reason this list is not just a name picker.
          const projected = view.selectedBudId
            ? `<span class="cup-projected">${esc(t('hudChrome.cup.projected', { score: num(s.projectedScore) }))}</span>`
            : '';
          return (
            `<button type="button" class="cup-strain-opt${on ? ' cup-strain-opt-on' : ''}"` +
            ` data-strain="${esc(s.id)}" aria-pressed="${on}">` +
            `<span class="cup-strain-name">${esc(s.name)}</span>${landrace}${projected}</button>`
          );
        })
        .join('');
  }
  form.appendChild(list);

  const enter = document.createElement('button');
  enter.type = 'button';
  enter.className = 'cup-action cup-enter';
  enter.disabled = !view.canEnter;
  enter.textContent = t('hudChrome.cup.enter', {
    count: num(view.entryCost),
    score: num(view.projectedScore),
  });
  enter.addEventListener('click', () => deps.onEnter());
  form.appendChild(enter);
  el.appendChild(form);

  el.querySelectorAll('[data-bud]').forEach((node) => {
    const id = (node as HTMLElement).dataset.bud;
    if (id) node.addEventListener('click', () => deps.onPickBud(id));
  });
  el.querySelectorAll('[data-strain]').forEach((node) => {
    const id = (node as HTMLElement).dataset.strain;
    if (id) node.addEventListener('click', () => deps.onPickStrain(id));
  });
  el.querySelector('[data-close]')?.addEventListener('click', () => deps.onClose());
  el.style.display = 'block';
  el.scrollTop = scrollTop;
}
