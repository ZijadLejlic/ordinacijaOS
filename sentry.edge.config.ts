import * as Sentry from "@sentry/nextjs";
import { getSharedSentryOptions } from "@/lib/observability/sentry-options";

Sentry.init({
  ...getSharedSentryOptions(),
});
