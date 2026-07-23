import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      // Coverage tracks `lib/**` only (business logic covered by Vitest).
      // `app/`, `components/`, `e2e/` are exercised by Playwright instead.
      include: ["lib/**/*.ts"],
      exclude: [
        "lib/**/*.test.ts",
        "lib/security/test-env.ts",
        "lib/**/*.d.ts",
      ],
      // P0.5 baseline (Implementation-Plan.md): start low, raise in P5.2.
      // Measured against `npm run test:unit` (no live Supabase required):
      // actual statements were 10.34% on 2026-07-23 (`lib/**`, excl. tests) —
      // far below the plan's assumed "≥40%" starting point, because most
      // `actions.ts` / RBAC-gate files are only exercisable via INT tests
      // that don't exist yet (P1-P4). Threshold below is set just under the
      // measured baseline so CI fails on *regressions*, not on this gap.
      // See docs/QA/Discrepancies.md D-19.
      thresholds: {
        statements: 10,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
