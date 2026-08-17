import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BRAND_COLORS, PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand/constants";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get("title") || PRODUCT_NAME).slice(0, 80);

  let logoSrc: string | null = null;
  try {
    const logo = await readFile(
      join(process.cwd(), "public/brand/logo-mark.png"),
    );
    logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  } catch {
    logoSrc = null;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: `linear-gradient(145deg, ${BRAND_COLORS.navy} 0%, #162a5c 55%, ${BRAND_COLORS.blueDeep} 100%)`,
          color: "white",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              width={56}
              height={56}
              alt=""
              style={{ borderRadius: 12 }}
            />
          ) : null}
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {PRODUCT_NAME}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            maxWidth: 980,
          }}
        >
          <div
            style={{
              fontSize: title.length > 48 ? 48 : 56,
              fontWeight: 650,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 22,
              color: "rgba(255,255,255,0.72)",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {PRODUCT_TAGLINE}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: "system-ui, sans-serif",
            fontSize: 18,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <span>dentord.com</span>
          <div
            style={{
              width: 120,
              height: 4,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${BRAND_COLORS.blue}, ${BRAND_COLORS.cyan})`,
            }}
          />
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control":
          "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
