// Guard for the offline-only landing shell: after hideOnlineShell() hides the
// Online realm option, keyboard navigation in the dropdown must never land on
// it (main.ts re-filters the wire-time option array through
// visibleServerOptions at interaction time).
import { describe, expect, it } from 'vitest';
import { visibleServerOptions } from '../src/ui/offline_only';

type StubOption = { id: string; hasAttribute(name: string): boolean };
const opt = (id: string, hidden: boolean): StubOption => ({
  id,
  hasAttribute: (name) => name === 'hidden' && hidden,
});

describe('visibleServerOptions', () => {
  it('returns every option while nothing is hidden', () => {
    const options = [opt('server-opt-online', false), opt('server-opt-offline', false)];
    expect(visibleServerOptions(options)).toEqual(options);
  });

  it('drops the hidden Online option so Home/End/arrow keys cannot reach it', () => {
    const online = opt('server-opt-online', true);
    const offline = opt('server-opt-offline', false);
    const visible = visibleServerOptions([online, offline]);
    expect(visible).toEqual([offline]);
    // First and last (Home/End targets) are both the offline option.
    expect(visible[0]).toBe(offline);
    expect(visible[visible.length - 1]).toBe(offline);
  });

  it('returns an empty list when every option is hidden', () => {
    expect(visibleServerOptions([opt('a', true), opt('b', true)])).toEqual([]);
  });
});
