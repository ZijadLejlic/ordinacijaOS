/**
 * Lighthouse audit for marketing Home + Pricing (Website §6.3 / §7.2).
 *
 *   NEXT_PUBLIC_SITE_URL=http://localhost:3020 npm run build
 *   HOSTNAME=localhost npm run start -- -H localhost -p 3020
 *   LIGHTHOUSE_BASE_URL=http://localhost:3020 npm run lighthouse:marketing
 *
 * Default form factor is desktop (acceptance ≥95). For mobile Slow-4G lab:
 *   LIGHTHOUSE_FORM_FACTOR=mobile npm run lighthouse:marketing
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.LIGHTHOUSE_BASE_URL ?? "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FORM_FACTOR = process.env.LIGHTHOUSE_FORM_FACTOR ?? "desktop";
const TARGET = 95;

const PAGES = [
  { id: "home", path: "/bs" },
  { id: "pricing", path: "/bs/cijene" },
];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `exit ${code}`));
    });
  });
}

async function audit(page) {
  const out = join(process.cwd(), `.lighthouse-${page.id}.json`);
  const url = `${BASE}${page.path}`;
  const args = [
    "lighthouse",
    url,
    "--only-categories=performance,accessibility,seo",
    "--output=json",
    `--output-path=${out}`,
    "--quiet",
    "--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage",
  ];
  if (FORM_FACTOR === "desktop") {
    args.push("--preset=desktop");
  }
  if (existsSync(CHROME)) {
    args.push(`--chrome-path=${CHROME}`);
  }
  await run("npx", ["--yes", "lighthouse@12.6.0", ...args.slice(1)]);
  const json = JSON.parse(readFileSync(out, "utf8"));
  const scores = {
    performance: Math.round((json.categories.performance?.score ?? 0) * 100),
    accessibility: Math.round(
      (json.categories.accessibility?.score ?? 0) * 100,
    ),
    seo: Math.round((json.categories.seo?.score ?? 0) * 100),
  };
  try {
    unlinkSync(out);
  } catch {
    /* ignore */
  }
  return scores;
}

const results = [];
for (const page of PAGES) {
  process.stdout.write(
    `Auditing ${page.id} (${BASE}${page.path}, ${FORM_FACTOR})…\n`,
  );
  const scores = await audit(page);
  results.push({ id: page.id, ...scores });
  console.log(scores);
}

const report = {
  base: BASE,
  formFactor: FORM_FACTOR,
  target: TARGET,
  generatedAt: new Date().toISOString(),
  results,
  pass: results.every(
    (r) =>
      r.performance >= TARGET &&
      r.accessibility >= TARGET &&
      r.seo >= TARGET,
  ),
};

writeFileSync(
  join(process.cwd(), "docs/lighthouse-marketing.json"),
  JSON.stringify(report, null, 2),
);

if (!report.pass) {
  console.error(`FAIL: one or more scores < ${TARGET}`);
  process.exit(1);
}
console.log(`PASS: all scores ≥ ${TARGET}`);
