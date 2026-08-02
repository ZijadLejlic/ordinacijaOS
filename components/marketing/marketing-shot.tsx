import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  marketingShotSrc,
  type MarketingShotId,
} from "@/lib/marketing/screenshots";

type Props = {
  id: MarketingShotId;
  alt: string;
  priority?: boolean;
  className?: string;
  /** Phone shots are taller; desktop browser shots are ~1200×780. */
  phone?: boolean;
  /** Override next/image `sizes` when the layout slot differs from defaults. */
  sizes?: string;
  /** Above-fold but not LCP — eager without fetchPriority=high. */
  eager?: boolean;
  /**
   * Desktop home hero: mid-size dashboard asset with loading=lazy so a
   * `hidden lg:block` parent does not download on mobile. Pair with a
   * media-gated `<link rel="preload">` for desktop LCP.
   */
  desktopLcp?: boolean;
};

export function MarketingShot({
  id,
  alt,
  priority = false,
  className,
  phone = false,
  sizes: sizesProp,
  eager = false,
  desktopLcp = false,
}: Props) {
  const width = phone ? 390 : 1200;
  const height = phone ? 780 : 720;
  const src = marketingShotSrc(id);
  const sizes =
    sizesProp ??
    (phone
      ? "(max-width: 768px) 280px, 360px"
      : "(max-width: 1024px) 100vw, 720px");

  if (desktopLcp && id === "dashboard") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- paired with media-gated preload
      <img
        src="/marketing/screenshots/dashboard-lg.webp"
        alt={alt}
        width={1440}
        height={864}
        loading="lazy"
        decoding="async"
        className={cn("h-auto w-full", className)}
      />
    );
  }

  // Priority LCP shots: plain img avoids next/image runtime opacity/decoding quirks.
  if (priority) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- LCP: sync decode + fetchpriority
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        fetchPriority="high"
        decoding="sync"
        className={cn("h-auto w-full", className)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      loading={eager ? "eager" : undefined}
      className={cn("h-auto w-full", className)}
    />
  );
}
