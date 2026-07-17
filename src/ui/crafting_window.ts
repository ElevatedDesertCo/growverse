// Thin DOM consumer for the crafting window (Grow Station / Upgrade Bench).
//
// The consumer half of the pure-core + thin-consumer split: it paints
// #craft-window from the structured CraftingView (crafting_view.ts) and wires the
// craft / close actions. It owns no state. The cross-window orchestration (which
// windows to close, bag re-centring) stays in Hud because it needs Hud's private
// state; this module renders one panel and reports clicks through injected
// callbacks. Interpolated names pass through esc(); the recipe/item names come
// from the item table via itemDisplayName, not raw t().

import type { CraftStation, ProfessionId } from '../sim/types';
import type { CraftingView } from './crafting_view';
import { itemDisplayName } from './entity_i18n';
import { esc } from './esc';
import { formatNumber, type TranslationKey, t } from './i18n';
import type { PainterHostPresentation } from './painter_host';
import { svgIcon } from './ui_icons';

// The gathering-profession skill names, keyed by ProfessionId (shared with the char
// sheet's professions panel); resolved through t() when a recipe names a skill gate.
const PROFESSION_LABEL_KEY: Record<ProfessionId, TranslationKey> = {
  mining: 'hudChrome.professions.mining',
  herbalism: 'hudChrome.professions.herbalism',
  logging: 'hudChrome.professions.logging',
};

/**
 * Hud-supplied glue. Composes the shared PainterHostPresentation bag (icon / money
 * / tooltip painters) and adds the crafting-specific tooltip teardown, the craft
 * dispatch, and the close action. The module never reaches into Hud directly.
 */
export interface CraftingWindowDeps extends PainterHostPresentation {
  hideTooltip(): void;
  onCraft(recipeId: string): void;
  onClose(): void;
}

function count(n: number): string {
  return formatNumber(n, { maximumFractionDigits: 0 });
}

/** Paint the crafting panel from a prepared view. */
export function renderCraftingWindow(
  el: HTMLElement,
  view: CraftingView,
  deps: CraftingWindowDeps,
): void {
  // The rebuild replaces the hovered row (its mouseleave never fires) and can
  // collapse the scrolled list; drop the tooltip and restore the scroll.
  deps.hideTooltip();
  const scrollTop = el.scrollTop;

  const station: CraftStation = view.station;
  const title = t(`hudChrome.crafting.${station}Title` as Parameters<typeof t>[0]);
  const hint = t(`hudChrome.crafting.${station}Hint` as Parameters<typeof t>[0]);

  el.innerHTML = `<div class="panel-title"><span>${esc(title)}</span><button type="button" class="x-btn" data-close aria-label="${esc(t('hudChrome.crafting.close'))}">${svgIcon('close')}</button></div><div class="craft-hint">${esc(hint)}</div>`;

  const totalRows = view.categories.reduce((sum, c) => sum + c.rows.length, 0);
  if (totalRows === 0) {
    const empty = document.createElement('div');
    empty.className = 'craft-empty';
    empty.textContent = t('hudChrome.crafting.empty');
    el.appendChild(empty);
  }

  for (const category of view.categories) {
    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'craft-section-title';
    sectionTitle.textContent = t(
      `hudChrome.crafting.categories.${category.category}` as Parameters<typeof t>[0],
    );
    el.appendChild(sectionTitle);

    for (const row of category.rows) {
      const outputName = itemDisplayName(row.output);
      const wrap = document.createElement('div');
      wrap.className = 'craft-recipe';

      // Reagent list: each input shows have/need, dimmed when short.
      const reagents = row.inputs
        .map((inp) => {
          const name = itemDisplayName(inp.item);
          const cls = inp.enough ? 'craft-reagent' : 'craft-reagent craft-reagent-short';
          return `<span class="${cls}">${deps.itemIcon(inp.item)}<span class="craft-reagent-name">${esc(name)}</span> <span class="craft-reagent-count">${esc(count(inp.have))}/${esc(count(inp.need))}</span></span>`;
        })
        .join('');

      const levelReq =
        row.requiredLevel !== undefined
          ? `<div class="craft-req${row.meetsLevel ? '' : ' craft-req-short'}">${esc(t('hudChrome.crafting.levelReq', { level: count(row.requiredLevel) }))}</div>`
          : '';
      const professionReq = row.requiredProfession
        ? `<div class="craft-req${row.meetsProfession ? '' : ' craft-req-short'}">${esc(
            t('hudChrome.crafting.professionReq', {
              profession: t(PROFESSION_LABEL_KEY[row.requiredProfession.id]),
              skill: count(row.requiredProfession.skill),
            }),
          )}</div>`
        : '';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'craft-btn';
      btn.disabled = !row.craftable;
      btn.textContent = t('hudChrome.crafting.craftButton');
      btn.setAttribute(
        'aria-label',
        t('hudChrome.crafting.produces', {
          count: count(row.outputCount),
          name: outputName,
        }),
      );
      btn.addEventListener('click', () => deps.onCraft(row.recipeId));

      wrap.innerHTML =
        `<div class="craft-output">${deps.itemIcon(row.output)}<span class="craft-output-name">${esc(outputName)}${row.outputCount > 1 ? ` <span class="craft-output-count">x${esc(count(row.outputCount))}</span>` : ''}</span></div>` +
        `<div class="craft-detail"><div class="craft-reagents">${reagents}</div>${levelReq}${professionReq}<div class="craft-cost"><span class="craft-cost-label">${esc(t('hudChrome.crafting.costLabel'))}</span> ${deps.moneyHtml(row.copperCost)}</div></div>`;

      deps.attachTooltip(wrap.querySelector('.craft-output') as HTMLElement, () =>
        deps.itemTooltip(row.output),
      );
      wrap.appendChild(btn);
      el.appendChild(wrap);
    }
  }

  el.querySelector('[data-close]')?.addEventListener('click', () => deps.onClose());
  el.style.display = 'block';
  el.scrollTop = scrollTop;
}
