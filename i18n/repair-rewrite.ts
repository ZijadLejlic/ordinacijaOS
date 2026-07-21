import { type NextRequest, NextResponse } from "next/server";
import { copyCookies } from "@/lib/supabase/middleware";

const LOCALE_HEADER = "X-NEXT-INTL-LOCALE";

/**
 * Next.js 16.2.6+ can leak middleware rewrites as 307 redirects when the
 * absolute rewrite host (often `localhost`) ≠ server bind host (`0.0.0.0` /
 * `127.0.0.1`). Rebuild the rewrite using the request `Host` header so the
 * rewrite origin matches what the production server compares against.
 *
 * Prefer running the Node server with `HOSTNAME=localhost` (see `npm start`)
 * so next-intl rewrites stay internal. @see https://github.com/vercel/next.js/issues/94342
 */
export function repairI18nRewrite(
  request: NextRequest,
  response: NextResponse,
  locale: string,
): NextResponse {
  const rewriteHeader = response.headers.get("x-middleware-rewrite");
  if (!rewriteHeader) return response;

  // Already a relative internal rewrite — do not pass through NextResponse.rewrite
  // (relative destinations throw: "URL is malformed").
  if (rewriteHeader.startsWith("/")) {
    return response;
  }

  let rewriteUrl: URL;
  try {
    rewriteUrl = new URL(rewriteHeader, request.url);
  } catch {
    return response;
  }

  const host = request.headers.get("host");
  if (!host) return response;

  const protocol = request.nextUrl.protocol || "http:";
  const dest = new URL(
    `${rewriteUrl.pathname}${rewriteUrl.search}`,
    `${protocol}//${host}`,
  );

  if (dest.href === rewriteUrl.href && response.status < 300) {
    return response;
  }

  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, locale);

  const repaired = NextResponse.rewrite(dest, {
    request: { headers },
  });

  const link = response.headers.get("link");
  if (link) repaired.headers.set("link", link);

  return copyCookies(response, repaired);
}
