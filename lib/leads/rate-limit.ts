import { createHash } from "node:crypto";
import { headers } from "next/headers";

const RATE_LIMIT_PER_HOUR = 5;

/** Client IP from common proxy headers (Vercel / Cloudflare). */
export async function getRequestIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return null;
}

/**
 * Hash IP for storage / rate limiting — never store raw IP on leads.
 * Salt from env so hashes are not portable across environments.
 */
export function hashIp(ip: string): string {
  const salt =
    process.env.LEAD_IP_HASH_SALT?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 32) ||
    "dentord-lead-ip";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export { RATE_LIMIT_PER_HOUR };
