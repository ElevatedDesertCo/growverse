import { describe, expect, it } from 'vitest';
import { assetsReady, registerPreload } from '../src/render/assets/preload';

// registerPreload() stores a boot-time asset fetch so startGame can await assetsReady()
// before building the scene. The failure mode this guards: a registered fetch that
// rejects BEFORE (or without) assetsReady() being awaited must not surface as an
// UNHANDLED promise rejection. That window is real whenever a unit test imports a render
// module purely for its preload-set side effects and never boots the game (the sibling
// render_asset_preload.test.ts is exactly that case: its deferred GLB loads reject in
// Node, and an unhandled rejection there fails the whole vitest run). registerPreload
// attaches a no-op rejection reaction at registration to hold that line, while still
// letting assetsReady() report the failure.

describe('registerPreload rejection safety', () => {
  it('does not leak an unhandled rejection when a preload rejects before assetsReady', async () => {
    const leaked: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      leaked.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      registerPreload(Promise.reject(new Error('bad glb (registration-time reject)')));
      // Let the rejection settle and a macrotask pass; without the registration-time
      // catch, Node would fire unhandledRejection within this window.
      await new Promise((r) => setTimeout(r, 20));
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
    expect(leaked).toEqual([]);
  });

  it('still surfaces a failed preload through assetsReady()', async () => {
    registerPreload(Promise.reject(new Error('bad glb (assetsReady reporting)')));
    await expect(assetsReady()).rejects.toThrow(/asset preload failed/);
  });
});
