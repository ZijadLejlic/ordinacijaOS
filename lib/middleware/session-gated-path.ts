/**
 * Internal pathname after locale strip + next-intl slug map
 * (`/cijene` → `/pricing`). Marketing stays ungated so middleware can skip
 * `supabase.auth.getUser()` (Fluid CPU on public crawls).
 */
export function isSessionGatedPath(path: string): boolean {
  if (
    path === "/login" ||
    path === "/signup" ||
    path === "/forgot-password" ||
    path === "/reset-password" ||
    path.startsWith("/reset-password/")
  ) {
    return true;
  }
  if (path === "/invite" || path.startsWith("/invite/")) return true;
  if (path === "/mfa/enroll" || path === "/mfa/verify") return true;
  if (path === "/pin") return true;
  if (path === "/platform" || path.startsWith("/platform/")) return true;
  if (path === "/onboarding" || path.startsWith("/onboarding/")) return true;

  const appRoots = [
    "/dashboard",
    "/settings",
    "/patients",
    "/services",
    "/calendar",
    "/invoices",
    "/expenses",
    "/inventory",
    "/crm",
  ] as const;

  return appRoots.some((root) => path === root || path.startsWith(`${root}/`));
}
