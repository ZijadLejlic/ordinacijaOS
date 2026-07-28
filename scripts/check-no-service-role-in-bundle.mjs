#!/usr/bin/env node
/**
 * PLAT-SEC-003 (docs/QA/Test-Strategy.md §4.1, D41): real "build/bundle grep"
 * check — must run **after** `npm run build` (needs `.next/` to exist).
 * Complements the static import-graph test at
 * lib/security/no-service-role-in-client.test.ts, which is fast/DB-free/
 * build-free and runs on every PR via `test:unit`; this script proves the
 * *actual compiled output* never contains the service-role secret, at the
 * cost of needing a real Next.js build first.
 *
 * Wired into `.github/workflows/e2e.yml` right after its existing "Build
 * Next.js" step, so it reuses that build instead of paying for a second one.
 *
 * Usage: npm run build && npm run check:no-service-role-in-bundle
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const NEXT_DIR = path.resolve(process.cwd(), ".next");
const CLIENT_STATIC_DIR = path.join(NEXT_DIR, "static");
const ENV_VAR_NAME = "SUPABASE_SERVICE_ROLE_KEY";

if (!existsSync(NEXT_DIR)) {
  console.error(
    `FAIL check:no-service-role-in-bundle — ${NEXT_DIR} does not exist. Run "npm run build" first.`,
  );
  process.exit(1);
}
if (!existsSync(CLIENT_STATIC_DIR)) {
  console.error(
    `FAIL check:no-service-role-in-bundle — ${CLIENT_STATIC_DIR} does not exist (unexpected Next.js output layout).`,
  );
  process.exit(1);
}

function collectFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...collectFiles(full));
    else out.push(full);
  }
  return out;
}

function grepNeedle(files, needle) {
  const hits = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue; // binary/unreadable (e.g. media) — never contains our text needle
    }
    if (text.includes(needle)) hits.push(file);
  }
  return hits;
}

// 1. Client-side JS/CSS/etc. chunks — the actual browser-shipped bundle.
const clientFiles = collectFiles(CLIENT_STATIC_DIR);
const clientHits = grepNeedle(clientFiles, ENV_VAR_NAME);

// 2. Prerendered/exported HTML anywhere under .next — also literally shipped
//    to the browser as the initial page payload (RSC-embedded data included).
const allNextFiles = collectFiles(NEXT_DIR).filter((f) => f.endsWith(".html"));
const htmlHits = grepNeedle(allNextFiles, ENV_VAR_NAME);

// 3. Optional defense-in-depth: if the real secret value is available (e.g.
//    from CI secrets / .env.local), also grep for the literal value, not
//    just the env var *name* — catches a hypothetical future bug where the
//    name is renamed/obfuscated but the raw value still leaks somehow.
const rawValue = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const valueHits =
  rawValue && rawValue.length > 8 ? grepNeedle(clientFiles, rawValue) : [];

const allHits = [...new Set([...clientHits, ...htmlHits, ...valueHits])];

if (allHits.length > 0) {
  console.error("FAIL check:no-service-role-in-bundle — service role key found in client-shipped output:");
  for (const hit of allHits) {
    console.error(`  ${path.relative(process.cwd(), hit)}`);
  }
  process.exit(1);
}

console.log(
  `OK check:no-service-role-in-bundle — scanned ${clientFiles.length} client chunk(s) + ${allNextFiles.length} HTML file(s), no "${ENV_VAR_NAME}"${
    rawValue ? " or literal secret value" : ""
  } found.`,
);
