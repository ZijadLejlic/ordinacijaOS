import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** Embed deploy target for the browser SDK (Vercel sets VERCEL_ENV at build). */
const sentryEnvironment =
  process.env.VERCEL_ENV ??
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
  (process.env.NODE_ENV === "development" ? "development" : "production");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: sentryEnvironment,
  },
  turbopack: {
    root: process.cwd(),
  },
  // Bundle Roboto for invoice/consent PDF generation (Latin Extended diacritics).
  outputFileTracingIncludes: {
    "/api/**/*": ["./assets/fonts/**/*"],
    "/*": ["./assets/fonts/**/*"],
  },
  // Patient PDFs allow 20 MB; Server Actions default to 1 MB and reject larger
  // image/document uploads with 413 before the action runs (prod smoke finding).
  experimental: {
    serverActions: {
      bodySizeLimit: "21mb",
    },
  },
};

const withIntl = withNextIntl(nextConfig);

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default withSentryConfig(withIntl, {
  org: process.env.SENTRY_ORG ?? "ordinacijaos-47",
  project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",
  // Build-time only — never NEXT_PUBLIC_*
  authToken: sentryAuthToken,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Bypass ad-blockers; excluded from i18n middleware (see middleware.ts matcher)
  tunnelRoute: "/monitoring",
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
  sourcemaps: {
    // Upload only when auth token is present (CI / Vercel build).
    disable: !sentryAuthToken,
    // Delete client maps after upload (server maps kept for runtime — SDK default).
    deleteSourcemapsAfterUpload: true,
  },
  release: {
    // Prefer explicit SENTRY_RELEASE; else Vercel git SHA (auto-detected by plugin too).
    name:
      process.env.SENTRY_RELEASE ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      undefined,
    create: Boolean(sentryAuthToken),
    finalize: Boolean(sentryAuthToken),
    setCommits: sentryAuthToken
      ? {
          auto: true,
          ignoreMissing: true,
          ignoreEmpty: true,
        }
      : undefined,
  },
});
