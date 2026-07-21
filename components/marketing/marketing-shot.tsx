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
};

export function MarketingShot({
  id,
  alt,
  priority = false,
  className,
  phone = false,
}: Props) {
  const width = phone ? 390 : 1200;
  const height = phone ? 780 : 720;
  const src = marketingShotSrc(id);
  const sizes = phone
    ? "(max-width: 768px) 280px, 360px"
    : "(max-width: 1024px) 100vw, 720px";

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
      unoptimized
      className={cn("h-auto w-full", className)}
    />
  );
}
