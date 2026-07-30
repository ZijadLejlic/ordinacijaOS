"use client";

import { useEffect } from "react";

/** Registers the installability-only service worker (no offline cache). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Avoid noisy re-registration failures during local HMR / unsupported contexts.
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore — install prompt simply unavailable */
    });
  }, []);

  return null;
}
