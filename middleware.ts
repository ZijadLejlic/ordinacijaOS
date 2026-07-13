import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
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

function stripLocale(pathname: string) {
  const segments = pathname.split("/");
  const maybeLocale = segments[1];
  if (routing.locales.includes(maybeLocale as (typeof routing.locales)[number])) {
    const rest = "/" + segments.slice(2).join("/");
    return {
      locale: maybeLocale,
      path: rest === "/" ? "/" : rest.replace(/\/$/, "") || "/",
    };
  }
  return { locale: routing.defaultLocale, path: pathname };
}

async function appHomePath(
  locale: string,
  supabase: NonNullable<Awaited<ReturnType<typeof updateSession>>["supabase"]>,
  pinOk: boolean,
) {
  if (!pinOk) return `/${locale}/pin`;
  const onboardingGate = await resolveOnboardingGate(supabase);
  if (onboardingGate === "needs_onboarding") {
    return `/${locale}/onboarding`;
  }
  return `/${locale}/dashboard`;
}

export async function middleware(request: NextRequest) {
  const i18nResponse = handleI18n(request);
  const { response, user, supabase } = await updateSession(request, i18nResponse);

  const { locale, path } = stripLocale(request.nextUrl.pathname);
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
    path.startsWith("/expenses/");

  const platformAdmin = isPlatformAdmin(user);
  const impersonation = readImpersonationCookieFromRequest(
    request.headers.get("cookie"),
  );

  if (!user && (isAppPage || isMfaPage || isPinPage || isPlatformPage)) {
    const redirect = NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    return copyCookies(response, redirect);
  }

  if (user && isInvitePage) {
    const href = platformAdmin
      ? `/${locale}/platform`
      : `/${locale}/dashboard`;
    const redirect = NextResponse.redirect(new URL(href, request.url));
    return copyCookies(response, redirect);
  }

  // Platform admin console — no clinic MFA/PIN gates (D41).
  if (user && isPlatformPage) {
    if (!platformAdmin) {
      const redirect = NextResponse.redirect(
        new URL(`/${locale}/dashboard`, request.url),
      );
      return copyCookies(response, redirect);
    }
    if (impersonation) {
      const redirect = NextResponse.redirect(
        new URL(`/${locale}/dashboard`, request.url),
      );
      return copyCookies(response, redirect);
    }
    return response;
  }

  // Platform admins without an active impersonation stay out of clinic UI.
  if (user && platformAdmin && !impersonation && (isAppPage || isMfaPage || isPinPage)) {
    const redirect = NextResponse.redirect(
      new URL(`/${locale}/platform`, request.url),
    );
    return copyCookies(response, redirect);
  }

  if (user && supabase && (isAuthPage || isAppPage || isMfaPage || isPinPage)) {
    if (isAuthPage && platformAdmin && !impersonation) {
      const redirect = NextResponse.redirect(
        new URL(`/${locale}/platform`, request.url),
      );
      return copyCookies(response, redirect);
    }

    const mfaGate = await resolveOwnerMfaGate(supabase);

    if (isAuthPage) {
      if (mfaGate !== "ok") {
        const redirect = NextResponse.redirect(
          new URL(`/${locale}${mfaPath(mfaGate)}`, request.url),
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
            new URL(`/${locale}${expected}`, request.url),
          );
          return copyCookies(response, redirect);
        }
        return response;
      }
      const redirect = NextResponse.redirect(
        new URL(`/${locale}${mfaPath(mfaGate)}`, request.url),
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
        new URL(`/${locale}/pin`, request.url),
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
          new URL(`/${locale}/onboarding`, request.url),
        );
        return copyCookies(response, redirect);
      }
      if (onboardingGate === "ok" && isOnboardingPage) {
        const redirect = NextResponse.redirect(
          new URL(`/${locale}/dashboard`, request.url),
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
