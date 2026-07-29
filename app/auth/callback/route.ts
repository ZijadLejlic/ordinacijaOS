import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ensureOwnerClinic } from "@/lib/auth/ensure-clinic";
import { publicLocalePath } from "@/i18n/path";
import { routing } from "@/i18n/routing";
import type { Database } from "@/lib/supabase/database.types";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return publicLocalePath(routing.defaultLocale, "/login");
  }
  return raw;
}

function redirectBase(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal =
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1";
  if (!isLocal && forwardedHost) {
    return `https://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

/**
 * PKCE email-confirm / recovery landing.
 * Exchanges `?code=` for a session, ensures owner clinic from signup metadata,
 * then redirects to `next` (defaults to locale login — middleware sends
 * authenticated owners to MFA/onboarding/dashboard).
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const base = redirectBase(request);
  const loginFallback = `${base}${publicLocalePath(routing.defaultLocale, "/login")}`;

  if (!code) {
    return NextResponse.redirect(loginFallback);
  }

  const response = NextResponse.redirect(`${base}${next}`);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${loginFallback}?error=${encodeURIComponent("confirmFailed")}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = user?.user_metadata ?? {};
  const clinicName =
    typeof meta.clinic_name === "string" ? meta.clinic_name : null;
  const fullName =
    typeof meta.full_name === "string"
      ? meta.full_name
      : (user?.email ?? "Owner");

  if (clinicName) {
    await ensureOwnerClinic(supabase, { clinicName, fullName });
  }

  return response;
}
