// Boot-time asset preload registry. Render modules kick off their fetches at
// import time and register the promises here; startGame awaits assetsReady()
// before constructing the Renderer so scene build can stay synchronous.
import { assetLoadStarted, recordPreloadWait } from './stats';

const tasks: Promise<unknown>[] = [];

export function registerPreload(task: Promise<unknown>): void {
  // Attach a no-op rejection reaction at registration so a boot-time asset failure is
  // never surfaced as an UNHANDLED promise rejection during the window before (or
  // without) assetsReady() being awaited. That window is real in unit tests that
  // import a render module purely for its preload-set side effects and never boot the
  // game (e.g. tests/render_asset_preload.test.ts, where the deferred GLB loads reject
  // in Node). The original promise is still pushed, so assetsReady()'s allSettled below
  // reports every failure exactly as before; this only marks `task` itself as handled.
  void task.catch(() => undefined);
  tasks.push(task);
}

export async function assetsReady(
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const startedAt = assetLoadStarted();
  // Settled sequentially is fine: fetches already run concurrently. Collect
  // every failure so one bad file reports clearly instead of dying first.
  if (onProgress) {
    const total = tasks.length;
    let done = 0;
    for (const t of tasks) void t.finally(() => onProgress(++done, total)).catch(() => undefined);
  }
  const results = await Promise.allSettled(tasks);
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  recordPreloadWait(tasks.length, startedAt, failed.length === 0);
  if (failed.length) {
    throw new Error(
      `asset preload failed (${failed.length}): ${failed.map((f) => String(f.reason)).join('; ')}`,
    );
  }
}
