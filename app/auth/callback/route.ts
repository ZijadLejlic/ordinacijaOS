import { type EmailOtpType } from "@supabase/supabase-js";
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

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function asEmailOtpType(raw: string | null): EmailOtpType | null {
  if (!raw || !OTP_TYPES.has(raw as EmailOtpType)) return null;
  return raw as EmailOtpType;
}

/**
 * Auth email landing:
 * - PKCE signup/confirm: `?code=` → exchangeCodeForSession
 * - Recovery / invite (Resend + generateLink): `?token_hash=&type=` → verifyOtp
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const otpType = asEmailOtpType(request.nextUrl.searchParams.get("type"));
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const base = redirectBase(request);
  const loginFallback = `${base}${publicLocalePath(routing.defaultLocale, "/login")}`;

  if (!code && !(tokenHash && otpType)) {
    return NextResponse.redirect(
      `${loginFallback}?error=${encodeURIComponent("confirmFailed")}`,
    );
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

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: otpType!,
      });

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
