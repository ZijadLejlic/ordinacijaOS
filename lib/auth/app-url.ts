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

/**
 * SSR-safe recovery link for Resend emails.
 * Uses `/auth/confirm` (button click) so Gmail/Safe Links prefetch does not
 * consume the token, then `/auth/callback` verifies via `token_hash`.
 */
export function authRecoveryConfirmUrl(
  tokenHash: string,
  nextPath: string,
): string | null {
  const appUrl = getAppUrl();
  if (!appUrl || !tokenHash) return null;
  const next = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: "recovery",
    next,
  });
  return `${appUrl}/auth/confirm?${params.toString()}`;
}
