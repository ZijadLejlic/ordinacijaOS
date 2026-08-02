"use client";

import dynamic from "next/dynamic";

/** Defer service-worker registration off the marketing critical path. */
export const RegisterServiceWorkerLazy = dynamic(
  () =>
    import("@/components/pwa/register-sw").then((m) => ({
      default: m.RegisterServiceWorker,
    })),
  { ssr: false },
);
