import { cookies } from "next/headers";
import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_COOKIE_MAX_AGE,
} from "@/lib/platform/constants";

export type ImpersonationPayload = {
  adminUserId: string;
  adminEmail: string;
  clinicId: string;
  targetUserId: string;
  startedAt: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPayload(value: unknown): value is ImpersonationPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.adminUserId === "string" &&
    UUID_RE.test(v.adminUserId) &&
    typeof v.adminEmail === "string" &&
    v.adminEmail.includes("@") &&
    typeof v.clinicId === "string" &&
    UUID_RE.test(v.clinicId) &&
    typeof v.targetUserId === "string" &&
    UUID_RE.test(v.targetUserId) &&
    typeof v.startedAt === "string"
  );
}

export function parseImpersonationCookie(
  raw: string | undefined | null,
): ImpersonationPayload | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function getImpersonationFromCookie() {
  const store = await cookies();
  return parseImpersonationCookie(store.get(IMPERSONATION_COOKIE)?.value);
}

export async function setImpersonationCookie(payload: ImpersonationPayload) {
  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IMPERSONATION_COOKIE_MAX_AGE,
  });
}

export async function clearImpersonationCookie() {
  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);
}

export function readImpersonationCookieFromRequest(
  cookieHeader: string | null,
): ImpersonationPayload | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${IMPERSONATION_COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(IMPERSONATION_COOKIE.length + 1));
  return parseImpersonationCookie(value);
}
