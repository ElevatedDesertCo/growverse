// Landing-shell fallback for deploys that ship no game server (static hosting).
// When the realm status probe fails, main.ts switches the landing page to
// offline-only: this hides every control that points at the missing backend
// (Login/Register in the nav, the Online realm option) so the only visible
// path is instant offline play. Everything stays in the DOM (hidden, not
// removed), so a reachable server on the next load restores the full shell.
// Keyboard navigation over the realm dropdown must skip options hidden by
// hideOnlineShell(): the wire-time option array is captured before the probe
// resolves, so callers re-filter through this at interaction time. Structural
// element type so a Node test can exercise it without a DOM.
export function visibleServerOptions<T extends { hasAttribute(name: string): boolean }>(
  options: readonly T[],
): T[] {
  return options.filter((o) => !o.hasAttribute('hidden'));
}

export function hideOnlineShell(): void {
  const loginBtn = document.getElementById('nav-btn-login');
  const loginItem = loginBtn?.closest('.nav-item') as HTMLElement | null;
  loginItem?.setAttribute('hidden', '');
  document.getElementById('server-opt-online')?.setAttribute('hidden', '');
}
