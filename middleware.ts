import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { publicLocalePath } from "@/i18n/path";
import { repairI18nRewrite } from "@/i18n/repair-rewrite";
import { routing } from "@/i18n/routing";
import { mfaPath, resolveOwnerMfaGate } from "@/lib/auth/mfa";
import { resolveOnboardingGate } from "@/lib/onboarding/gate";
import {
  readOperatorCookieFromRequest,
  resolvePinGate,
} from "@/lib/operators/gate";
import { OPERATOR_COOKIE } from "@/lib/operators/constants";
import { isPlatformAdmin } from "@/lib/platform/admin";
import { readImpersonationCookieFromRequest } from "@/lib/platform/session";
import { IMPERSONATION_COOKIE } from "@/lib/platform/constants";
import { copyCookies, updateSession } from "@/lib/supabase/middleware";

const handleI18n = createMiddleware(routing);

/**
 * Strip locale prefix and map localized marketing slugs → internal pathnames
 * so auth gates match filesystem routes (`/cijene` → `/pricing`).
 */
function stripLocale(pathname: string) {
  const segments = pathname.split("/");
  const maybeLocale = segments[1];
  let locale: string = routing.defaultLocale;
  let pathWithoutLocale: string;

  if (routing.locales.includes(maybeLocale as (typeof routing.locales)[number])) {
    locale = maybeLocale;
    const rest = "/" + segments.slice(2).join("/");
    pathWithoutLocale = rest === "/" ? "/" : rest.replace(/\/$/, "") || "/";
  } else {
    pathWithoutLocale = pathname === "/" ? "/" : pathname.replace(/\/$/, "") || "/";
  }

  return { locale, path: toInternalPathname(locale, pathWithoutLocale) };
}

function toInternalPathname(locale: string, externalPath: string): string {
  const pathnames = routing.pathnames;
  for (const [internal, config] of Object.entries(pathnames)) {
    if (typeof config === "string") {
      if (config === externalPath) return internal;
      continue;
    }
    const localized =
      config[locale as keyof typeof config] ??
      config[routing.defaultLocale as keyof typeof config] ??
      internal;
    if (localized === externalPath) return internal;
  }
  return externalPath;
}

async function appHomePath(
  locale: string,
  supabase: NonNullable<Awaited<ReturnType<typeof updateSession>>["supabase"]>,
  pinOk: boolean,
) {
  if (!pinOk) return publicLocalePath(locale, "/pin");
  const onboardingGate = await resolveOnboardingGate(supabase);
  if (onboardingGate === "needs_onboarding") {
    return publicLocalePath(locale, "/onboarding");
  }
  return publicLocalePath(locale, "/dashboard");
}

function localeHref(locale: string, path: `/${string}`) {
  return publicLocalePath(locale, path);
}

function isServerActionRequest(request: NextRequest) {
  // Server Actions POST to the page URL. Any NextResponse.redirect() here returns
  // a normal HTTP redirect instead of text/x-component → client throws
  // "An unexpected response was received from the server."
  return request.method === "POST" && request.headers.has("next-action");
}

export async function middleware(request: NextRequest) {
  // Never let i18n or auth redirects touch Server Actions — only refresh cookies.
  // Auth gates still apply on the document navigation after the action redirects.
  if (isServerActionRequest(request)) {
    const passthrough = NextResponse.next({ request });
    const { response } = await updateSession(request, passthrough);
    return response;
  }

  const i18nResponse = handleI18n(request);
  const { locale, path } = stripLocale(request.nextUrl.pathname);
  const session = await updateSession(request, i18nResponse);
  const user = session.user;
  const supabase = session.supabase;
  let response = repairI18nRewrite(request, session.response, locale);

  const isAuthPage = path === "/login" || path === "/signup";
  const isInvitePage = path === "/invite" || path.startsWith("/invite/");
  const isMfaPage = path === "/mfa/enroll" || path === "/mfa/verify";
  const isPinPage = path === "/pin";
  const isPlatformPage =
    path === "/platform" || path.startsWith("/platform/");
  const isOnboardingPage = path === "/onboarding" || path.startsWith("/onboarding/");
  /** CSV import allowed mid-wizard (PRD §6.1 step 2). */
  const isOnboardingAllowedAppPath =
    isOnboardingPage ||
    path === "/settings/import" ||
    path.startsWith("/settings/import/");
  const isAppPage =
    isOnboardingPage ||
    path === "/dashboard" ||
    path.startsWith("/dashboard/") ||
    path === "/settings" ||
    path.startsWith("/settings/") ||
    path === "/patients" ||
    path.startsWith("/patients/") ||
    path === "/services" ||
    path.startsWith("/services/") ||
    path === "/calendar" ||
    path.startsWith("/calendar/") ||
    path === "/invoices" ||
    path.startsWith("/invoices/") ||
    path === "/expenses" ||
    path.startsWith("/expenses/") ||
    path === "/inventory" ||
    path.startsWith("/inventory/") ||
    path === "/crm" ||
    path.startsWith("/crm/");

  const platformAdmin = isPlatformAdmin(user);
  const impersonation = readImpersonationCookieFromRequest(
    request.headers.get("cookie"),
  );

  if (!user && (isAppPage || isMfaPage || isPinPage || isPlatformPage)) {
    const redirect = NextResponse.redirect(
      new URL(localeHref(locale, "/login"), request.url),
    );
    return copyCookies(response, redirect);
  }

  if (user && isInvitePage) {
    const href = platformAdmin
      ? localeHref(locale, "/platform")
      : localeHref(locale, "/dashboard");
    const redirect = NextResponse.redirect(new URL(href, request.url));
    return copyCookies(response, redirect);
  }

  // Platform admin console — no clinic MFA/PIN gates (D41).
  if (user && isPlatformPage) {
    if (!platformAdmin) {
      const redirect = NextResponse.redirect(
        new URL(localeHref(locale, "/dashboard"), request.url),
      );
      return copyCookies(response, redirect);
    }
    if (impersonation) {
      const redirect = NextResponse.redirect(
        new URL(localeHref(locale, "/dashboard"), request.url),
      );
      return copyCookies(response, redirect);
    }
    return response;
  }

  // Platform admins without an active impersonation stay out of clinic UI.
  if (user && platformAdmin && !impersonation && (isAppPage || isMfaPage || isPinPage)) {
    const redirect = NextResponse.redirect(
      new URL(localeHref(locale, "/platform"), request.url),
    );
    return copyCookies(response, redirect);
  }

  if (user && supabase && (isAuthPage || isAppPage || isMfaPage || isPinPage)) {
    if (isAuthPage && platformAdmin && !impersonation) {
      const redirect = NextResponse.redirect(
        new URL(localeHref(locale, "/platform"), request.url),
      );
      return copyCookies(response, redirect);
    }

    const mfaGate = await resolveOwnerMfaGate(supabase);

    if (isAuthPage) {
      if (mfaGate !== "ok") {
        const redirect = NextResponse.redirect(
          new URL(localeHref(locale, mfaPath(mfaGate)), request.url),
        );
        return copyCookies(response, redirect);
      }
      const operatorCookie = readOperatorCookieFromRequest(
        request.headers.get("cookie"),
      );
      const pinGate = await resolvePinGate(supabase, operatorCookie);
      const href = await appHomePath(locale, supabase, pinGate === "ok");
      const redirect = NextResponse.redirect(new URL(href, request.url));
      return copyCookies(response, redirect);
    }

    if (mfaGate !== "ok") {
      if (isMfaPage) {
        const expected = mfaPath(mfaGate);
        if (path !== expected) {
          const redirect = NextResponse.redirect(
            new URL(localeHref(locale, expected), request.url),
          );
          return copyCookies(response, redirect);
        }
        return response;
      }
      const redirect = NextResponse.redirect(
        new URL(localeHref(locale, mfaPath(mfaGate)), request.url),
      );
      return copyCookies(response, redirect);
    }

    if (isMfaPage) {
      const operatorCookie = readOperatorCookieFromRequest(
        request.headers.get("cookie"),
      );
      const pinGate = await resolvePinGate(supabase, operatorCookie);
      const href = await appHomePath(locale, supabase, pinGate === "ok");
      const redirect = NextResponse.redirect(new URL(href, request.url));
      return copyCookies(response, redirect);
    }

    const operatorCookie = readOperatorCookieFromRequest(
      request.headers.get("cookie"),
    );
    const pinGate = await resolvePinGate(supabase, operatorCookie);

    if (isPinPage) {
      if (pinGate === "ok") {
        const href = await appHomePath(locale, supabase, true);
        const redirect = NextResponse.redirect(new URL(href, request.url));
        return copyCookies(response, redirect);
      }
      return response;
    }

    if (isAppPage && pinGate !== "ok") {
      const redirect = NextResponse.redirect(
        new URL(localeHref(locale, "/pin"), request.url),
      );
      // Drop stale operator cookie if present but invalid
      if (operatorCookie) {
        redirect.cookies.set(OPERATOR_COOKIE, "", {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 0,
        });
      }
      return copyCookies(response, redirect);
    }

    // Owner in-app onboarding (PRD §6.1 / D43). Skip while impersonating.
    if (isAppPage && pinGate === "ok" && !impersonation) {
      const onboardingGate = await resolveOnboardingGate(supabase);
      if (onboardingGate === "needs_onboarding" && !isOnboardingAllowedAppPath) {
        const redirect = NextResponse.redirect(
          new URL(localeHref(locale, "/onboarding"), request.url),
        );
        return copyCookies(response, redirect);
      }
      if (onboardingGate === "ok" && isOnboardingPage) {
        const redirect = NextResponse.redirect(
          new URL(localeHref(locale, "/dashboard"), request.url),
        );
        return copyCookies(response, redirect);
      }
    }
  }

  // Clear stale impersonation cookie if session no longer matches target.
  if (
    user &&
    impersonation &&
    user.id !== impersonation.targetUserId &&
    !platformAdmin
  ) {
    response.cookies.set(IMPERSONATION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|monitoring|api|.*\\..*).*)"],
};
