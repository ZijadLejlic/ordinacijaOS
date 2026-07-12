import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { mfaPath, resolveOwnerMfaGate } from "@/lib/auth/mfa";
import {
  readOperatorCookieFromRequest,
  resolvePinGate,
} from "@/lib/operators/gate";
import { OPERATOR_COOKIE } from "@/lib/operators/constants";
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

export async function middleware(request: NextRequest) {
  const i18nResponse = handleI18n(request);
  const { response, user, supabase } = await updateSession(request, i18nResponse);

  const { locale, path } = stripLocale(request.nextUrl.pathname);
  const isAuthPage = path === "/login" || path === "/signup";
  const isInvitePage = path === "/invite" || path.startsWith("/invite/");
  const isMfaPage = path === "/mfa/enroll" || path === "/mfa/verify";
  const isPinPage = path === "/pin";
  const isAppPage =
    path === "/dashboard" ||
    path.startsWith("/dashboard/") ||
    path === "/settings" ||
    path.startsWith("/settings/");

  if (!user && (isAppPage || isMfaPage || isPinPage)) {
    const redirect = NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    return copyCookies(response, redirect);
  }

  if (user && isInvitePage) {
    const redirect = NextResponse.redirect(
      new URL(`/${locale}/dashboard`, request.url),
    );
    return copyCookies(response, redirect);
  }

  if (user && supabase && (isAuthPage || isAppPage || isMfaPage || isPinPage)) {
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
      const href =
        pinGate === "ok" ? `/${locale}/dashboard` : `/${locale}/pin`;
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
      const href =
        pinGate === "ok" ? `/${locale}/dashboard` : `/${locale}/pin`;
      const redirect = NextResponse.redirect(new URL(href, request.url));
      return copyCookies(response, redirect);
    }

    const operatorCookie = readOperatorCookieFromRequest(
      request.headers.get("cookie"),
    );
    const pinGate = await resolvePinGate(supabase, operatorCookie);

    if (isPinPage) {
      if (pinGate === "ok") {
        const redirect = NextResponse.redirect(
          new URL(`/${locale}/dashboard`, request.url),
        );
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
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
