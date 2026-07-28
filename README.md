# DentOrd

Multi-tenant dental clinic SaaS ([dentord.com](https://dentord.com)). Product source of truth: [`docs/PRD-OrdinacijaOS.md`](docs/PRD-OrdinacijaOS.md).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `.env.example` → `.env.local` and fill Supabase keys.

## Tests

```bash
npm run test:unit          # pure units (no DB)
npm run test:security      # RLS / INT (needs Supabase env)
npm run test:e2e           # Playwright (build + Chromium)
npm run lint && npm run typecheck
```

QA catalog and roadmap: [`docs/QA/`](docs/QA/).

**CI:** [`.github/workflows/release-gate.yml`](.github/workflows/release-gate.yml) is the single PR/`main` gate (lint + unit/coverage + local-Supabase security + Playwright E2E).

### Flaky quarantine (P5.6)

Playwright already retries **once** in CI (`retries: 1` in `playwright.config.ts`). Do **not** raise retries to hide flakes.

When a test fails intermittently:

1. **Open a GitHub issue** with the failure signature, last green SHA, and flake rate if known.
2. **Quarantine** — do not delete the test:
   - Prefer `test.fix('…', { annotation: { type: 'issue', description: '#NNN' } }, …)` (Playwright) or `it.fix('… #NNN', …)` (Vitest), **or**
   - Tag `@flaky` and exclude that tag from the required CI job until fixed.
3. Quarantined tests **must not** be release blockers. `@blocker` E2E stay required; move a blocker off `@blocker` only while quarantined, and restore the tag when un-quarantined.
4. **Un-quarantine** in the same PR that fixes the root cause. Silent removal of coverage is not allowed.
5. Track open quarantines in the issue milestone / project board; max open quarantine window should be one sprint unless explicitly extended.

Vitest RLS/INT suites are the source of truth for policy behaviour. Optional pgTAP (`supabase test db`) is **deferred** until those suites become slow or flaky (P5.5).
