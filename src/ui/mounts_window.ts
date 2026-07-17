// Thin DOM consumer for the Mounts window.
//
// The consumer half of the pure-core + thin-consumer split (reference
// vendor_window.ts): it paints #mounts-window from the structured MountsView
// (mounts_view.ts) and wires the summon / dismiss / close actions. It owns no
// state. The cross-window orchestration (open/close pairing, focus capture and
// return, the open-state refresh) stays in Hud because it needs Hud's private
// state; this module only renders one panel and reports clicks back through
// the injected callbacks. Mount names are player-visible content data
// (MountDef.name) localized through mountDisplayName (entity_i18n's
// entities.mounts.<id>.name keys) and rendered via textContent / esc().

import { mountDisplayName } from './entity_i18n';
import { esc } from './esc';
import { t } from './i18n';
import type { MountsView } from './mounts_view';
import { svgIcon } from './ui_icons';

/**
 * Hud-supplied glue. The window renders no item rows, so it composes no
 * PainterHostPresentation bag; it only dispatches the summon/dismiss/close
 * actions back to Hud. The module never reaches into Hud directly.
 */
export interface MountsWindowDeps {
  onSummon(mountId: string): void;
  onDismiss(): void;
  onClose(): void;
}

/** Paint the mounts panel from a prepared view. */
export function renderMountsWindow(
  el: HTMLElement,
  view: MountsView,
  deps: MountsWindowDeps,
): void {
  // The rebuild collapses the scrolled list; restore the scroll afterwards.
  const scrollTop = el.scrollTop;
  el.innerHTML = `<div class="panel-title"><span>${esc(t('hudChrome.mounts.windowTitle'))}</span><button type="button" class="x-btn" data-close aria-label="${esc(t('hudChrome.mounts.close'))}">${svgIcon('close')}</button></div>`;

  if (view.empty) {
    const empty = document.createElement('div');
    empty.className = 'vendor-empty';
    empty.textContent = t('hudChrome.mounts.none');
    el.appendChild(empty);
  }

  for (const row of view.rows) {
    const line = document.createElement('div');
    line.className = `mount-row${row.exclusive ? ' mount-row-exclusive' : ''}${row.active ? ' mount-row-active' : ''}`;

    const localizedName = mountDisplayName(row.mountId);
    const name = document.createElement('span');
    name.className = 'mount-name';
    name.textContent = localizedName;
    line.appendChild(name);

    if (row.active) {
      const marker = document.createElement('span');
      marker.className = 'mount-active-marker';
      marker.textContent = t('hudChrome.mounts.active');
      line.appendChild(marker);
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mount-act';
    btn.disabled = !row.active && !row.canSummon;
    btn.textContent = row.active ? t('hudChrome.mounts.dismiss') : t('hudChrome.mounts.summon');
    btn.setAttribute(
      'aria-label',
      row.active
        ? t('hudChrome.mounts.dismissAria', { name: localizedName })
        : t('hudChrome.mounts.summonAria', { name: localizedName }),
    );
    btn.addEventListener('click', () =>
      row.active ? deps.onDismiss() : deps.onSummon(row.mountId),
    );
    line.appendChild(btn);

    el.appendChild(line);
  }

  el.querySelector('[data-close]')?.addEventListener('click', () => deps.onClose());
  el.style.display = 'block';
  el.scrollTop = scrollTop;
}
