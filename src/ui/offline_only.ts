// Landing-shell fallback for deploys that ship no game server (static hosting).
// When the realm status probe fails, main.ts switches the landing page to
// offline-only: this hides every control that points at the missing backend
// (Login/Register in the nav, the Online realm option) so the only visible
// path is instant offline play. Everything stays in the DOM (hidden, not
// removed), so a reachable server on the next load restores the full shell.
export function hideOnlineShell(): void {
  const loginBtn = document.getElementById('nav-btn-login');
  const loginItem = loginBtn?.closest('.nav-item') as HTMLElement | null;
  loginItem?.setAttribute('hidden', '');
  document.getElementById('server-opt-online')?.setAttribute('hidden', '');
}
