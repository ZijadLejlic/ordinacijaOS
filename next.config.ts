import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
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

export default withSentryConfig(withIntl, {
  org: process.env.SENTRY_ORG ?? "ordinacijaos-47",
  project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
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
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
