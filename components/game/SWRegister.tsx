"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js after mount. No-ops in dev (Next.js dev server reloads
 * service workers in confusing ways; we only want it in production builds
 * so the home-screen install opens instantly offline-cached).
 */
export function SWRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[SWRegister] failed to register service worker:", err);
    });
  }, []);
  return null;
}
