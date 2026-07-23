import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

/**
 * P0.8 (docs/QA/Implementation-Plan.md) fail-closed gate: a clean
 * `describe.skip` is fine for local dev without a Supabase instance, but it
 * must be impossible for the release-blocker security suite to silently skip
 * in CI. Callers set `SECURITY_TESTS_REQUIRED=1`; if the DB env is still
 * missing at that point, throw instead of returning null so the test run
 * fails loudly instead of reporting a green "2 skipped".
 *
 * `source` defaults to `process.env` and only exists so unit tests can probe
 * every branch (missing vars / required flag on-off) without mutating real
 * process env or depending on `.env.local` contents. See D-15.
 */
export function getSecurityTestEnv(
  source: Record<string, string | undefined> = process.env,
) {
  const url = source.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = source.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = source.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    if (source.SECURITY_TESTS_REQUIRED === "1") {
      const missing = [
        !url && "NEXT_PUBLIC_SUPABASE_URL",
        !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
      ]
        .filter(Boolean)
        .join(", ");
      throw new Error(
        `SECURITY_TESTS_REQUIRED=1 but the security test suite would skip: ` +
          `missing env var(s) ${missing}. Start local Supabase (\`supabase start && supabase db reset\`) ` +
          `and export its status, or point at a staging project — the release-blocker ` +
          `tenant isolation / RBAC suite must not be allowed to silently skip.`,
      );
    }
    return null;
  }

  return { url, anonKey, serviceKey };
}
