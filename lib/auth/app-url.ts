/**
 * Public app origin for auth email redirects and absolute links.
 * Production must set NEXT_PUBLIC_APP_URL=https://www.dentord.com
 * (Supabase Site URL + Redirect URLs must allow the same host).
 */
export function getAppUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "").trim();
  return url || null;
}

/** Absolute URL for post-auth email redirects (confirm / recovery). */
export function authEmailRedirectUrl(nextPath: string): string | null {
  const appUrl = getAppUrl();
  if (!appUrl) return null;
  const next = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`;
}
