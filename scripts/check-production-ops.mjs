#!/usr/bin/env node
/**
 * Public production ops probe (no secrets).
 * Usage: npm run check:production-ops
 * Optional: PRODUCTION_BASE_URL=https://www.dentord.com
 */
import { execFileSync } from "node:child_process";

const base = (
  process.env.PRODUCTION_BASE_URL ?? "https://www.dentord.com"
).replace(/\/$/, "");
const domain = "dentord.com";

function dig(type, name) {
  try {
    return execFileSync(
      "dig",
      ["@8.8.8.8", "+short", "+time=3", "+tries=1", type, name],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function httpCode(path) {
  const res = await fetch(`${base}${path}`, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  return res.status;
}

async function jsonGet(path, headers = {}) {
  const res = await fetch(`${base}${path}`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 120);
  }
  return { status: res.status, body };
}

const rows = [];

function check(name, ok, detail) {
  rows.push({ name, ok, detail });
  const mark = ok ? "OK" : "FAIL";
  console.log(`${mark.padEnd(4)} ${name} — ${detail}`);
}

const mx = dig("MX", domain);
check("DNS MX", mx.length > 0, mx.length ? mx.join(" | ") : "nema MX (support@ ne prima)");

const spf = dig("TXT", `send.${domain}`);
check(
  "DNS SPF (send.)",
  spf.some((l) => l.includes("v=spf1")),
  spf[0]?.slice(0, 80) ?? "missing",
);

const dkim = dig("TXT", `resend._domainkey.${domain}`);
check("DNS DKIM (Resend)", dkim.length > 0, dkim.length ? "present" : "missing");

const paths = ["/bs", "/bs/login", "/bs/signup", "/bs/cijene"];
for (const path of paths) {
  const code = await httpCode(path);
  check(`HTTP ${path}`, code === 200, String(code));
}

const cron = await jsonGet("/api/cron/clinic-lifecycle");
check(
  "Cron auth gate",
  cron.status === 401,
  `${cron.status} ${JSON.stringify(cron.body)} (očekivano 401 = CRON_SECRET set)`,
);

const health = await jsonGet("/api/health");
const healthOk =
  health.status === 200 &&
  typeof health.body === "object" &&
  health.body?.ok === true;
check(
  "Health liveness",
  healthOk || health.status === 404,
  healthOk
    ? JSON.stringify(health.body)
    : `${health.status} (404 = deployaj /api/health; inače FAIL)`,
);
if (health.status === 404) {
  console.log("NOTE Health route još nije na produkciji — deploy ovog commita.");
}

const failed = rows.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.log(`Rezultat: ${failed.length} FAIL — vidi docs/Production-Ops.md`);
  process.exitCode = 1;
} else {
  console.log("Rezultat: sve OK");
}
