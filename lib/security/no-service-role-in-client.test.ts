import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * P1.9 (docs/QA/Implementation-Plan.md): closes `PLAT-SEC-003` / Threat-Model
 * `T-PLAT-03` / D41 ("Never put Supabase service role keys in client code").
 *
 * **Mechanism found (read before writing a single assertion):** the *only*
 * place `SUPABASE_SERVICE_ROLE_KEY` is read anywhere in `app/**`, `lib/**`,
 * `components/**` is `lib/supabase/service.ts`'s `createServiceClient()`
 * (grepped the whole tree for the literal env var name — one hit outside
 * docs/tests/`.env*`). Every one of its 8 call sites (`lib/platform/data.ts`,
 * `lib/clinic/lifecycle-job.ts` [cron], `lib/onboarding/actions.ts`,
 * `lib/leads/actions.ts`, `lib/invoices/allocate-number.ts`,
 * `lib/invites/actions.ts`, `lib/platform/actions.ts`, and this suite's own
 * `lib/security/factories.ts`) is either a `"use server"` Server Action, a
 * plain server-only module only ever imported from Server
 * Components/Actions/the cron route, or test-only code — never a `"use
 * client"` file. `next.config.ts` has no `env`/`publicRuntimeConfig` block at
 * all (confirmed by reading it), so there is no config-level path that could
 * expose it either, and grepping `.env.example` confirms the var has no
 * `NEXT_PUBLIC_` sibling.
 *
 * This is a **static import-graph** test (the "import graph" option the
 * `PLAT-SEC-003` task brief names as an alternative to "build/bundle grep"):
 * it parses every `.ts`/`.tsx` file under `app/`, `components/`, `lib/`,
 * `i18n/` with the real TypeScript compiler API (already a project
 * dependency — chosen over a regex import-scanner because a regex can be
 * fooled by multiline imports, `type`-only imports, or import specifiers
 * that appear inside string/template literals), finds every file whose
 * *first* statement is the `"use client"` directive prologue (exactly how
 * Next.js itself recognizes a Client Component boundary — a comment or
 * blank line before it is fine, anything else before it is not), then walks
 * the forward import graph from those entry points (static `import`/
 * `export ... from`, and dynamic `import(...)`) to compute every file a
 * client bundle can actually reach. `lib/supabase/service.ts` must never be
 * in that reachable set, and no reachable file's raw source may contain the
 * literal string `SUPABASE_SERVICE_ROLE_KEY` (guards against a future file
 * reading `process.env.SUPABASE_SERVICE_ROLE_KEY` directly instead of going
 * through the wrapper).
 *
 * This complements — does not replace — a real `next build` + `.next/static`
 * grep, which was run once by hand while authoring this test (`npm run
 * build`, ~17s wall clock with this repo's Turbopack config, then `grep -rl
 * SUPABASE_SERVICE_ROLE_KEY .next` and `grep -rl "<the actual secret value
 * from .env.local>" .next` — zero hits outside `.next/server`, and zero
 * hits in any prerendered HTML output under `.next`) and confirmed clean. That check needs a
 * production build (~17s here, and Next's Turbopack build time is not a
 * committed guarantee) so it does not belong in `test:unit` (must stay
 * build-free per P0.4) or `test:security` (must stay DB-only per the
 * existing local-Supabase harness) — it is wired instead as a new step in
 * `.github/workflows/e2e.yml`, reusing that workflow's *existing* "Build
 * Next.js" step output (e2e already needs a real build to serve Playwright;
 * this adds one `grep` step, not a second build) rather than paying for a
 * dedicated build in a new workflow. This file (the fast, DB-free,
 * build-free static check) is the one wired into `test:unit`/`test:security`
 * exclude lists like every other `lib/security/*.test.ts` — it runs on every
 * PR; the build-grep step only runs when `e2e.yml` runs.
 *
 * **Bug found and fixed in this test, not the product** (documented per
 * `multi-tenant-security.mdc` — "stop and report" — instead of silently
 * patched): a first version of the graph walker treated every static import
 * edge identically and reported `lib/supabase/service.ts` as "reachable"
 * from `components/invites/accept-invite-form.tsx` (a real `"use client"`
 * file) via `lib/invites/actions.ts`. That is **not** an actual leak — it is
 * the standard, sanctioned Next.js Server Actions pattern: a Client
 * Component imports a function from a `"use server"` module to wire it to a
 * `<form action={...}>`/`onClick`. Next.js's compiler specially transforms
 * every `"use server"` module for client-reachable callers: it replaces the
 * import with a lightweight RPC reference (an action ID the client posts
 * to), and never inlines that module's real body/imports into the client
 * bundle — confirmed empirically by the live `next build` + `.next/static`
 * grep in the paragraph above finding zero occurrences of the service-role
 * var/value, despite `accept-invite-form.tsx` genuinely importing
 * `acceptInviteAction` from `lib/invites/actions.ts` in the source graph.
 * (Grepped every file in `lib/**` with a `"use server"` directive — all 23
 * are, like `"use client"`, a whole-file directive on line 1; none of this
 * codebase's Server Actions use the alternative per-function inline
 * `"use server"` form, so a first-statement check is sufficient here too.)
 * Fixed by treating any file whose first statement is the `"use server"`
 * directive as an edge boundary the walker must not expand past — mirrors
 * how the walker already treats a bare-specifier (`node_modules`) import as
 * a boundary it does not resolve into. Re-running the corrected walker finds
 * **no** path from any `"use client"` file to `lib/supabase/service.ts`
 * (nor to any other file reading `SUPABASE_SERVICE_ROLE_KEY` directly, e.g.
 * `lib/leads/rate-limit.ts`'s optional-salt fallback, which is only ever
 * reached through the same kind of `"use server"` boundary via
 * `lib/leads/actions.ts`) — the assertions below encode the corrected
 * model, and a dedicated test locks in the boundary behavior itself so a
 * future edit to the walker can't silently regress back to the false
 * positive.
 *
 * No RLS/product/config change was needed — the codebase already keeps the
 * service role server-only; this phase is pure test-authoring (including
 * fixing the test's own initial false positive) plus the one live
 * build-grep verification documented above.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");

const SCAN_DIRS = ["app", "components", "lib", "i18n"];
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const IGNORED_DIR_NAMES = new Set(["node_modules", ".next"]);

const SERVICE_MODULE_PATH = path.join(REPO_ROOT, "lib", "supabase", "service.ts");
const SERVICE_ROLE_ENV_NAME = "SUPABASE_SERVICE_ROLE_KEY";

/** Recursively collects every `.ts`/`.tsx` file path under `dir`. */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIR_NAMES.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (SOURCE_EXTENSIONS.includes(path.extname(full))) {
      out.push(full);
    }
  }
  return out;
}

/** The directive prologue string (`"use client"` / `"use server"`) if `sourceFile`'s very first statement is one, else `null`. */
function firstDirective(sourceFile: ts.SourceFile): string | null {
  const first = sourceFile.statements[0];
  if (!first || !ts.isExpressionStatement(first)) return null;
  const expr = first.expression;
  return ts.isStringLiteral(expr) ? expr.text : null;
}

/** Extracts every static/dynamic import module specifier string from a parsed source file. */
function extractImportSpecifiers(sourceFile: ts.SourceFile): string[] {
  const specifiers: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push((node.arguments[0] as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

/** Resolves an import specifier to an absolute file path within the repo, or `null` for external packages / unresolved paths. */
function resolveSpecifier(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else if (specifier.startsWith("@/")) {
    base = path.join(REPO_ROOT, specifier.slice(2));
  } else {
    return null; // external package (node_modules) — not part of this repo's source graph
  }

  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((ext) => base + ext),
    ...SOURCE_EXTENSIONS.map((ext) => path.join(base, "index" + ext)),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

type Graph = {
  /** file path -> parsed source text, cached so it's read from disk once */
  sourceText: Map<string, string>;
  /** file path -> resolved import targets within the repo */
  edges: Map<string, string[]>;
  /** file path -> "use client" | "use server" | null (first-statement directive prologue) */
  directives: Map<string, string | null>;
  /** every file path that has a literal "use client" prologue */
  clientEntryFiles: string[];
};

function buildGraph(): Graph {
  const files = SCAN_DIRS.flatMap((dir) => collectSourceFiles(path.join(REPO_ROOT, dir)));
  const sourceText = new Map<string, string>();
  const edges = new Map<string, string[]>();
  const directives = new Map<string, string | null>();
  const clientEntryFiles: string[] = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    sourceText.set(file, text);

    const sourceFile = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    const directive = firstDirective(sourceFile);
    directives.set(file, directive);
    if (directive === "use client") {
      clientEntryFiles.push(file);
    }

    const resolved = extractImportSpecifiers(sourceFile)
      .map((spec) => resolveSpecifier(spec, file))
      .filter((p): p is string => p !== null);
    edges.set(file, resolved);
  }

  return { sourceText, edges, directives, clientEntryFiles };
}

/**
 * BFS over `graph.edges` starting from `entryFiles`, modeling what a real
 * client JS bundle actually inlines. A `"use server"` file is added to the
 * result (the client bundle does hold an RPC stub referencing it) but its
 * own imports are **not** expanded — Next.js's compiler replaces that
 * module's real body with the stub for every client-reachable caller, so
 * whatever the "use server" file itself imports never gets inlined into the
 * client bundle. Without this, any Server Action reachable from a Client
 * Component (the standard `<form action={...}>` pattern) would falsely
 * appear to pull its entire server-only import chain into the client graph.
 */
function reachableFrom(graph: Graph, entryFiles: string[]): Set<string> {
  const visited = new Set<string>(entryFiles);
  const queue = [...entryFiles];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const isServerActionBoundary =
      graph.directives.get(current) === "use server" && !entryFiles.includes(current);
    if (isServerActionBoundary) continue;
    for (const next of graph.edges.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

describe("PLAT-SEC-003: service role key never reachable from a client bundle", () => {
  const graph = buildGraph();

  it("sanity: found a non-trivial number of \"use client\" entry files (graph isn't accidentally empty)", () => {
    // Repo had 49 "use client" .tsx files at authoring time (grepped independently
    // of this parser); a floor well below that catches a broken directive-detector
    // without being brittle to legitimate future additions/removals.
    expect(graph.clientEntryFiles.length).toBeGreaterThan(20);
  });

  it("sanity: the client-reachable set is real (contains many files, not just the entry points)", () => {
    const reachable = reachableFrom(graph, graph.clientEntryFiles);
    // Proves the BFS actually walks edges instead of only returning the seed set
    // (which would make the "service.ts is absent" assertion below vacuously true).
    expect(reachable.size).toBeGreaterThan(graph.clientEntryFiles.length + 20);
  });

  it("regression guard: at least one \"use server\" boundary is actually exercised by the walk (proves the fix isn't dead code)", () => {
    const reachable = reachableFrom(graph, graph.clientEntryFiles);
    const boundaryFiles = [...reachable].filter(
      (f) => graph.directives.get(f) === "use server" && !graph.clientEntryFiles.includes(f),
    );
    // e.g. components/invites/accept-invite-form.tsx -> lib/invites/actions.ts
    // is exactly the path this test's own header documents finding and fixing.
    expect(boundaryFiles.length).toBeGreaterThan(0);
  });

  it("positive control: a known client-safe module (anon Supabase browser client) IS reachable", () => {
    const reachable = reachableFrom(graph, graph.clientEntryFiles);
    const anonClientPath = path.join(REPO_ROOT, "lib", "supabase", "client.ts");
    expect(reachable.has(anonClientPath)).toBe(true);
  });

  it("regression guard: the specific known \"use server\" crossing (invite accept form -> invites actions -> service client) is correctly stopped", () => {
    const acceptInviteForm = path.join(REPO_ROOT, "components", "invites", "accept-invite-form.tsx");
    const invitesActions = path.join(REPO_ROOT, "lib", "invites", "actions.ts");

    // Sanity: the raw source-level edge really exists (else this test would
    // pass vacuously and stop proving anything the moment that file changes).
    expect(graph.edges.get(acceptInviteForm) ?? []).toContain(invitesActions);
    expect(graph.directives.get(invitesActions)).toBe("use server");
    expect(graph.edges.get(invitesActions) ?? []).toContain(SERVICE_MODULE_PATH);

    const reachable = reachableFrom(graph, graph.clientEntryFiles);
    // The Server Action boundary file itself is a legitimate client-visible
    // reference (stub) ...
    expect(reachable.has(invitesActions)).toBe(true);
    // ... but the walk must not have expanded past it into service.ts.
    expect(reachable.has(SERVICE_MODULE_PATH)).toBe(false);
  });

  it("lib/supabase/service.ts is never reachable by import from any \"use client\" file", () => {
    const reachable = reachableFrom(graph, graph.clientEntryFiles);
    const offendingPaths = [...reachable].filter((f) => f === SERVICE_MODULE_PATH);
    expect(offendingPaths).toEqual([]);
  });

  it("no file whose body is actually inlined into the client bundle reads SUPABASE_SERVICE_ROLE_KEY directly", () => {
    const reachable = reachableFrom(graph, graph.clientEntryFiles);
    // A "use server" boundary file itself is excluded from the content scan
    // on purpose: its real body is never inlined client-side (only an RPC
    // stub is), so its own source text containing the var name would not be
    // an actual leak — same reasoning `reachableFrom` already applies to not
    // expanding past it.
    const offenders = [...reachable].filter((f) => {
      const isServerActionBoundary =
        graph.directives.get(f) === "use server" && !graph.clientEntryFiles.includes(f);
      if (isServerActionBoundary) return false;
      return (graph.sourceText.get(f) ?? "").includes(SERVICE_ROLE_ENV_NAME);
    });
    expect(offenders).toEqual([]);
  });

  it("next.config.ts has no env/publicRuntimeConfig block that could expose the service role key", () => {
    const nextConfigPath = path.join(REPO_ROOT, "next.config.ts");
    const text = readFileSync(nextConfigPath, "utf8");
    expect(text).not.toContain(SERVICE_ROLE_ENV_NAME);
  });

  it(".env.example never defines a NEXT_PUBLIC_ variant of the service role key", () => {
    const envExamplePath = path.join(REPO_ROOT, ".env.example");
    const text = readFileSync(envExamplePath, "utf8");
    expect(text).not.toMatch(/NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE[A-Z_]*=/);
  });
});
