// Thin DOM consumer for the account bank (stash) window.
//
// The consumer half of the pure-core + thin-consumer split (reference
// vendor_window.ts): it paints #stash-window from the structured StashView
// (stash_view.ts) and wires the deposit / withdraw / close actions. It owns no
// state. The cross-window orchestration (which windows to close, the mobile
// teardown) stays in Hud because it needs Hud's private state; this module only
// renders one panel and reports clicks back through the injected callbacks.

import { itemDisplayName } from './entity_i18n';
import { esc } from './esc';
import { formatNumber, t } from './i18n';
import type { PainterHostPresentation } from './painter_host';
import type { StashView } from './stash_view';
import { svgIcon } from './ui_icons';

/**
 * Hud-supplied glue. The icon/tooltip painters are the shared
 * PainterHostPresentation bag (Hud builds it once and hands it to every window
 * that renders item rows); this composes that base and adds the bank-specific
 * tooltip teardown and the deposit/withdraw/close dispatch. The module never
 * reaches into Hud directly.
 */
export interface StashWindowDeps extends PainterHostPresentation {
  hideTooltip(): void;
  onDeposit(itemId: string): void;
  onWithdraw(itemId: string): void;
  onClose(): void;
}

function stackSuffix(count: number): string {
  return count > 1
    ? ` ${t('itemUi.bags.stackCount', { count: formatNumber(count, { maximumFractionDigits: 0 }) })}`
    : '';
}

/** Paint the bank panel from a prepared view. */
export function renderStashWindow(
  el: HTMLElement,
  bankerName: string,
  view: StashView,
  deps: StashWindowDeps,
): void {
  // The rebuild replaces the hovered row (its mouseleave never fires) and
  // collapses the scrolled list, drop the tooltip and restore the scroll.
  deps.hideTooltip();
  const scrollTop = el.scrollTop;
  el.innerHTML = `<div class="panel-title"><span>${esc(t('hudChrome.bank.title', { name: bankerName }))}</span><button type="button" class="x-btn" data-close aria-label="${esc(t('hudChrome.bank.close'))}">${svgIcon('close')}</button></div>`;

  const bankedTitle = document.createElement('div');
  bankedTitle.className = 'vendor-section-title';
  bankedTitle.textContent = t('hudChrome.bank.bankedTitle');
  el.appendChild(bankedTitle);

  if (view.banked.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'vendor-empty';
    empty.textContent = t('hudChrome.bank.bankedEmpty');
    el.appendChild(empty);
  }
  for (const { itemId, item, count } of view.banked) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'vendor-item';
    const itemName = itemDisplayName(item);
    const stack = stackSuffix(count);
    row.setAttribute(
      'aria-label',
      t('hudChrome.bank.withdrawAria', { item: `${itemName}${stack}` }),
    );
    row.innerHTML = `${deps.itemIcon(item)}<span class="vi-name">${esc(itemName)}${esc(stack)}</span>`;
    row.addEventListener('click', () => deps.onWithdraw(itemId));
    deps.attachTooltip(
      row,
      () =>
        `${deps.itemTooltip(item)}<div class="tt-sub">${esc(t('hudChrome.bank.clickWithdraw'))}</div>`,
    );
    el.appendChild(row);
  }

  const bagsTitle = document.createElement('div');
  bagsTitle.className = 'vendor-section-title';
  bagsTitle.textContent = t('hudChrome.bank.bagsTitle');
  el.appendChild(bagsTitle);

  if (view.depositable.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'vendor-empty';
    empty.textContent = t('hudChrome.bank.bagsEmpty');
    el.appendChild(empty);
  }
  for (const { itemId, item, count } of view.depositable) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'vendor-item';
    const itemName = itemDisplayName(item);
    const stack = stackSuffix(count);
    row.setAttribute(
      'aria-label',
      t('hudChrome.bank.depositAria', { item: `${itemName}${stack}` }),
    );
    row.innerHTML = `${deps.itemIcon(item)}<span class="vi-name">${esc(itemName)}${esc(stack)}</span>`;
    row.addEventListener('click', () => deps.onDeposit(itemId));
    deps.attachTooltip(
      row,
      () =>
        `${deps.itemTooltip(item)}<div class="tt-sub">${esc(t('hudChrome.bank.clickDeposit'))}</div>`,
    );
    el.appendChild(row);
  }

  const hint = document.createElement('div');
  hint.className = 'vendor-hint';
  hint.textContent = view.full ? t('hudChrome.bank.fullHint') : t('hudChrome.bank.hint');
  el.appendChild(hint);

  el.querySelector('[data-close]')?.addEventListener('click', () => deps.onClose());
  el.style.display = 'block';
  el.scrollTop = scrollTop;
}
