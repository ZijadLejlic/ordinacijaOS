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
        // INT/SA-only surfaces (P1–P4 security suite). Counting them in the
        // unit-coverage denominator made a 60% gate permanently red (D-19).
        // P5.2 scopes the gate to pure/unit-reachable lib instead.
        "lib/**/actions.ts",
        "lib/supabase/**",
        "lib/security/factories.ts",
        "lib/legal/**",
        "lib/seo/**",
        "lib/observability/**",
      ],
      // P5.2: raise gate on the unit-reachable surface (measured ~30.7%
      // statements after excluding SA/actions). Global 60% on all of lib/
      // remains deferred until coverage job includes security INT or more
      // pure units land — see Implementation-Plan P5.2 + D-19.
      thresholds: {
        statements: 30,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
