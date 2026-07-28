"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import {
  captureUnexpectedError,
  setSentryAuthContext,
} from "@/lib/observability/sentry";

/**
 * TEMPORARY client verification UI — REMOVE with docs/Sentry.md checklist.
 */
export function SentryClientTestPanel() {
  const [lastId, setLastId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSentryAuthContext({
      userId: "sentry-test-user",
      clinicId: "00000000-0000-4000-8000-000000000001",
      role: "owner",
    });
    Sentry.addBreadcrumb({
      category: "sentry-test",
      message: "client panel mounted",
      level: "info",
    });
    setReady(true);
  }, []);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-12">
      <p className="text-xs font-medium tracking-wide text-amber-800 uppercase">
        Temporary — remove after Sentry verification
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">Sentry client test</h1>
      <p className="text-muted-foreground text-sm">
        Triggers a browser error with breadcrumbs, user id, clinic_id tag, and
        Session Replay (on error). Check Sentry Issues + Replays.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!ready}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => {
            Sentry.addBreadcrumb({
              category: "sentry-test",
              message: "before client capture",
              level: "info",
            });
            const id = captureUnexpectedError(
              new Error("DentOrd Sentry client test capture (REMOVE page)"),
              { feature: "sentry-test", operation: "client.capture" },
            );
            setLastId(id ?? null);
          }}
        >
          Capture client error
        </button>
        <button
          type="button"
          disabled={!ready}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm disabled:opacity-50"
          onClick={() => {
            Sentry.addBreadcrumb({
              category: "sentry-test",
              message: "before client throw",
              level: "info",
            });
            throw new Error("DentOrd Sentry client test throw (REMOVE page)");
          }}
        >
          Throw (render path)
        </button>
      </div>
      {lastId ? (
        <p className="font-mono text-xs text-neutral-600">eventId: {lastId}</p>
      ) : null}
    </div>
  );
}
