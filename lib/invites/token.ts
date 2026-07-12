import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_DAYS = 7;

export function createInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteExpiresAt(from = new Date()) {
  const expires = new Date(from);
  expires.setUTCDate(expires.getUTCDate() + INVITE_TTL_DAYS);
  return expires.toISOString();
}
