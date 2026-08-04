import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOCUSABLE_SELECTOR, FocusManager } from '../src/ui/focus_manager';
import { makeWindowFocus } from '../src/ui/window_focus';

// The window-focus BRIDGE (src/ui/window_focus.ts): the {captureFocus, restoreFocus} pair
// every HUD window is wired through. focus_manager.test.ts covers the trap itself; this
// file covers the glue's three distinct close paths, which the manager alone cannot decide:
//
//   1. close WITH an opener        -> release the trap, return focus to the opener
//   2. close with NO opener        -> release the trap AND blur, so focus is never left on
//                                     a control inside the window that was just hidden
//   3. an in-window refocus        -> re-focus WITHOUT tearing the trap down
//
// Case 2 is a real defect this file was written for. A window opened while focus sat on
// <body> (any keybind-opened window) captures a null opener, so restore() has nowhere to
// send focus and the browser leaves activeElement on a control inside the now display:none
// window. The next Tab then resumes from a detached point and a screen reader reads an
// invisible button. Verified in a real browser via scripts/mobile_touch_target_check.mjs.
//
// Same hand-rolled fake-DOM approach as focus_manager.test.ts (the repo runs the default
// node env, no jsdom); the fake models only what the bridge and manager actually touch.

class FakeHTMLElement {
  children: FakeHTMLElement[] = [];
  parent: FakeHTMLElement | null = null;
  isConnected = true;
  visible = true;
  focusable: boolean;
  id: string;
  blurred = false;

  constructor(opts: { focusable?: boolean; id?: string } = {}) {
    this.focusable = opts.focusable ?? false;
    this.id = opts.id ?? '';
  }

  append(...kids: FakeHTMLElement[]): this {
    for (const k of kids) {
      k.parent = this;
      this.children.push(k);
    }
    return this;
  }

  getClientRects(): { length: number }[] {
    return this.visible ? [{ length: 1 }] : [];
  }

  contains(el: FakeHTMLElement | null): boolean {
    for (let n: FakeHTMLElement | null = el; n; n = n.parent) if (n === this) return true;
    return false;
  }

  private descendants(): FakeHTMLElement[] {
    const out: FakeHTMLElement[] = [];
    const walk = (n: FakeHTMLElement): void => {
      for (const c of n.children) {
        out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }

  querySelectorAll(sel: string): FakeHTMLElement[] {
    return sel === FOCUSABLE_SELECTOR ? this.descendants().filter((d) => d.focusable) : [];
  }

  matches(): boolean {
    return false;
  }

  focus(): void {
    fakeDoc.activeElement = this;
  }

  // The bridge blurs a stranded control on the no-opener close path. Model the browser
  // contract: blurring the active element hands focus back to the document body.
  blur(): void {
    this.blurred = true;
    if (fakeDoc.activeElement === this) fakeDoc.activeElement = null;
  }
}

const fakeDoc = {
  activeElement: null as FakeHTMLElement | null,
  body: new FakeHTMLElement(),
  addEventListener(): void {},
  removeEventListener(): void {},
};

// setTimeout runs synchronously so the manager's deferred focus() resolves inline.
const fakeWin = {
  setTimeout: (fn: () => void): number => {
    fn();
    return 0;
  },
};

const el = (x: FakeHTMLElement): HTMLElement => x as unknown as HTMLElement;

beforeEach(() => {
  fakeDoc.activeElement = null;
  fakeDoc.body = new FakeHTMLElement();
  vi.stubGlobal('document', fakeDoc);
  vi.stubGlobal('window', fakeWin);
  vi.stubGlobal('HTMLElement', FakeHTMLElement);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A window root holding one focusable control, plus the bridge wired to it. */
function makeWindow() {
  const root = new FakeHTMLElement();
  const control = new FakeHTMLElement({ focusable: true });
  root.append(control);
  const fm = new FocusManager();
  const bridge = makeWindowFocus(fm, () => el(root));
  return { root, control, fm, bridge };
}

describe('makeWindowFocus close paths', () => {
  it('returns focus to the opener when one was recorded', () => {
    const { control, bridge } = makeWindow();
    const opener = new FakeHTMLElement({ focusable: true });
    opener.focus();

    const captured = bridge.captureFocus();
    expect(captured).toBe(el(opener));

    control.focus();
    expect(fakeDoc.activeElement).toBe(control);

    bridge.restoreFocus(captured);
    expect(fakeDoc.activeElement).toBe(opener);
    expect(control.blurred).toBe(false);
  });

  it('does not strand focus inside the window when there was no opener', () => {
    // Opened from <body>: nothing focusable was active, so captureFocus records null.
    const { root, control, bridge } = makeWindow();
    const opener = bridge.captureFocus();
    expect(opener).toBeNull();

    control.focus();
    expect(root.contains(fakeDoc.activeElement)).toBe(true);

    // The window is hidden, then closed. Focus must NOT remain on a control inside it.
    root.visible = false;
    bridge.restoreFocus(opener);

    expect(control.blurred).toBe(true);
    expect(root.contains(fakeDoc.activeElement)).toBe(false);
  });

  it('leaves focus alone when it is already outside the window', () => {
    const { bridge } = makeWindow();
    const elsewhere = new FakeHTMLElement({ focusable: true });
    bridge.captureFocus();
    elsewhere.focus();

    bridge.restoreFocus(null);

    expect(elsewhere.blurred).toBe(false);
    expect(fakeDoc.activeElement).toBe(elsewhere);
  });

  it('keeps the trap installed for an in-window refocus', () => {
    // char_window hands focus to a rebuilt row after a keyboard unequip: the window is
    // still open, so this must re-focus WITHOUT releasing the trap or blurring.
    const { root, control, bridge } = makeWindow();
    const rebuilt = new FakeHTMLElement({ focusable: true });
    root.append(rebuilt);
    bridge.captureFocus();
    control.focus();

    bridge.restoreFocus(el(rebuilt));

    expect(fakeDoc.activeElement).toBe(rebuilt);
    expect(control.blurred).toBe(false);
    expect(rebuilt.blurred).toBe(false);
  });
});
