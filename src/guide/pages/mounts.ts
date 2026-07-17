// Mounts: the stable roster. The roster (names, the level gate, riding vs swift tier,
// the $GROW-exclusive flag) is generated from the sim MOUNT_DEFS so it never drifts;
// the explainer copy is curated guide prose. Spoiler-safe: no speed bonuses and no
// copper/$GROW prices, only which mounts are the exclusives. Mount names stay English
// on purpose (proper nouns from the sim). Modeled on delves.ts.

import { esc } from '../../ui/esc';
import { formatNumber, t } from '../../ui/i18n';
import { GUIDE_MOUNTS, type GuideMount } from '../content.generated';
import { hrefFor } from '../routes';
import type { GuidePage } from './types';
import { callout, p, pageHeader, related, section } from './ui';

function mountCard(m: GuideMount): string {
  const badges: string[] = [
    `<span class="guide-badge">${esc(m.swift ? t('guide.mountsPage.swiftTier') : t('guide.mountsPage.ridingTier'))}</span>`,
    `<span class="guide-badge guide-badge-level">${esc(t('guide.mountsPage.fromLevel', { n: formatNumber(m.requiredLevel) }))}</span>`,
  ];
  if (m.exclusive) {
    badges.push(`<span class="guide-badge">${esc(t('guide.mountsPage.exclusiveTag'))}</span>`);
  }
  return `
    <section class="guide-dungeon-card">
      <div class="guide-dungeon-head">
        <h2 class="guide-dungeon-name">${esc(m.name)}</h2>
      </div>
      <div class="guide-tags">${badges.join(' ')}</div>
    </section>`;
}

export const mounts: GuidePage = {
  titleKey: 'guide.nav.mounts',
  render() {
    // Riding tier first, then swift, preserving the registry's declaration order
    // within each tier (the same order the stable sells them in).
    const ordered = [
      ...GUIDE_MOUNTS.filter((m) => !m.swift),
      ...GUIDE_MOUNTS.filter((m) => m.swift),
    ];
    const cards = ordered.map(mountCard).join('');
    const minLevel = Math.min(...GUIDE_MOUNTS.map((m) => m.requiredLevel));
    const whereBody = `<p>${esc(t('guide.mountsPage.whereBody', { level: formatNumber(minLevel) }))}</p>`;
    return `
      <article class="guide-article guide-mounts">
        ${pageHeader('guide.mountsPage.heading', 'guide.mountsPage.intro')}
        ${section('guide.mountsPage.whatHeading', p('guide.mountsPage.whatBody'))}
        ${section('guide.mountsPage.tiersHeading', p('guide.mountsPage.tiersBody'))}
        <div class="guide-dungeon-grid">${cards}</div>
        ${section('guide.mountsPage.exclusiveHeading', p('guide.mountsPage.exclusiveBody'))}
        ${section('guide.mountsPage.whereHeading', callout(whereBody, { variant: 'note' }))}
        ${related([
          { href: hrefFor('world'), key: 'guide.nav.world' },
          { href: hrefFor('economy'), key: 'guide.nav.economy' },
          { href: hrefFor('quests'), key: 'guide.nav.quests' },
          { href: hrefFor('how-to-play'), key: 'guide.nav.howToPlay' },
        ])}
      </article>`;
  },
};
