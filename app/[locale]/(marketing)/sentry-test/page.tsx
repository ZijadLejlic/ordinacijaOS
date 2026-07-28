import { notFound } from "next/navigation";
import { SentryClientTestPanel } from "@/components/observability/sentry-client-test-panel";
import { areSentryTestEndpointsEnabled } from "@/lib/observability/sentry-env";

/**
 * TEMPORARY — REMOVE after Sentry verification (docs/Sentry.md).
 * Path: /{locale}/sentry-test
 */
export default function SentryTestPage() {
  if (!areSentryTestEndpointsEnabled()) {
    notFound();
  }

  return <SentryClientTestPanel />;
}
