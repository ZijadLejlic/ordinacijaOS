import Image from "next/image";
import { BRAND_LOGO, PRODUCT_NAME } from "@/lib/brand/constants";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "full" | "mark";
  className?: string;
  priority?: boolean;
  /** Override accessible name — pass "" when adjacent visible text already labels the logo. */
  alt?: string;
};

export function BrandLogo({
  variant = "full",
  className,
  priority = false,
  alt = PRODUCT_NAME,
}: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src={BRAND_LOGO.mark}
        alt={alt}
        width={80}
        height={80}
        className={cn("h-8 w-8 object-contain", className)}
        // Header mark is always above the fold — never lazy.
        priority={priority}
        loading="eager"
        fetchPriority={priority ? "high" : "auto"}
        sizes="40px"
      />
    );
  }

  // Pre-sized header asset — plain img avoids /_next/image hop on the critical path.
  return (
    // eslint-disable-next-line @next/next/no-img-element -- critical-path logo, already resized
    <img
      src={BRAND_LOGO.header}
      alt={alt}
      width={304}
      height={210}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}
